/**
 * @file index.ts
 * @description CHARIOT Dashboard server.
 *
 * Responsibilities:
 *   1. WebSocket telemetry hub (port 4001): receives events from runtime and
 *      communication layers, then fans them out to all connected browser clients.
 *   2. HTTP server (port 4000): serves the compiled React frontend (dashboard-client/dist)
 *      and exposes a REST proxy to the services layer API.
 *
 * Ports:
 *   - 4000 : HTTP (React frontend + REST proxy) + WebSocket upgrade for browser clients
 *   - 4001 : WebSocket telemetry intake (internal, from runtime/communication layers)
 *
 * The Aedes MQTT broker on port 1883 is never touched by this server.
 */

import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { WebSocketServer, WebSocket } from "ws";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const HTTP_PORT      = parseInt(process.env.DASHBOARD_PORT ?? "4000", 10);
const TELEMETRY_PORT = parseInt(process.env.TELEMETRY_PORT ?? "4001", 10);
const SERVICES_URL   = process.env.SERVICES_URL ?? "http://localhost:3000";
const SERVICES_TOKEN = process.env.CHARIOT_API_TOKEN ?? "chariot-test-token";

// Path to the compiled React frontend (dashboard-client/dist, sibling to dashboard/)
const CLIENT_DIST = path.resolve(__dirname, "../../dashboard-client/dist");

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------

const app = express();
app.use(express.json());

// Request logger
app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
        console.log(`[DASHBOARD] ${req.method} ${req.originalUrl} → ${res.statusCode} (${Date.now() - start}ms)`);
    });
    next();
});

/**
 * GET /health
 * Simple health-check endpoint.
 */
app.get("/health", (_req, res) => {
    res.json({ status: "UP", service: "chariot-dashboard", timestamp: new Date().toISOString() });
});

/**
 * GET /api/proxy/*
 * Transparent proxy to the services layer REST API.
 * Automatically injects the Zero Trust token header.
 */
app.get("/api/proxy/*", async (req, res) => {
    const targetPath = req.url.replace(/^\/api\/proxy/, "");
    const targetUrl  = `${SERVICES_URL}${targetPath}`;

    try {
        const upstream = await fetch(targetUrl, {
            headers: {
                "Authorization": `Bearer ${SERVICES_TOKEN}`,
                "Accept": "application/json",
            },
        });

        const body = await upstream.json();

        // Broadcast telemetry event for services layer
        try {
            broadcast(JSON.stringify({
                layer: "services",
                path: targetPath,
                status: upstream.status,
                responseBody: body,
                timestamp: new Date().toISOString()
            }));
        } catch (broadcastErr) {
            // Ignore broadcast failures
        }

        res.status(upstream.status).json(body);
    } catch (err) {
        console.error(`[DASHBOARD] Proxy error for ${targetUrl}:`, err);
        res.status(502).json({ error: "Bad Gateway", message: "Services layer is not reachable." });
    }
});

// Serve the compiled React frontend (production mode)
// Falls back to index.html for client-side routing (SPA)
app.use(express.static(CLIENT_DIST));
app.get("*", (_req, res) => {
    res.sendFile(path.join(CLIENT_DIST, "index.html"));
});

// ---------------------------------------------------------------------------
// HTTP server + WebSocket server for browser clients (port 4000)
// ---------------------------------------------------------------------------

const httpServer = http.createServer(app);

/** Set of WebSocket connections from browser clients. */
const browserClients = new Set<WebSocket>();
/** Set of WebSocket connections from backend telemetry clients (e.g. Runtime). */
const telemetryClients = new Set<WebSocket>();

const browserWss = new WebSocketServer({ server: httpServer });

browserWss.on("connection", (ws, req) => {
    browserClients.add(ws);
    console.log(`[DASHBOARD] Browser client connected (${req.socket.remoteAddress}). Total: ${browserClients.size}`);

    ws.on("message", (message) => {
        try {
            const raw = message.toString();
            const data = JSON.parse(raw);
            if (data.type === "update_config") {
                console.log(`[DASHBOARD] Forwarding config update to ${telemetryClients.size} telemetry client(s):`, data);
                for (const tClient of telemetryClients) {
                    if (tClient.readyState === WebSocket.OPEN) {
                        tClient.send(raw);
                    }
                }
            }
        } catch (err: any) {
            console.error("[DASHBOARD] Error processing browser message:", err.message);
        }
    });

    ws.on("close", () => {
        browserClients.delete(ws);
        console.log(`[DASHBOARD] Browser client disconnected. Total: ${browserClients.size}`);
    });

    ws.on("error", () => {
        browserClients.delete(ws);
    });
});

/**
 * Broadcasts a telemetry message to all connected browser clients.
 * Drops the message if no clients are connected.
 */
function broadcast(message: string): void {
    for (const client of browserClients) {
        if (client.readyState === WebSocket.OPEN) {
            try {
                client.send(message);
            } catch {
                browserClients.delete(client);
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Dedicated WebSocket server for telemetry intake (port 4001)
// Receives events from runtime and communication layer TelemetryClients.
// ---------------------------------------------------------------------------

const telemetryWss = new WebSocketServer({ port: TELEMETRY_PORT });

telemetryWss.on("listening", () => {
    console.log(`[DASHBOARD] Telemetry intake WebSocket server listening on ws://localhost:${TELEMETRY_PORT}`);
});

telemetryWss.on("connection", (ws, req) => {
    console.log(`[DASHBOARD] Telemetry emitter connected from ${req.socket.remoteAddress}`);
    telemetryClients.add(ws);

    ws.on("message", (data) => {
        try {
            const raw = data.toString();
            // Validate JSON before broadcasting
            JSON.parse(raw);
            broadcast(raw);
        } catch {
            // Malformed telemetry payload — discard silently
        }
    });

    ws.on("close", () => {
        telemetryClients.delete(ws);
        console.log(`[DASHBOARD] Telemetry emitter disconnected.`);
    });

    ws.on("error", () => {
        telemetryClients.delete(ws);
        // Ignore individual connection errors
    });
});

// ---------------------------------------------------------------------------
// Start HTTP server
// ---------------------------------------------------------------------------

httpServer.listen(HTTP_PORT, () => {
    console.log(`\n\x1b[36;1m===============================================================\x1b[0m`);
    console.log(`\x1b[36;1m         CHARIOT DASHBOARD SERVER RUNNING                     \x1b[0m`);
    console.log(`\x1b[36;1m===============================================================\x1b[0m`);
    console.log(`\x1b[36m  Dashboard UI    : http://localhost:${HTTP_PORT}\x1b[0m`);
    console.log(`\x1b[36m  Telemetry WS    : ws://localhost:${TELEMETRY_PORT}  (internal, from layers)\x1b[0m`);
    console.log(`\x1b[36m  REST proxy      : http://localhost:${HTTP_PORT}/api/proxy/ → ${SERVICES_URL}\x1b[0m`);
    console.log(`\x1b[36;1m===============================================================\x1b[0m\n`);
});

// Graceful shutdown
const shutdown = () => {
    console.log("\n[DASHBOARD] Shutting down...");
    httpServer.close();
    telemetryWss.close();
    process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
