/**
 * @file AirQualityMockDriver.ts
 * @description Simulated device driver for building air quality (CO2 levels in ppm).
 */

import { DeviceDriver, RawReading } from "./DeviceDriver.js";

export class AirQualityMockDriver implements DeviceDriver {
    readonly id: string;
    readonly protocol: "matter" | "zigbee" | "thread";
    private intervalId?: NodeJS.Timeout;
    private onRawDataCallback?: (reading: RawReading) => void;

    constructor(id: string, protocol: "zigbee" | "thread") {
        this.id = id;
        this.protocol = protocol;
    }

    /**
     * Starts the periodic air quality generator (CO2 ppm, correlated with office hours).
     */
    async start(): Promise<void> {
        console.log(`\x1b[34m[DRIVER AirQuality Mock] Starting air quality driver for ${this.id} (${this.protocol.toUpperCase()})...\x1b[0m`);

        this.intervalId = setInterval(() => {
            const now = new Date();
            const hour = now.getHours();
            const day = now.getDay();
            const isWeekend = day === 0 || day === 6;

            let baseCO2 = 400.0; // outdoor fresh air base load is 400 ppm

            if (isWeekend) {
                // Empty building remains clean
                baseCO2 = 400.0 + Math.random() * 50.0;
            } else {
                // Weekday office hours dynamic pattern (occupancy correlation)
                if (hour >= 8 && hour < 9) {
                    baseCO2 = 650.0;
                } else if (hour >= 9 && hour < 12) {
                    baseCO2 = 1000.0; // peak office activity
                } else if (hour >= 12 && hour < 14) {
                    baseCO2 = 800.0;  // lunch dip
                } else if (hour >= 14 && hour < 17) {
                    baseCO2 = 1100.0; // afternoon peak activity
                } else if (hour >= 17 && hour < 18) {
                    baseCO2 = 700.0;
                } else {
                    baseCO2 = 450.0 + Math.random() * 50.0; // evening/night baseline
                }
            }

            // Slight noise fluctuations
            const fluctuation = (Math.random() - 0.5) * 60.0;
            const finalValue = Math.max(350.0, baseCO2 + fluctuation);

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
        console.log(`\x1b[32m[DRIVER AirQuality Mock] Air quality driver for ${this.id} stopped.\x1b[0m`);
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
                cluster: "air_quality",
                attribute: "value",
                value: Number(value.toFixed(1)),
            });
        }
    }
}
