# Matter Temperature Sensor Simulator

This package implements a virtual Matter-compatible Temperature Sensor device using `@matter/main`. It simulates realistic indoor temperature readings using a random walk algorithm.

## Features

- **Standard Matter Cluster**: Exposes the `Temperature Measurement` cluster.
- **Commissionable Node**: Runs a Matter server that outputs a pairing QR code and manual pairing passcode on start.
- **Dynamic Simulation**: Simulates temperature values fluctuating around 20°C (between 16°C and 26°C), updated every 5 to 10 seconds.
- **Clear Console Logging**: Outputs logs on initialization, startup, and state changes.

## Prerequisites

- Node.js (version 18 or higher)
- npm

## How to Run

1. **Install Dependencies**: Make sure you have installed the project-wide dependencies. From the root directory, run:
   ```bash
   npm install
   ```

2. **Build the Package**: Compile the TypeScript files:
   ```bash
   npm run build -w devices
   ```

3. **Start the Device**: Run the compiled sensor:
   ```bash
   npm start -w devices
   ```

## Commissioning / Pairing

When you launch the device, `matter.js` will output a QR code and pairing codes in the terminal.

- **Passcode**: `20202021`
- **Discriminator**: `3840`
- **Port**: `5540` (UDP/TCP)

You can pair this virtual device with any Matter-compliant controller (e.g., Apple Home, Google Home, Home Assistant, or SmartThings) by scanning the QR code or manually entering the passcode.
