# CHARIOT - Services Layer (REST API)

The **services** layer exposes the public REST API for the CHARIOT architecture. It runs an Express HTTP server, starts the internal communication subscriber (MQTT client) to receive and decrypt virtual profiles from the runtime gateway, and maintains the in-memory Directory Services data.

Tier services (such as Smart City platforms) can query this API to read real-time device updates or access historical readings.

## Architectural Role

```
[Devices Layer] -> [Runtime Gateway] --(MQTT Encrypted)--> [Services Process]
                                                           |-- (Internal Subscriber) -> DirectoryService
                                                           |-- (Express API Server)   -> Smart City REST requests
```

---

## Configuration

The services layer is configured via environment variables:

| Environment Variable | Description | Default Value |
|----------------------|-------------|---------------|
| `PORT` | HTTP Port for the REST API server | `3000` |
| `CHARIOT_API_TOKEN` | Static security token for MVP Zero Trust API protection | `chariot-test-token` |

---

## Getting Started

### Prerequisites

Ensure the monorepo dependencies are installed at the workspace root:
```bash
make install
```

### Building the Package

Compile TypeScript files:
```bash
npm run build -w services
```

### Running the Services Layer

Start the REST API and the internal subscriber:
```bash
npm run start -w services
```

---

## API Reference

All requests to the `/devices` endpoints must include the authentication token. It can be passed via the `Authorization` header as a Bearer token or as a `token` URL query parameter.

### 1. Health Check
Checks if the Express server is running. (Does not require authentication).

- **URL**: `/health`
- **Method**: `GET`
- **Success Response (200 OK)**:
  ```json
  {
    "status": "UP",
    "uptime": 1.23,
    "timestamp": "2026-07-12T13:30:00.000Z",
    "service": "chariot-services-layer"
  }
  ```
- **Example request**:
  ```bash
  curl http://localhost:3000/health
  ```

---

### 2. List All Devices
Lists all device identifiers currently stored in Directory Services.

- **URL**: `/devices`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer chariot-test-token`
- **Success Response (200 OK)**:
  ```json
  [
    "matter-temp-sensor-1",
    "zigbee-humidity-sensor"
  ]
  ```
- **Example request**:
  ```bash
  curl -H "Authorization: Bearer chariot-test-token" http://localhost:3000/devices
  ```

---

### 3. Get Device Latest Profile
Retrieves the most recent normalized virtual profile for a specific device.

- **URL**: `/devices/:id`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer chariot-test-token`
- **Success Response (200 OK)**:
  ```json
  {
    "deviceId": "matter-temp-sensor-1",
    "type": "temperature",
    "unit": "celsius",
    "value": 22.4,
    "timestamp": "2026-07-12T13:30:05.123Z"
  }
  ```
- **Error Response (404 Not Found)**:
  ```json
  {
    "error": "Not Found",
    "message": "Device 'non-existent-device' not found in Directory Services."
  }
  ```
- **Example request**:
  ```bash
  curl -H "Authorization: Bearer chariot-test-token" http://localhost:3000/devices/matter-temp-sensor-1
  ```

---

### 4. Get Device Reading History
Retrieves the rolling history (up to last 10 readings) for a specific device, from newest to oldest.

- **URL**: `/devices/:id/history`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer chariot-test-token`
- **Success Response (200 OK)**:
  ```json
  [
    {
      "deviceId": "matter-temp-sensor-1",
      "type": "temperature",
      "unit": "celsius",
      "value": 22.4,
      "timestamp": "2026-07-12T13:30:05.123Z"
    },
    {
      "deviceId": "matter-temp-sensor-1",
      "type": "temperature",
      "unit": "celsius",
      "value": 22.1,
      "timestamp": "2026-07-12T13:29:50.123Z"
    }
  ]
  ```
- **Example request**:
  ```bash
  curl -H "Authorization: Bearer chariot-test-token" http://localhost:3000/devices/matter-temp-sensor-1/history
  ```
