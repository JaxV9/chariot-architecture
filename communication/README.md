# CHARIOT - Communication Layer (Cloud Middleware)

The **communication** layer represents the cloud middleware of the CHARIOT architecture. It functions as the bridge between the local gateway (runtime environment) and the REST API exposition layer (services).

## Architectural Role

```
[Devices Layer] -> [Runtime Gateway] --(MQTT Encrypted Home Aggregate)--> [Communication Layer] -> [Services Layer] -> [Smart City APIs]
```

1. **Message Bus (Subscriber)**: Subscribes to the runtime's site aggregate topic on `chariot/zones/+`.
2. **Decryption**: Decrypts the incoming GCM-encrypted messages using the shared key.
3. **Message Formats**: Validates that the decrypted message adheres to the `SiteAggregateProfile` structure.
4. **Anonymisation Processor**: Performs the cloud-level privacy pipeline:
   - **K-Anonymity**: Tracks active site contributors per zone and siteType (with a 60-second inactivity timeout). Retains the data if the active site count is below **K**.
   - **Gaussian Perturbation**: Adds Box-Muller Gaussian noise ($\sigma$ configurable) to the zone/siteType average when the $K$ threshold is met.
5. **Directory Services (Storage)**: Stores the final perturbed `ZoneProfile` (keyed by `zoneId--siteType--type`) and a rolling history of the last 10 entries for each zone/type/siteType combination.

## Package Structure

- `src/bus/MessageBusSubscriber.ts`: Handles the MQTT subscription, message decryption, format validation, and K-anonymity / noise injection workflow.
- `src/anonymisation/AnonymisationProcessor.ts`: Core state manager for active sites, siteType-isolated K-anonymity checks, and Gaussian Box-Muller noise generation.
- `src/directory/DirectoryService.ts`: Stores zone profiles and 10-entry rolling histories. Keys are formatted as `zoneId--siteType--type` for safe REST URL routing.
- `src/formats/MessageFormats.ts`: Validates that incoming site aggregate profiles match the required schema.
- `src/security/Encryption.ts`: Decrypts messages using AES-256-GCM.
- `src/tests/anonymisation.test.ts`: Unit tests verifying K-anonymity limits, contributor deduplication, active site timeout, siteType isolation, security event frequency calculations, and Gaussian noise generation.
- `src/test-communication.ts`: Integration test suite verifying decrypted zones delivery, malformed data rejection, and rolling history bounds.

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

### Running the Unit Tests
Execute the K-anonymity and noise unit tests:
```bash
npx tsx communication/src/tests/anonymisation.test.ts
```

### Running the Integration Tests
The integration tests require an active MQTT broker. The easiest way to run the test suite is to first start the runtime environment (which hosts the embedded MQTT broker):

1. **Start the Runtime**:
   ```bash
   make run-runtime-house1
   ```

2. **Run the Tests** (in a separate terminal):
   ```bash
   npm run test -w communication
   ```
