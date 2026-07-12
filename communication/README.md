# CHARIOT - Communication Layer (Cloud Middleware)

The **communication** layer represents the cloud middleware of the CHARIOT architecture. It functions as the bridge between the local gateway (runtime environment) and the API exposition layer (service layer requests).

## Architectural Role

```
[Devices Layer] -> [Runtime Gateway] --(MQTT Encrypted)--> [Communication Layer] -> [Services Layer] -> [Smart City APIs]
```

1. **Message Bus (Subscriber)**: Subscribes to the runtime's local MQTT broker on `chariot/devices/+`.
2. **Decryption**: Decrypts the incoming GCM-encrypted messages using the shared key derived via `crypto.scryptSync`.
3. **Message Formats**: Validates and normalizes the incoming virtual profile structure.
4. **Directory Services (Storage)**: Stores the latest profile and a rolling history of the last 10 entries for each device.

## Design Decisions

- **In-Memory Directory Storage**: The Directory Service is implemented using a Node-native `Map`. This decision ensures zero external setup (no Redis server configuration or installation required for testing the MVP) and simplifies execution. Because the `services` layer will import this package in the same monorepo context, they run in the same process and share the same in-memory instance.
- **Robust Exception Boundary**: All message handling processes are encapsulated in distinct `try/catch` scopes. If a message contains invalid JSON, fails cryptographic decryption (wrong key/signature), or is structurally malformed, the subscriber logs the error and continues execution without crashing.

## Package Structure

- `src/bus/MessageBusSubscriber.ts`: Handles the MQTT subscription, message parsing, decryption stages, and error boundary.
- `src/directory/DirectoryService.ts`: Stores devices' latest profiles and a 10-entry rolling history.
- `src/formats/MessageFormats.ts`: Validates that incoming profiles match the required structure.
- `src/security/Encryption.ts`: Decrypts messages using AES-256-GCM.
- `src/test-communication.ts`: Comprehensive integration test suite verifying standard delivery, malformed data rejection, and rolling history bounds.
- `src/index.ts`: Exposes singleton accessors for other packages to consume, and includes a standalone subscriber mode.

## Getting Started

### Prerequisites
Make sure the workspace dependencies are fully installed at the root of the project:
```bash
make install
```

### Building the Package
Compile TypeScript files:
```bash
npm run build -w communication
```

### Running the Integration Tests
The integration tests require an active MQTT broker. The easiest way to run the test suite is to first start the runtime environment (which hosts the embedded MQTT broker):

1. **Start the Runtime**:
   ```bash
   make run-runtime
   ```

2. **Run the Tests** (in a separate terminal):
   ```bash
   npm run test -w communication
   ```

This will run `test-communication.ts`, which publishes valid/invalid payloads to MQTT, asserts successful decryption, asserts zero crashes on corrupted data, and validates the 10-item history limit.

### Standalone Production Run
If you wish to run the communication layer in listening mode manually:
```bash
npm run start -w communication
```
