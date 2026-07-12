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

A three-step GDPR privacy pipeline (`src/anonymisation/`) is inserted between **Devices Mapping** and **Data Encryption**.
When active, the output profile changes shape from a per-device `VirtualProfile` to an aggregated `GroupProfile`:

```
VirtualProfile  { deviceId, type, unit, value, timestamp }
      ↓  AnonymisationEngine
GroupProfile    { groupId,  type, unit, value, deviceCount, timestamp }
```

### Step 1 — Temporal Aggregation (per device)

Instead of exposing a raw instantaneous reading, the engine maintains a **sliding window** of the last **N** values per device and exposes their arithmetic mean. This reduces temporal precision and smooths out short-lived spikes.

- Window size controlled by `ANON_WINDOW_SIZE` (default `5`).
- Implemented as a pure function `temporalAggregate()` in `AnonymisationEngine.ts`.

### Step 2 — K-Anonymity (per group)

Each device belongs to a **logical zone** (e.g., `"living-room"`, `"office"`). The engine maintains one aggregate per group and only publishes when at least **K** distinct devices in that group have reported a recent value.

- If the group has fewer than K active devices → data is **withheld** and a `[K-ANONYMITY]` log is emitted.
- When K is reached → the engine computes the **group mean** and marks it as publishable.
- The published value cannot be traced back to a single device.
- Threshold controlled by `ANON_K_THRESHOLD` (default `2`).

> **Demo tip**: with a single Matter device and K=2, you will see the "data withheld" log on every reading.  
> Set `ANON_K_THRESHOLD=1` to observe the full publication path with one device.

### Step 3 — Gaussian Perturbation

A random noise sample drawn from **N(0, σ²)** is added to the group mean:

```
final_value = group_mean + gaussian_noise(σ)
```

Noise is generated in pure TypeScript using the **Box-Muller transform** — no external library required.

- Std deviation controlled by `ANON_SIGMA` (default `0.1`).

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `ANONYMIZATION_ENABLED` | `true` | Set to `false` to disable the pipeline and publish raw VirtualProfiles |
| `ANON_WINDOW_SIZE` | `5` | Temporal aggregation window size N (number of readings to average per device) |
| `ANON_K_THRESHOLD` | `2` | Minimum number of active devices per group required to publish |
| `ANON_SIGMA` | `0.1` | Standard deviation σ of the Gaussian noise added to the group aggregate |

Example — run with K=1 to publish immediately with a single device:
```bash
ANON_K_THRESHOLD=1 npm start -w runtime
```

### Device Group Configuration

Group membership is defined statically in `src/anonymisation/DeviceGroupConfig.ts`.
Add or change entries to assign devices to zones:

```ts
export const DEFAULT_DEVICE_GROUPS: DeviceGroupMap = {
    "chariot-temp-sensor": "living-room",  // real Matter device
    "zigbee-temp-01":      "living-room",  // mock Zigbee device, same zone
    "thread-temp-01":      "office",       // mock Thread device, different zone
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
