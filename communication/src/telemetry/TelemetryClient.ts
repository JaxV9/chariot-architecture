/**
 * @file TelemetryClient.ts
 * @description Optional WebSocket client that emits telemetry events to the dashboard server and receives live config updates.
 */

import { WebSocket } from "ws";

/** Base shape for all telemetry events. */
export interface TelemetryEvent {
    layer: "devices" | "runtime" | "communication" | "communication_decrypt" | "services";
    timestamp: string;
    [key: string]: unknown;
}

const TELEMETRY_WS_URL = process.env.TELEMETRY_WS_URL ?? "ws://localhost:4001";
const MAX_RECONNECT_DELAY_MS = 30000;

export class TelemetryClient {
    private ws: WebSocket | null = null;
    private enabled: boolean;
    private reconnectDelay = 1000;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private stopped = false;

    private onConfigUpdateListener: ((config: any) => void) | null = null;
    private onConnectListener: (() => void) | null = null;

    constructor() {
        this.enabled = (process.env.TELEMETRY_ENABLED ?? "false") === "true";
        if (this.enabled) {
            this.connect();
        }
    }

    /** Registers a callback for configuration updates received from the telemetry channel. */
    onConfigUpdate(listener: (config: any) => void): void {
        this.onConfigUpdateListener = listener;
    }

    /** Registers a callback triggered when telemetry is connected/reconnected. */
    onConnect(listener: () => void): void {
        this.onConnectListener = listener;
        if (this.ws?.readyState === WebSocket.OPEN) {
            try {
                listener();
            } catch {
                // ignore
            }
        }
    }

    private connect(): void {
        if (this.stopped) return;

        try {
            this.ws = new WebSocket(TELEMETRY_WS_URL);

            this.ws.on("open", () => {
                console.log(`[TELEMETRY] Connected to telemetry server at ${TELEMETRY_WS_URL}`);
                this.reconnectDelay = 1000;
                if (this.onConnectListener) {
                    try {
                        this.onConnectListener();
                    } catch {
                        // ignore
                    }
                }
            });

            this.ws.on("message", (data) => {
                try {
                    const raw = data.toString();
                    const msg = JSON.parse(raw);
                    if (msg.type === "update_config" && this.onConfigUpdateListener) {
                        this.onConfigUpdateListener(msg);
                    }
                } catch (err: any) {
                    console.error("[TELEMETRY] Error parsing message from dashboard:", err.message);
                }
            });

            this.ws.on("error", () => {
                // Silently ignore — close will handle reconnect
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
     */
    emit(event: TelemetryEvent): void {
        if (!this.enabled) return;

        try {
            if (this.ws?.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify(event));
            }
        } catch {
            // ignore
        }
    }

    close(): void {
        this.stopped = true;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        try {
            this.ws?.close();
        } catch {
            // ignore
        }
    }
}
