/**
 * @file ProtocolSupport.ts
 * @description Couche "Protocoles support" assurant la gestion et l'unification des différents drivers de protocole.
 */

import { DeviceDriver, RawReading } from "../driver/DeviceDriver.js";

export class ProtocolSupport {
    private drivers: Map<string, DeviceDriver> = new Map();
    private onDataCallback?: (reading: RawReading) => void;

    /**
     * Enregistre un driver dans le gestionnaire.
     */
    registerDriver(driver: DeviceDriver): void {
        this.drivers.set(driver.id, driver);
        
        // Rediriger les données brutes vers le callback unifié
        driver.onRawData((reading) => {
            if (this.onDataCallback) {
                this.onDataCallback(reading);
            }
        });
        
        console.log(`\x1b[32m[PROTOCOL SUPPORT] Driver enregistré pour le device ${driver.id} (Protocole: ${driver.protocol.toUpperCase()})\x1b[0m`);
    }

    /**
     * Démarre tous les drivers enregistrés.
     */
    async startAll(): Promise<void> {
        console.log(`\x1b[34m[PROTOCOL SUPPORT] Démarrage de tous les drivers de protocoles...\x1b[0m`);
        for (const driver of this.drivers.values()) {
            await driver.start();
        }
    }

    /**
     * Arrête tous les drivers enregistrés.
     */
    async stopAll(): Promise<void> {
        console.log(`\x1b[34m[PROTOCOL SUPPORT] Arrêt de tous les drivers de protocoles...\x1b[0m`);
        for (const driver of this.drivers.values()) {
            await driver.stop();
        }
    }

    /**
     * Enregistre un callback unifié pour traiter les lectures brutes entrantes.
     */
    onData(callback: (reading: RawReading) => void): void {
        this.onDataCallback = callback;
    }
}
