# CHARIOT IoT Middleware Monorepo

This project is a Node.js & TypeScript monorepo implementing an adapted version of the **CHARIOT** IoT middleware (inspired by *"CHARIOT: An IoT Middleware for the Integration of Heterogeneous Entities in a Smart Urban Factory"*, Akpolat et al., 2017).

This adaptation bridges smart home/building data (e.g., Matter, Zigbee, Thread) to smart city services to enhance urban energy and environmental resilience.

---

## 🏗️ Architecture

The architecture consists of four main layers implemented as distinct npm workspaces:

```
[Devices Layer] → [Runtime Layer] → [Communication Layer] → [Services Layer]
```

1. **`devices/` (Hardware/Protocol Simulation)**:
   - Simulates local smart home devices.
   - Implements a virtual **Matter** Temperature Sensor using `@matter/main` that exposes the standard `Temperature Measurement` cluster and outputs pairing credentials (QR code / Passcode).
   - Simulates realistic indoor temperature readings using a random walk algorithm.
   - Provides hooks for mock Zigbee/Thread payloads.

2. **`runtime/` (Local Edge Gateway)**:
   - Starts an embedded **MQTT broker (Aedes)** on local port `1883`.
   - Connects to the virtual Matter device via the Matter driver, subscribes to raw temperature updates, and feeds them into the processing pipeline.
   - Implements **Data Access** checks (user consent compliance for the Data Act) where data types can be blocked dynamically.
   - Normalizes raw sensor readings into standard **Virtual Profiles (Profile Property Identifier)**: `{ deviceId, type, unit, value, timestamp }`.
   - Performs **AES-256-GCM encryption** of virtual profiles using a cryptographically derived key.
   - Publishes the encrypted payload to the local broker on the topic `chariot/devices/{deviceId}`.

3. **`communication/` (Cloud Middleware)**:
   - Contains the core middleware components (Message Bus Subscriber, Directory Services, and Message Formats validation).
   - Subscribes to `chariot/devices/+` on the message bus.
   - Decrypts payloads using AES-256-GCM and validates message structures against predefined schemas.
   - Implements **Directory Services** using an in-memory storage manager that maintains the latest device states and a rolling history of the last 10 readings per device.

4. **`services/` (Exposition / REST API Layer)**:
   - Runs an **Express HTTP server** (default port `3000`).
   - Automatically initializes the internal MQTT subscriber to listen for gateway updates and populate the Directory Services store.
   - Secures API endpoints with a Zero Trust static token verification system (`CHARIOT_API_TOKEN`).
   - Exposes REST endpoints for smart city applications to read current device states and history.

---

## 🛠️ Prerequisites

- **Node.js**: `>= 18.0.0`
- **npm**: Compatible with workspaces
- **GNU Make**: For simplified task execution

---

## 🚀 Getting Started

We provide a root-level `Makefile` to quickly build, run, and test the entire architecture.

### 1. Install Dependencies
Install all package dependencies across all workspaces:
```bash
make install
```

### 2. Build the Project
Compile the TypeScript files for all workspaces (`devices`, `runtime`, `communication`, `services`):
```bash
make build
```

### 3. Run the End-to-End Demo
To launch the full pipeline concurrently (simulated devices + runtime gateway + services layer API):
```bash
make demo
```
This target:
1. Clears any cached Matter state.
2. Starts the virtual **Matter Device**.
3. Starts the **Runtime Gateway** after a short delay (subscribing to the Matter device and hosting the MQTT broker).
4. Starts the **Services API Server** after a short delay (listening on port `3000` and subscribing to the MQTT broker).

To stop all demo background processes, run:
```bash
make stop-demo
```

---

## 📜 Available Commands

You can see all available shortcuts by running `make` or `make help`:

| Command | Description |
|---|---|
| `make install` | Install workspace-wide npm dependencies |
| `make build` | Build all workspaces (`devices`, `runtime`, `communication`, `services`) |
| `make build-devices` | Build the simulated `devices` workspace |
| `make build-runtime` | Build the edge `runtime` gateway |
| `make build-services` | Build the REST API and internal subscriber |
| `make run-devices` | Run the simulated devices |
| `make run-runtime` | Run the edge gateway |
| `make run-services` | Run the Express REST API and MQTT subscriber |
| `make demo` | Launch the full end-to-end demo concurrently |
| `make stop-demo` | Stop all processes spawned by the demo target |
| `make clean` | Remove all compiled build outputs (`dist` folders) |

---

## 🔍 End-to-End Verification

Once the demo is running (`make demo`), you can observe the logs and query the Services API to see the complete message flow:

1. **Matter Discovery**: The device log shows Matter commissioning credentials, followed by temperature readings.
2. **Gateway Pipeline**: The gateway connects to the Matter device, extracts temperature measurements, passes them through the Data Access policy, maps them into virtual profiles, encrypts them, and publishes them.
3. **Data Access Consent Simulation**:
   - For the first **15 seconds**, data is allowed and published.
   - After **15 seconds**, the gateway dynamically revokes consent for `temperature`, blocking further data transmission with log entries: `[DATA ACCESS] [DENIED] ...`.
4. **Middleware & API Processing**: The services layer subscriber receives the encrypted message, decrypts it, validates it, and saves it into the Directory Services database.

### Querying the Services REST API

The services API is protected by a static token. The default token is `chariot-test-token`.

#### 1. Check Health
Verify the Express server is running (does not require authentication):
```bash
curl http://localhost:3000/health
```

#### 2. List All Devices
Retrieve the list of active devices registered in the Directory Services:
```bash
curl -H "Authorization: Bearer chariot-test-token" http://localhost:3000/devices
```
*Expected Response:*
```json
["chariot-temp-sensor"]
```

#### 3. Get Latest Device Virtual Profile
Get the latest decrypted and mapped state for a device:
```bash
curl -H "Authorization: Bearer chariot-test-token" http://localhost:3000/devices/chariot-temp-sensor
```
*Expected Response:*
```json
{
  "deviceId": "chariot-temp-sensor",
  "type": "temperature",
  "unit": "celsius",
  "value": 20.15,
  "timestamp": "2026-07-12T13:31:07.000Z"
}
```

#### 4. Get Device Reading History
Fetch the rolling history (up to last 10 entries) for the device:
```bash
curl -H "Authorization: Bearer chariot-test-token" http://localhost:3000/devices/chariot-temp-sensor/history
```
*Expected Response:*
```json
[
  {
    "deviceId": "chariot-temp-sensor",
    "type": "temperature",
    "unit": "celsius",
    "value": 20.15,
    "timestamp": "2026-07-12T13:31:07.000Z"
  },
  {
    "deviceId": "chariot-temp-sensor",
    "type": "temperature",
    "unit": "celsius",
    "value": 20.02,
    "timestamp": "2026-07-12T13:31:02.000Z"
  }
]
```
