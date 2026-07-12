/**
 * @file MessageFormats.ts
 * @description Format validator for normalized virtual profiles.
 */

import { VirtualProfile } from "../directory/DirectoryService.js";

export class MessageFormats {
    /**
     * Validates the structure of a decrypted virtual profile object.
     * Returns the typed virtual profile if valid, or throws a descriptive error.
     */
    static validateAndNormalize(data: any): VirtualProfile {
        if (!data || typeof data !== "object") {
            throw new Error("Message is not a valid JSON object");
        }

        const { deviceId, type, unit, value, timestamp } = data;

        if (typeof deviceId !== "string" || deviceId.trim() === "") {
            throw new Error("Field 'deviceId' must be a non-empty string");
        }

        if (typeof type !== "string" || type.trim() === "") {
            throw new Error("Field 'type' must be a non-empty string");
        }

        if (typeof unit !== "string" || unit.trim() === "") {
            throw new Error("Field 'unit' must be a non-empty string");
        }

        if (typeof value !== "number" || isNaN(value)) {
            throw new Error("Field 'value' must be a valid number");
        }

        if (typeof timestamp !== "string" || timestamp.trim() === "") {
            throw new Error("Field 'timestamp' must be a non-empty string");
        }

        // All fields valid — return the typed VirtualProfile object
        return {
            deviceId,
            type,
            unit,
            value,
            timestamp
        };
    }
}
