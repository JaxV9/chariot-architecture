/**
 * @file SecurityMockDriver.ts
 * @description Simulated device driver for building security status events (normal/door_open/alarm_triggered).
 */

import { DeviceDriver, RawReading } from "./DeviceDriver.js";

export class SecurityMockDriver implements DeviceDriver {
    readonly id: string;
    readonly protocol: "matter" | "zigbee" | "thread";
    private intervalId?: NodeJS.Timeout;
    private onRawDataCallback?: (reading: RawReading) => void;

    constructor(id: string, protocol: "zigbee" | "thread") {
        this.id = id;
        this.protocol = protocol;
    }

    /**
     * Starts the periodic building security events generator.
     */
    async start(): Promise<void> {
        console.log(`\x1b[34m[DRIVER Security Mock] Starting security driver for ${this.id} (${this.protocol.toUpperCase()})...\x1b[0m`);

        this.intervalId = setInterval(() => {
            const rand = Math.random();
            let status = "normal";

            // Mostly "normal" status to remain realistic
            if (rand > 0.98) {
                status = "alarm_triggered";
            } else if (rand > 0.94) {
                status = "door_open";
            }

            this.emitReading(status);
        }, 5000 + Math.random() * 3000); // 5 to 8 second interval
    }

    /**
     * Stops the mock generator.
     */
    async stop(): Promise<void> {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = undefined;
        }
        console.log(`\x1b[32m[DRIVER Security Mock] Security driver for ${this.id} stopped.\x1b[0m`);
    }

    /**
     * Registers the raw reading callback.
     */
    onRawData(callback: (reading: RawReading) => void): void {
        this.onRawDataCallback = callback;
    }

    /**
     * Emits a raw reading to the upstream gateway pipeline.
     */
    private emitReading(value: string): void {
        if (this.onRawDataCallback) {
            this.onRawDataCallback({
                deviceId: this.id,
                protocol: this.protocol,
                cluster: "security",
                attribute: "value",
                value: value,
            });
        }
    }
}
