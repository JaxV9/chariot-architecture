/**
 * @file DataAccess.ts
 * @description Contrôle d'accès aux données utilisateur (conformité Data Act et gestion dynamique du consentement).
 */

import { RawReading } from "../driver/DeviceDriver.js";

export class DataAccess {
    // Par défaut, nous autorisons certains types de données
    private allowedTypes: Set<string> = new Set(["temperature"]);

    /**
     * Vérifie si la transmission de cette lecture brute est autorisée par l'utilisateur.
     */
    isTransmissionAllowed(reading: RawReading): boolean {
        // Dans notre cas d'usage, le type est déduit de la classe/attribut (ex: temperature)
        const dataType = reading.cluster === "temperatureMeasurement" ? "temperature" : "unknown";

        if (this.allowedTypes.has(dataType)) {
            console.log(`\x1b[32m[DATA ACCESS] [ALLOW] Donnée '${dataType}' autorisée pour le device ${reading.deviceId}.\x1b[0m`);
            return true;
        } else {
            console.log(`\x1b[31m[DATA ACCESS] [BLOCK] Transmission REFUSÉE pour la donnée '${dataType}' du device ${reading.deviceId} (consentement utilisateur révoqué).\x1b[0m`);
            return false;
        }
    }

    /**
     * Permet d'ajouter dynamiquement l'autorisation pour un type de donnée.
     */
    allowType(dataType: string): void {
        this.allowedTypes.add(dataType);
        console.log(`\x1b[34m[DATA ACCESS] Consentement ACCORDÉ pour le type : ${dataType}\x1b[0m`);
    }

    /**
     * Permet de révoquer dynamiquement l'autorisation pour un type de donnée (simulation pour la démo).
     */
    revokeType(dataType: string): void {
        this.allowedTypes.delete(dataType);
        console.log(`\x1b[35m[DATA ACCESS] [ACTION DEMO] Consentement RÉVOQUÉ pour le type : ${dataType}\x1b[0m`);
    }
}
