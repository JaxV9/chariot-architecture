# CHARIOT IoT Middleware Monorepo

This project is a Node.js & TypeScript monorepo implementing an adapted version of the **CHARIOT** IoT middleware (inspired by *"CHARIOT: An IoT Middleware for the Integration of Heterogeneous Entities in a Smart Urban Factory"*, Akpolat et al., 2017). 

This adaptation bridges smart home/building data (e.g., Matter, Zigbee, Thread) to smart city services to enhance urban energy and environmental resilience.

---

## 🏗️ Architecture

The architecture consists of four main layers:

```
[Devices Layer] → [Runtime Layer] → [Communication Layer] → [Services Layer]
```

1. **`devices/`**: Simulates local smart home devices using various protocols (e.g., Matter via `@matter/main`, Zigbee/Thread mocked payloads).
2. **`runtime/`**: The local edge gateway. It connects to devices, maps raw data to normalized virtual profiles (**Profile Property Identifier**), encrypts data (AES-256-GCM), and publishes it to a local MQTT Message Bus.
3. **`communication/`**: The cloud middleware. It subscribes to the MQTT Message Bus and stores the latest virtual profiles in Redis (Directory Services).
4. **`services/`**: Exposes a public REST API for smart city services to query the virtual profile data, applying anonymization/privacy techniques before exposing data.

---

## 🛠️ Prerequisites

- **Node.js**: `>= 18.0.0`
- **npm**: Compatible with workspaces
- **GNU Make**: For simplified task execution

---

## 🚀 Getting Started

We provide a root-level `Makefile` to quickly build and run the core components of the project.

### 1. Install Dependencies
Install all package dependencies across all workspaces:
```bash
make install
```

### 2. Build the Project
Compile the TypeScript files for the workspaces:
```bash
make build
```

### 3. Running the Architecture

#### Run Simulated Devices
To start the simulated home/building devices:
```bash
make run-devices
```

#### Run Gateway Runtime
To start the local gateway runtime:
```bash
make run-runtime
```

---

## 📜 Available Commands

You can see all available shortcuts by running `make` or `make help`:

| Command | Description |
|---|---|
| `make install` | Install workspace-wide npm dependencies |
| `make build` | Build all TypeScript workspaces (`devices` and `runtime`) |
| `make build-devices` | Build the simulated `devices` workspace |
| `make build-runtime` | Build the edge `runtime` gateway |
| `make run-devices` | Build and run simulated devices |
| `make run-runtime` | Build and run the edge gateway |
| `make clean` | Remove compiler outputs (`dist` folders) |
