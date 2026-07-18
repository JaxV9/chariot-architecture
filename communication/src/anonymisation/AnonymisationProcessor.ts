/**
 * @file AnonymisationProcessor.ts
 * @description Cloud-level anonymisation and noise injection processor for Chariot middleware.
 * Implements K-anonymity (across homes in a zone) and Box-Muller Gaussian noise.
 */

import { HomeAggregateProfile } from "./HomeAggregateProfile.js";
import { ZoneProfile } from "../directory/DirectoryService.js";

/**
 * Generates a single Gaussian-distributed random number with mean 0 and
 * standard deviation `sigma`, using the Box-Muller transform.
 */
export function gaussianNoise(sigma: number): number {
    let u1: number, u2: number;
    do {
        u1 = Math.random();
    } while (u1 === 0);
    u2 = Math.random();

    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return (z0 * sigma) || 0;
}

export type ProcessorTelemetryCallback = (event: any) => void;

export class AnonymisationProcessor {
    /**
     * Active homes state per zone and data type.
     * Structure: "zoneId:type" -> (homeId -> { value, timestamp })
     */
    private readonly zoneStates: Map<string, Map<string, { value: number; timestamp: number }>> = new Map();

    /**
     * Active homes window timeout (60 seconds).
     */
    private readonly timeoutMs = 60000;

    private readonly onTelemetry?: ProcessorTelemetryCallback;

    constructor(onTelemetry?: ProcessorTelemetryCallback) {
        this.onTelemetry = onTelemetry;
    }

    /**
     * Processes a decrypted HomeAggregateProfile through K-anonymity and Gaussian noise.
     * Returns a ZoneProfile if the K-anonymity threshold is met, otherwise returns null.
     */
    process(profile: HomeAggregateProfile, kThreshold: number, sigma: number): ZoneProfile | null {
        const { siteId, siteType, zoneId, type, unit, value } = profile;
        const now = Date.now();
        const stateKey = `${zoneId}:${siteType}:${type}`;

        // 1. Initialize zone state
        if (!this.zoneStates.has(stateKey)) {
            this.zoneStates.set(stateKey, new Map());
        }
        const zoneSites = this.zoneStates.get(stateKey)!;

        // 2. Record this site's contribution
        zoneSites.set(siteId, { value, timestamp: now });

        // 3. Clean up inactive sites (older than timeoutMs)
        for (const [sId, record] of zoneSites.entries()) {
            if (now - record.timestamp > this.timeoutMs) {
                zoneSites.delete(sId);
            }
        }

        const activeSiteCount = zoneSites.size;

        // 4. Verify K-anonymity threshold
        if (activeSiteCount < kThreshold) {
            console.log(
                `[K-ANONYMITY] Zone '${zoneId}' (type: ${siteType}) : ${activeSiteCount}/${kThreshold} sites actifs, donnée retenue`
            );
            
            // Emit withheld telemetry
            this.onTelemetry?.({
                layer: "runtime", // layer mapped to runtime for dashboard backwards compatibility
                step: "kanon",
                zoneId,
                siteType,
                type,
                unit,
                activeDevices: activeSiteCount,
                kThreshold,
                status: "withheld",
                timestamp: new Date().toISOString()
            });

            return null;
        }

        // 5. Seuil K atteint — compute zone average
        let sum = 0;
        for (const record of zoneSites.values()) {
            sum += record.value;
        }
        const zoneMean = sum / activeSiteCount;

        // Emit telemetry for K-anonymity passing
        this.onTelemetry?.({
            layer: "runtime", // mapped to runtime for dashboard backwards compatibility
            step: "kanon",
            zoneId,
            siteType,
            type,
            unit,
            activeDevices: activeSiteCount,
            kThreshold,
            status: "published",
            groupMean: zoneMean,
            timestamp: new Date().toISOString()
        });

        // 6. Apply Box-Muller Gaussian noise
        const noise = gaussianNoise(sigma);
        const perturbedValue = parseFloat((zoneMean + noise).toFixed(3));

        console.log(
            `[K-ANONYMITY] Zone '${zoneId}' (type: ${siteType}) ✓ : ${activeSiteCount}/${kThreshold} sites actifs -> ` +
            `moyenne=${zoneMean.toFixed(2)} + bruit=${noise.toFixed(4)} -> valeur finale=${perturbedValue}`
        );

        // Emit telemetry for Gaussian perturbation
        this.onTelemetry?.({
            layer: "runtime", // mapped to runtime for dashboard backwards compatibility
            step: "gaussian",
            zoneId,
            siteType,
            type,
            groupMean: zoneMean,
            noise,
            finalValue: perturbedValue,
            unit,
            timestamp: new Date().toISOString(),
            individualProfile: profile,
            zoneProfile: {
                zoneId,
                siteType,
                type,
                unit,
                value: perturbedValue,
                siteCount: activeSiteCount,
                homeCount: activeSiteCount, // backward compatibility
                timestamp: new Date().toISOString()
            }
        });

        return {
            zoneId,
            siteType,
            type,
            unit,
            value: perturbedValue,
            siteCount: activeSiteCount,
            homeCount: activeSiteCount, // backward compatibility
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Resets internal states (useful for testing).
     */
    clear(): void {
        this.zoneStates.clear();
    }
}
