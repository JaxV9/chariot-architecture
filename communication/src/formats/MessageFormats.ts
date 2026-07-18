/**
 * @file MessageFormats.ts
 * @description Format validator for decrypted home aggregate profiles received from runtime.
 */

import { HomeAggregateProfile } from "../anonymisation/HomeAggregateProfile.js";

export class MessageFormats {
    /**
     * Validates the structure of a decrypted home aggregate profile object.
     * Returns the typed home aggregate profile if valid, or throws a descriptive error.
     */
    static validateAndNormalize(data: any): HomeAggregateProfile {
        if (!data || typeof data !== "object") {
            throw new Error("Message is not a valid JSON object");
        }

        const { homeId, zoneId, type, unit, value, timestamp } = data;

        if (typeof homeId !== "string" || homeId.trim() === "") {
            throw new Error("Field 'homeId' must be a non-empty string");
        }

        if (typeof zoneId !== "string" || zoneId.trim() === "") {
            throw new Error("Field 'zoneId' must be a non-empty string");
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

        return {
            homeId,
            zoneId,
            type,
            unit,
            value,
            timestamp
        };
    }
}
