/**
 * @file PresenceMockDriver.ts
 * @description Simulated device driver for building occupancy (percentage 0-100%).
 */

import { DeviceDriver, RawReading } from "./DeviceDriver.js";

export class PresenceMockDriver implements DeviceDriver {
    readonly id: string;
    readonly protocol: "matter" | "zigbee" | "thread";
    private intervalId?: NodeJS.Timeout;
    private onRawDataCallback?: (reading: RawReading) => void;

    constructor(id: string, protocol: "zigbee" | "thread") {
        this.id = id;
        this.protocol = protocol;
    }

    /**
     * Starts the periodic building occupancy generator following a diurnal pattern.
     */
    async start(): Promise<void> {
        console.log(`\x1b[34m[DRIVER Presence Mock] Starting presence driver for ${this.id} (${this.protocol.toUpperCase()})...\x1b[0m`);

        this.intervalId = setInterval(() => {
            const now = new Date();
            const hour = now.getHours();
            const day = now.getDay();
            const isWeekend = day === 0 || day === 6;

            let baseOccupancy = 0; // occupancy percentage (0-100)

            if (isWeekend) {
                // Low baseline weekend activity
                baseOccupancy = 2.0 + Math.random() * 3.0; // 2-5% occupancy
            } else {
                // Weekday office hourly profile
                if (hour >= 8 && hour < 9) {
                    baseOccupancy = 40.0; // morning arrival
                } else if (hour >= 9 && hour < 12) {
                    baseOccupancy = 85.0; // morning peak occupancy
                } else if (hour >= 12 && hour < 14) {
                    baseOccupancy = 60.0; // lunch dip
                } else if (hour >= 14 && hour < 17) {
                    baseOccupancy = 85.0; // afternoon peak occupancy
                } else if (hour >= 17 && hour < 18) {
                    baseOccupancy = 45.0; // departure period
                } else {
                    baseOccupancy = 3.0 + Math.random() * 4.0; // night hours baseline
                }
            }

            // Fluctuations to simulate dynamic movement
            const fluctuation = (Math.random() - 0.5) * 6.0;
            const finalValue = Math.max(0.0, Math.min(100.0, baseOccupancy + fluctuation));

            this.emitReading(finalValue);
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
        console.log(`\x1b[32m[DRIVER Presence Mock] Presence driver for ${this.id} stopped.\x1b[0m`);
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
                cluster: "occupancy",
                attribute: "value",
                value: Number(value.toFixed(2)),
            });
        }
    }
}
