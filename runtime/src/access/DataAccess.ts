/**
 * @file DataAccess.ts
 * @description User data access control layer (Data Act compliance and dynamic consent management).
 */

import { RawReading } from "../driver/DeviceDriver.js";

export class DataAccess {
    // By default, certain data types are allowed for transmission
    private allowedTypes: Set<string> = new Set(["temperature"]);

    /**
     * Checks whether the transmission of a given raw reading is permitted by the user.
     */
    isTransmissionAllowed(reading: RawReading): boolean {
        // Derive the data type from the cluster/attribute (e.g., temperature)
        const dataType = reading.cluster === "temperatureMeasurement" ? "temperature" : "unknown";

        if (this.allowedTypes.has(dataType)) {
            console.log(`\x1b[32m[DATA ACCESS] [ALLOW] Data type '${dataType}' allowed for device ${reading.deviceId}.\x1b[0m`);
            return true;
        } else {
            console.log(`\x1b[31m[DATA ACCESS] [BLOCK] Transmission DENIED for data type '${dataType}' from device ${reading.deviceId} (user consent revoked).\x1b[0m`);
            return false;
        }
    }

    /**
     * Dynamically grants transmission permission for a given data type.
     */
    allowType(dataType: string): void {
        this.allowedTypes.add(dataType);
        console.log(`\x1b[34m[DATA ACCESS] Consent GRANTED for type: ${dataType}\x1b[0m`);
    }

    /**
     * Dynamically revokes transmission permission for a given data type (demo simulation).
     */
    revokeType(dataType: string): void {
        this.allowedTypes.delete(dataType);
        console.log(`\x1b[35m[DATA ACCESS] [DEMO ACTION] Consent REVOKED for type: ${dataType}\x1b[0m`);
    }
}
