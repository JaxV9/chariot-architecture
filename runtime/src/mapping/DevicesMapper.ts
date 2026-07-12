/**
 * @file DevicesMapper.ts
 * @description Mappe les lectures de données brutes des drivers en profils virtuels normalisés (Profile Property Identifier).
 */

import { RawReading } from "../driver/DeviceDriver.js";

export interface VirtualProfile {
    deviceId: string;
    type: string;
    unit: string;
    value: number;
    timestamp: string;
}

export class DevicesMapper {
    /**
     * Mappe une donnée brute de capteur en profil virtuel standardisé indépendant du protocole.
     */
    mapToVirtualProfile(reading: RawReading): VirtualProfile {
        let mappedValue = reading.value;
        let unit = "unknown";
        let type = "unknown";

        // Traitement spécifique selon le protocole et la donnée brute
        if (reading.protocol === "matter") {
            if (reading.cluster === "temperatureMeasurement" && reading.attribute === "measuredValue") {
                // Les valeurs Matter de température sont à l'échelle 100x (ex: 2000 = 20.00°C)
                mappedValue = reading.value / 100;
                unit = "celsius";
                type = "temperature";
            }
        } else {
            // Autres protocoles (Zigbee/Thread mockés)
            if (reading.cluster === "temperature") {
                mappedValue = reading.value;
                unit = "celsius";
                type = "temperature";
            }
        }

        const profile: VirtualProfile = {
            deviceId: reading.deviceId,
            type: type,
            unit: unit,
            value: Number(mappedValue.toFixed(2)),
            timestamp: new Date().toISOString(),
        };

        console.log(`\x1b[32m[DEVICES MAPPING] Donnée mappée : { deviceId: "${profile.deviceId}", type: "${profile.type}", value: ${profile.value} ${profile.unit} }\x1b[0m`);
        return profile;
    }
}
