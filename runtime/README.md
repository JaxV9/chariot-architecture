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
SiteAggregateProfile { siteId, siteType, homeId, zoneId, type, unit, value, timestamp }
```

### Core Privacy Principle

**No data per room, nor per individual device, is ever exposed outside the local gateway.**
The gateway only publishes a single aggregated value per data type for the site, tagged with its `siteId`, `siteType`, and geographical `zoneId`.

### Supported Data Types
1. **Temperature (`celsius`)**: Standard environmental reading (Home specific).
2. **Energy Consumption (`kWh`)**: Measures power usage (Home specific).
3. **Presence/Occupation (`percent`)**: Diurnal building occupancy levels (Building specific).
4. **Security Events (`frequency`)**: Calculates security anomaly frequency (0 for normal, 1 for alert; Building specific).
5. **Air Quality (`ppm`)**: CO2 ppm levels, correlated with office hours occupancy (Building specific).

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `SITE_ID` / `HOME_ID` | `house-1` | Identifier of this site instance (e.g. `house-1`, `building-1`) |
| `SITE_TYPE` | `home` | Type of the site, either `home` or `building` |
| `ZONE_ID` | `quartier-nord` | Geographical zone identifier shared by multiple sites |
| `START_BROKER` | `true` | Set to `false` to prevent launching a local MQTT broker conflict on port 1883 |
| `DEVICE_IDS` | *(dynamic)* | Comma-separated list of devices to drive |
| `ANONYMIZATION_ENABLED` | `true` | Set to `false` to disable local aggregation |
| `ANON_WINDOW_SIZE` | `5` | Sliding window size N for temporal smoothing |

---

## Multiple Sites Simulation

To simulate multiple houses and buildings reporting to the same zone, start multiple runtime instances in parallel with different configurations:

```bash
# House 1 (starts the Aedes MQTT broker)
START_BROKER=true SITE_ID=house-1 SITE_TYPE=home ZONE_ID=quartier-nord DEVICE_IDS=matter-temp-01,zigbee-temp-01 npm start -w runtime

# House 2 (connects to the Aedes broker of House 1)
START_BROKER=false SITE_ID=house-2 SITE_TYPE=home ZONE_ID=quartier-nord DEVICE_IDS=thread-temp-01 npm start -w runtime

# Building 1 (connects to House 1 broker, simulates building sensors)
START_BROKER=false SITE_ID=building-1 SITE_TYPE=building ZONE_ID=quartier-nord DEVICE_IDS=zigbee-occupancy-01,zigbee-security-01,thread-airquality-01 npm start -w runtime
```
