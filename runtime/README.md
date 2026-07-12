# Local Gateway (Runtime Environment) - CHARIOT

This package contains the implementation of the **Runtime** (Local Gateway) layer of the CHARIOT project.

## Role and Internal Pipeline

The gateway runs locally at the edge and processes smart home sensor data end-to-end through the following pipeline:

1. **Embedded Broker**: Starts an embedded MQTT broker (Aedes) on local port `1883`.
2. **Drivers (Matter)**: Connects to the virtual Matter temperature sensor (running on port `5540`), subscribes to its raw temperature measurements, and feeds them into the pipeline.
3. **Protocol Support**: An abstraction layer unifying event reception from all protocol-specific drivers.
4. **Data Access**: User consent compliance checker (Data Act). If the user does not authorize a specific data type, transmission is aborted immediately.
5. **Devices Mapping**: Normalizes raw sensor readings into a standardized Virtual Profile format (**Profile Property Identifier**) resembling `{ deviceId, type, unit, value, timestamp }`. The mapping logic scales the raw Matter temperature value down by 100 (in compliance with Matter Temperature Measurement cluster specifications).
6. **Data Encryption**: AES-256-GCM encryption of the virtual profile. The 32-byte key is derived using the native Node.js `crypto.scryptSync` cryptographic function.
7. **Mqtt Publisher**: Publishes the encrypted payload to the local Aedes broker on the topic `chariot/devices/{deviceId}`.

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
