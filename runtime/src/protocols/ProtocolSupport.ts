/**
 * @file ProtocolSupport.ts
 * @description Protocol support layer: manages and unifies all registered protocol drivers.
 */

import { DeviceDriver, RawReading } from "../driver/DeviceDriver.js";

export class ProtocolSupport {
    private drivers: Map<string, DeviceDriver> = new Map();
    private onDataCallback?: (reading: RawReading) => void;

    /**
     * Registers a driver with the protocol manager.
     */
    registerDriver(driver: DeviceDriver): void {
        this.drivers.set(driver.id, driver);
        
        // Redirect raw data from this driver to the unified callback
        driver.onRawData((reading) => {
            if (this.onDataCallback) {
                this.onDataCallback(reading);
            }
        });
        
        console.log(`\x1b[32m[PROTOCOL SUPPORT] Driver registered for device ${driver.id} (Protocol: ${driver.protocol.toUpperCase()})\x1b[0m`);
    }

    /**
     * Starts all registered drivers.
     */
    async startAll(): Promise<void> {
        console.log(`\x1b[34m[PROTOCOL SUPPORT] Starting all protocol drivers...\x1b[0m`);
        for (const driver of this.drivers.values()) {
            await driver.start();
        }
    }

    /**
     * Stops all registered drivers.
     */
    async stopAll(): Promise<void> {
        console.log(`\x1b[34m[PROTOCOL SUPPORT] Stopping all protocol drivers...\x1b[0m`);
        for (const driver of this.drivers.values()) {
            await driver.stop();
        }
    }

    /**
     * Registers a unified callback to handle incoming raw readings from any driver.
     */
    onData(callback: (reading: RawReading) => void): void {
        this.onDataCallback = callback;
    }
}
