# Local Gateway (Runtime Environment) - CHARIOT

This package contains the implementation of the **Runtime** (Local Gateway) layer of the CHARIOT project.

## Role and Internal Pipeline

The gateway runs locally at the edge and processes smart home sensor data end-to-end through the following pipeline:

1. **Embedded Broker**: Starts an embedded MQTT broker (Aedes) on local port `1883`.
2. **Drivers (Matter)**: Connects to the virtual Matter temperature sensor (running on port `5540`), subscribes to its raw temperature measurements, and feeds them into the pipeline.
3. **Protocol Support**: An abstraction layer unifying event reception from all protocol-specific drivers.
4. **Data Access**: User consent compliance checker (Data Act). If the user does not authorize a specific data type, transmission is aborted immediately.
5. **Devices Mapping**: Normalizes raw sensor readings into a standardized Virtual Profile format (**Profile Property Identifier**) resembling `{ deviceId, type, unit, value, timestamp }`. The mapping logic scales the raw Matter temperature value down by 100 (in compliance with Matter Temperature Measurement cluster specifications).
6. **Anonymisation Engine** *(new)*: Three-step GDPR privacy pipeline applied on each Virtual Profile — see [Anonymisation Pipeline](#anonymisation-pipeline) below.
7. **Data Encryption**: AES-256-GCM encryption of the (potentially anonymised) profile. The 32-byte key is derived using the native Node.js `crypto.scryptSync` cryptographic function.
8. **Mqtt Publisher**: Publishes the encrypted payload to the local Aedes broker on the topic `chariot/devices/{groupId}` (anonymised) or `chariot/devices/{deviceId}` (raw mode).

---

## Anonymisation Pipeline

A four-step GDPR privacy pipeline (`src/anonymisation/`) is inserted between **Devices Mapping** and **Data Encryption**.
When active, the output profile changes shape from a per-device `VirtualProfile` to an aggregated zone-level profile:

```
VirtualProfile  { deviceId, type, unit, value, timestamp }
      ↓  AnonymisationEngine
GroupProfile    { groupId, zoneId, type, unit, value, homeCount, deviceCount, timestamp }
```

### Core Privacy Principle

**No data per room, nor per individual home, is ever exposed outside the local runtime (gateway).**
The services tier and external smart city clients can only visualize aggregated data at the geographic zone/neighborhood level (`zoneId`), and only when a minimum number of distinct homes in that zone have active devices.

---

### Pipeline Steps (Executed Sequentially)

#### Step 1 — Temporal Aggregation (per device)

Instead of exposing raw instantaneous readings, the engine maintains a **sliding window** of the last **N** values per individual device and computes their arithmetic mean to smooth out spikes.

- Window size is controlled by `ANON_WINDOW_SIZE` (default `5`).
- Implemented as a pure function `temporalAggregate()` in `AnonymisationEngine.ts`.

#### Step 2 — Intra-Home Aggregation (per home)

For each home (`homeId`), the engine aggregates the smoothed values of all active devices in that home (regardless of the room they are in) and computes their mean. 

- This produces a single consolidated value for the entire home.
- **Critical Guarantee**: This home-level value is kept strictly internal and is never published or exposed outside the gateway.

#### Step 3 — K-Anonymity (per zone)

For each zone (`zoneId`), the engine collects the aggregated values of all active homes in that zone. The zone-level average is calculated and published **only if** at least **K** distinct homes in that zone have contributed a value.

- If the number of active homes in the zone is less than K: the data is **withheld** (not published) and a `[K-ANONYMITY]` log is emitted.
- If K is reached: the engine computes the average of the active homes' values.
- Threshold controlled by `ANON_K_THRESHOLD` (default `2`).

> **Demo tip**: With the default devices and K=2, if only the devices in `house-1` report, the zone data is withheld. Once the device in `house-2` reports, K=2 is met and the zone-level data is published.

#### Step 4 — Gaussian Perturbation

To prevent reconstruction attacks on the zone aggregate, a random noise sample drawn from **N(0, σ²)** is added to the zone mean:

```
final_value = zone_mean + gaussian_noise(σ)
```

Noise is generated in pure TypeScript using the **Box-Muller transform**.

- Std deviation controlled by `ANON_SIGMA` (default `0.1`).

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `ANONYMIZATION_ENABLED` | `true` | Set to `false` to disable the pipeline and publish raw VirtualProfiles |
| `ANON_WINDOW_SIZE` | `5` | Temporal aggregation window size N (number of readings to average per device) |
| `ANON_K_THRESHOLD` | `2` | Minimum number of active homes per zone required to publish |
| `ANON_SIGMA` | `0.1` | Standard deviation σ of the Gaussian noise added to the zone aggregate |

Example — run with K=1 to publish immediately with a single home:
```bash
ANON_K_THRESHOLD=1 npm start -w runtime
```

### Device Configuration (Home & Zone Mapping)

Static mapping of devices to their respective home and zone is defined in `src/anonymisation/DeviceGroupConfig.ts`:

```ts
export const DEFAULT_DEVICE_GROUPS: DeviceGroupMap = {
    "chariot-temp-sensor": { homeId: "house-1", zoneId: "quartier-nord" },
    "zigbee-temp-01":      { homeId: "house-1", zoneId: "quartier-nord" },
    "thread-temp-01":      { homeId: "house-2", zoneId: "quartier-nord" },
};
```

Any device not listed falls back to the `"default"` group.

### Unit Tests

Run the standalone unit tests (no test framework required):
```bash
cd runtime
npm run build          # compile TypeScript
node dist/tests/anonymisation.test.js
```

---

## Installation and Execution

### Step 1: Start the virtual Matter sensor
In a dedicated terminal at the root of the monorepo:
```bash
npm start -w devices
```

### Step 2: Start the Runtime (Gateway)
In another terminal at the root of the monorepo:
```bash
npm run build -w runtime
npm start -w runtime
```

## Demo and Consent Simulation

To facilitate oral demonstrations, the runtime includes a dynamic user-consent simulator:
1. **For the first 15 seconds**: Temperature sensor data is authorized, mapped, encrypted, and published to the MQTT broker.
2. **After 15 seconds**: The system dynamically revokes consent for the `temperature` data type.
3. **Subsequent updates**: Raw readings received from the Matter driver are immediately blocked by the `DataAccess` layer, showing clear denial logs in the console.

## MQTT Verification and Monitoring

You can verify the published data on the broker using an MQTT client (like MQTT X) or the built-in listening script.

### Quick Listening Script (`listen.js`)
A simple listening script is provided in the gateway package. To run it in a third terminal:
```bash
node runtime/dist/listen.js
```
It will display the raw encrypted payloads received on the broker in real-time and decrypt them using the derived key to demonstrate the correctness of the end-to-end encryption.
