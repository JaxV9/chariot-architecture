/**
 * @file EnergyMockDriver.ts
 * @description Simulated device driver for energy consumption (Zigbee/Thread) in secondary homes.
 */

import { DeviceDriver, RawReading } from "./DeviceDriver.js";

export class EnergyMockDriver implements DeviceDriver {
    readonly id: string;
    readonly protocol: "matter" | "zigbee" | "thread";
    private intervalId?: NodeJS.Timeout;
    private onRawDataCallback?: (reading: RawReading) => void;

    constructor(id: string, protocol: "zigbee" | "thread") {
        this.id = id;
        this.protocol = protocol;
    }

    /**
     * Starts the periodic energy consumption generator following a daily profile.
     */
    async start(): Promise<void> {
        console.log(`\x1b[34m[DRIVER Energy Mock] Starting simulated energy driver for ${this.id} (${this.protocol.toUpperCase()})...\x1b[0m`);

        this.intervalId = setInterval(() => {
            const hour = new Date().getHours();
            
            // Base hourly profile in kWh
            let baseConsumption = 0.25; // default night base load
            
            if (hour >= 7 && hour <= 9) {
                // Morning peak (breakfast, heating start, appliances)
                baseConsumption = 1.3;
            } else if (hour >= 18 && hour <= 21) {
                // Evening peak (cooking, TV, lighting, heating)
                baseConsumption = 1.9;
            } else if (hour >= 10 && hour <= 17) {
                // Mid-day active/passive base
                baseConsumption = 0.65;
            }

            // Add minor noise fluctuation to simulate active usage variation
            const fluctuation = (Math.random() - 0.5) * 0.15;
            const finalValue = Math.max(0.05, baseConsumption + fluctuation);

            this.emitReading(finalValue);
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
        console.log(`\x1b[32m[DRIVER Energy Mock] Simulated energy driver for ${this.id} stopped.\x1b[0m`);
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
                cluster: "energy_consumption",
                attribute: "value",
                value: Number(value.toFixed(3)),
            });
        }
    }
}
