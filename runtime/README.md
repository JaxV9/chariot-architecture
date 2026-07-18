# Local Gateway (Runtime Environment) - CHARIOT

This package contains the implementation of the **Runtime** (Local Gateway) layer of the CHARIOT project.

## Role and Internal Pipeline

The gateway runs locally at the edge (one instance per house/building) and processes smart home sensor data end-to-end through the following pipeline:

1. **Embedded Broker**: Optionally starts an embedded MQTT broker (Aedes) on local port `1883` (controlled by `START_BROKER`).
2. **Drivers (Matter & Mock)**: Connects to physical/virtual Matter sensors or simulates Zigbee/Thread sensor readings.
3. **Protocol Support**: An abstraction layer unifying event reception from all protocol-specific drivers.
4. **Data Access**: User consent compliance checker (Data Act). If the user does not authorize a specific data type, transmission is aborted.
5. **Devices Mapping**: Normalizes raw sensor readings into a standardized Virtual Profile format resemblance of `{ deviceId, type, unit, value, timestamp }`.
6. **Aggregation Engine**: Performs local gateway-level processing:
   - **Temporal Aggregation**: Sliding window average of the last **N** values per individual device to smooth out spikes.
   - **Intra-Home Aggregation**: Averages the latest smoothed values of all devices of the same data type within the home.
7. **Data Encryption**: AES-256-GCM encryption of the local aggregate. Key derived using `crypto.scryptSync`.
8. **Mqtt Publisher**: Publishes the encrypted payload to the MQTT broker on the topic `chariot/zones/{zoneId}`.

---

## Local Aggregation Pipeline

A two-step local aggregation pipeline is implemented in `src/anonymisation/AnonymisationEngine.ts`.
It transforms device-specific profiles into a home-level aggregate profile:

```
VirtualProfile  { deviceId, type, unit, value, timestamp }
      ↓  AnonymisationEngine (runtime)
HomeAggregateProfile { homeId, zoneId, type, unit, value, timestamp }
```

### Core Privacy Principle

**No data per room, nor per individual device, is ever exposed outside the local gateway.**
The gateway only publishes a single aggregated value per data type for the home, tagged with its `homeId` and geographical `zoneId`.

### Supported Data Types
1. **Temperature (`celsius`)**: Standard environmental reading.
2. **Energy Consumption (`kWh`)**: Measures power usage. While temperature is relatively low-sensitivity, energy usage is highly sensitive as it reveals intimate occupancy patterns, appliance usage, and resident habits. Aggregating energy consumption locally (intra-home) and applying K-anonymity plus Gaussian noise on the communication layer ensures smart grid utility without revealing individual household behaviors.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `HOME_ID` | `house-1` | Identifier of this home instance (e.g. `house-1`, `house-2`) |
| `ZONE_ID` | `quartier-nord` | Geographical zone identifier shared by multiple homes |
| `START_BROKER` | `true` | Set to `false` to prevent launching a local MQTT broker conflict on port 1883 |
| `DEVICE_IDS` | *(dynamic)* | Comma-separated list of devices to drive (e.g., `matter-temp-01,zigbee-temp-01`) |
| `ANONYMIZATION_ENABLED` | `true` | Set to `false` to disable local aggregation |
| `ANON_WINDOW_SIZE` | `5` | Sliding window size N for temporal smoothing |

---

## Multiple Homes Simulation

To simulate multiple houses reporting to the same zone, start multiple runtime instances in parallel with different configurations:

```bash
# House 1 (starts the Aedes MQTT broker)
START_BROKER=true HOME_ID=house-1 ZONE_ID=quartier-nord DEVICE_IDS=matter-temp-01,zigbee-temp-01 npm start -w runtime

# House 2 (connects to the Aedes broker of House 1)
START_BROKER=false HOME_ID=house-2 ZONE_ID=quartier-nord DEVICE_IDS=thread-temp-01 npm start -w runtime
```
