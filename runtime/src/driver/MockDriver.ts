/**
 * @file MockDriver.ts
 * @description Simulated device driver for generating sensor readings (Zigbee/Thread) in secondary homes.
 */

import { DeviceDriver, RawReading } from "./DeviceDriver.js";

export class MockDriver implements DeviceDriver {
    readonly id: string;
    readonly protocol: "matter" | "zigbee" | "thread";
    private intervalId?: NodeJS.Timeout;
    private onRawDataCallback?: (reading: RawReading) => void;

    constructor(id: string, protocol: "zigbee" | "thread") {
        this.id = id;
        this.protocol = protocol;
    }

    /**
     * Starts the periodic mock sensor readings generator.
     */
    async start(): Promise<void> {
        console.log(`\x1b[34m[DRIVER Mock] Starting simulated driver for ${this.id} (${this.protocol.toUpperCase()})...\x1b[0m`);
        let currentTemp = 20.0 + (Math.random() - 0.5) * 4.0; // random start temperature around 20°C

        this.intervalId = setInterval(() => {
            // Random walk temperature fluctuation (-0.2°C to +0.2°C)
            const delta = (Math.random() - 0.5) * 0.4;
            currentTemp += delta;

            // Clamp indoor temperature to a realistic range (16.0°C to 26.0°C)
            if (currentTemp < 16.0) currentTemp = 16.0;
            if (currentTemp > 26.0) currentTemp = 26.0;

            this.emitReading(currentTemp);
        }, 5000 + Math.random() * 3000); // randomize updates between 5-8 seconds
    }

    /**
     * Stops the mock generator.
     */
    async stop(): Promise<void> {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = undefined;
        }
        console.log(`\x1b[32m[DRIVER Mock] Simulated driver for ${this.id} stopped.\x1b[0m`);
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
    private emitReading(value: number): void {
        if (this.onRawDataCallback) {
            this.onRawDataCallback({
                deviceId: this.id,
                protocol: this.protocol,
                cluster: "temperature",
                attribute: "value",
                value: Number(value.toFixed(2)),
            });
        }
    }
}
