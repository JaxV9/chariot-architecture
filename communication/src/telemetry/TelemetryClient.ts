/**
 * @file TelemetryClient.ts
 * @description Optional WebSocket client that emits telemetry events to the dashboard server.
 *
 * Design principles:
 *   - Fully optional: activated only when TELEMETRY_ENABLED=true.
 *   - Completely decoupled from the main MQTT pipeline (Aedes broker on port 1883).
 *   - Fire-and-forget: emit() never throws or blocks — all errors are caught silently.
 *   - Auto-reconnect with exponential back-off if the dashboard server is not running.
 *   - If TELEMETRY_ENABLED is not "true", this module is a complete no-op.
 */

import { WebSocket } from "ws";

/** Base shape for all telemetry events. */
export interface TelemetryEvent {
    layer: "devices" | "runtime" | "communication";
    timestamp: string;
    [key: string]: unknown;
}

/** Telemetry server WebSocket URL (dashboard server, separate from Aedes :1883). */
const TELEMETRY_WS_URL = process.env.TELEMETRY_WS_URL ?? "ws://localhost:4001";

/** Maximum reconnection delay in milliseconds. */
const MAX_RECONNECT_DELAY_MS = 30_000;

/**
 * Lightweight WebSocket client for optional telemetry emission.
 * Instantiate once and call emit() freely — all errors are handled internally.
 */
export class TelemetryClient {
    private ws: WebSocket | null = null;
    private enabled: boolean;
    private reconnectDelay = 1_000;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private stopped = false;

    constructor() {
        this.enabled = (process.env.TELEMETRY_ENABLED ?? "false") === "true";
        if (this.enabled) {
            this.connect();
        }
    }

    /** Attempts to open a WebSocket connection to the telemetry server. */
    private connect(): void {
        if (this.stopped) return;

        try {
            this.ws = new WebSocket(TELEMETRY_WS_URL);

            this.ws.on("open", () => {
                console.log(`[TELEMETRY] Connected to telemetry server at ${TELEMETRY_WS_URL}`);
                this.reconnectDelay = 1_000;
            });

            this.ws.on("error", () => {
                // Silently ignore — will be followed by a "close" event triggering reconnect
            });

            this.ws.on("close", () => {
                if (this.stopped) return;
                console.log(`[TELEMETRY] Disconnected from telemetry server. Reconnecting in ${this.reconnectDelay}ms...`);
                this.scheduleReconnect();
            });
        } catch {
            this.scheduleReconnect();
        }
    }

    /** Schedules a reconnection attempt with exponential back-off. */
    private scheduleReconnect(): void {
        if (this.reconnectTimer) return;
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, this.reconnectDelay);
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
    }

    /**
     * Emits a telemetry event to the dashboard server.
     * Fire-and-forget: never throws, never blocks.
     *
     * @param event - The telemetry event payload to send.
     */
    emit(event: TelemetryEvent): void {
        if (!this.enabled) return;

        try {
            if (this.ws?.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify(event));
            }
        } catch {
            // Never propagate errors to the caller
        }
    }

    /**
     * Gracefully closes the telemetry connection.
     * Call during process shutdown to avoid dangling reconnect timers.
     */
    close(): void {
        this.stopped = true;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        try {
            this.ws?.close();
        } catch {
            // Ignore
        }
    }
}
