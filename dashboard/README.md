# CHARIOT Dashboard Server & Client

This package provides a real-time web-based visualization dashboard for the CHARIOT Smart Home middleware architecture.
It allows you to view raw sensor readings, trace the edge anonymisation pipeline, see group entries stored in directory services, poll the public service layer REST API, and visualize the spatial/hierarchical relationship of devices within homes and zones.

## Views

1. **Vue Live (Flow View)**: Sequential diagram of the layered architecture (Devices -> Runtime -> Communication -> Services).
2. **Vue Spatiale (Spatial View)**: Nested representation illustrating physical relationships (Zone -> Houses -> Devices) and their logical mapping to the cloud middleware and external API endpoints. It demonstrates:
   - **Local Aggregations**: Calculated real-time averages for each home runtime gateway (e.g. average temperature, average energy).
   - **K-Anonymity Verification**: Shows published/withheld status based on the configured K threshold of active houses in a zone.
   - **Gaussian Noise Injection**: Highlights the mathematical noise added (Box-Muller transform) to the final stored zone metrics.
   - **Zero-Trust REST endpoints**: Simulates the API layer requesting and exposing only anonymized zone metrics.
3. **Format des données**: Real-time representation of JSON payloads and AES-256-GCM encrypted strings flowing between layers.

## Design Architecture

1. **Dashboard Server** (`/dashboard`):
   - Express server listening on HTTP port `4000`.
   - Serves the compiled React/Vite client application.
   - Hosts a dedicated internal WebSocket intake server on port `4001` to ingest events from the runtime and communication packages.
   - Provides a REST proxy API to `/devices` (`http://localhost:3000`) with Zero Trust token authentication.

2. **Dashboard Client** (`/dashboard-client`):
   - Built with React, TypeScript, and Vite.
   - Connects to the dashboard WebSocket to stream and render real-time events.
   - Uses premium dark-themed vanilla CSS and custom flow animations.

## Decoupling & Isolation

- **Zero Coupling**: The telemetry WebSocket pipeline (intake on `:4001` and client on `:4000`) is fully separate from the main functional MQTT pipeline (Aedes broker on port `1883`).
- **Optional Activation**: Set `TELEMETRY_ENABLED=true` to allow the runtime and communication layers to connect to the telemetry server.
- **Fail-safe / Silent drop**: If the dashboard server is not running, telemetry clients in the middleware layers will fail silently without slowing down or disrupting MQTT message transmission.

## Lancement

To run the dashboard, add it to your start orchestration or run:
```bash
# Set environment variables and start
TELEMETRY_ENABLED=true npm run start -w dashboard
```
See the root Makefile commands for automated building and launching during `make demo`.
