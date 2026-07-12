/**
 * @file AnonymisationEngine.ts
 * @description Four-step privacy-preserving anonymisation pipeline for the CHARIOT runtime.
 *
 * Pipeline order (applied sequentially):
 *   1. Temporal aggregation  — sliding-window mean per individual device (N last values)
 *   2. Intra-home aggregation — mean of all active devices in a home (homeId)
 *   3. K-anonymity           — zone-level aggregation (zoneId); publish only when ≥ K homes active
 *   4. Gaussian perturbation — Box-Muller noise added to the zone aggregate
 *
 * Configuration via environment variables:
 *   ANON_WINDOW_SIZE   — sliding window size N  (default: 5)
 *   ANON_K_THRESHOLD   — minimum homes per zone K (default: 2)
 *   ANON_SIGMA         — Gaussian noise std deviation σ (default: 0.1)
 *
 * Input:  VirtualProfile  { deviceId, type, unit, value, timestamp }
 * Output: GroupProfile    { groupId, zoneId, type, unit, value, homeCount, deviceCount, timestamp }
 *         or null if the zone has not yet reached the K threshold of active homes.
 */

import { VirtualProfile } from "../mapping/DevicesMapper.js";
import { GroupProfile } from "./GroupProfile.js";
import { DEFAULT_DEVICE_GROUPS, DeviceGroupMap } from "./DeviceGroupConfig.js";

// ---------------------------------------------------------------------------
// Telemetry callback type (optional, for dashboard observation only)
// ---------------------------------------------------------------------------

/**
 * Shape of a telemetry event emitted by the anonymisation pipeline.
 * Only used when a telemetry callback is provided — no impact on normal operation.
 */
export interface AnonymisationTelemetryEvent {
    step: "temporal" | "kanon" | "gaussian";
    deviceId?: string;
    groupId?: string;
    rawValue?: number;
    smoothedValue?: number;
    windowFill?: number;  // history.length / windowSize
    activeDevices?: number;
    kThreshold?: number;
    status?: "published" | "withheld";
    groupMean?: number;
    noise?: number;
    finalValue?: number;
    unit?: string;
    timestamp: string;
}

/** Callback type for optional telemetry observation. */
export type OnTelemetryCallback = (event: AnonymisationTelemetryEvent) => void;

// ---------------------------------------------------------------------------
// Pure utility functions (independently testable)
// ---------------------------------------------------------------------------

/**
 * Appends `newValue` to `history`, trims the window to the last `windowSize`
 * entries, and returns the arithmetic mean of the resulting window.
 *
 * @param history    - Mutable history array for one device (modified in place).
 * @param newValue   - Latest raw reading value.
 * @param windowSize - Maximum number of entries to retain (N).
 * @returns Sliding-window arithmetic mean.
 */
export function temporalAggregate(
    history: number[],
    newValue: number,
    windowSize: number
): number {
    history.push(newValue);
    if (history.length > windowSize) {
        history.splice(0, history.length - windowSize);
    }
    const sum = history.reduce((acc, v) => acc + v, 0);
    return sum / history.length;
}

/**
 * Generates a single Gaussian-distributed random number with mean 0 and
 * standard deviation `sigma`, using the Box-Muller transform.
 * No external library required — implemented in pure TypeScript.
 *
 * @param sigma - Standard deviation of the Gaussian distribution (σ).
 * @returns A sample from N(0, σ²).
 */
export function gaussianNoise(sigma: number): number {
    // Box-Muller transform: two uniform samples → one standard normal sample
    let u1: number, u2: number;
    // Exclude u1 = 0 to avoid log(0) = -Infinity
    do {
        u1 = Math.random();
    } while (u1 === 0);
    u2 = Math.random();

    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    // `|| 0` normalises -0 to 0 when sigma = 0 (avoids strict-equal failures).
    return (z0 * sigma) || 0;
}

// ---------------------------------------------------------------------------
// AnonymisationEngine class
// ---------------------------------------------------------------------------

/**
 * Stateful engine that processes VirtualProfiles one at a time and emits
 * anonymised GroupProfiles when the k-anonymity threshold (active homes count) is satisfied.
 */
export class AnonymisationEngine {
    /** Sliding-window history per device: deviceId → ordered value list */
    private readonly deviceHistories: Map<string, number[]> = new Map();

    /**
     * Latest smoothed value per device, grouped by home.
     * Structure: homeId → (deviceId → smoothedValue)
     */
    private readonly homeStates: Map<string, Map<string, number>> = new Map();

    /**
     * Latest home mean per home, grouped by zone.
     * Structure: zoneId → (homeId → homeMean)
     */
    private readonly zoneStates: Map<string, Map<string, number>> = new Map();

    private windowSize: number;
    private kThreshold: number;
    private sigma: number;
    private readonly deviceGroups: DeviceGroupMap;

    /**
     * Optional telemetry callback. If provided, called at each pipeline step
     * with observation data for the dashboard. Never affects pipeline output.
     */
    private readonly onTelemetry?: OnTelemetryCallback;

    constructor(deviceGroups: DeviceGroupMap = DEFAULT_DEVICE_GROUPS, onTelemetry?: OnTelemetryCallback) {
        this.windowSize   = parseInt(process.env.ANON_WINDOW_SIZE ?? "5",  10);
        this.kThreshold   = parseInt(process.env.ANON_K_THRESHOLD ?? "2", 10);
        this.sigma        = parseFloat(process.env.ANON_SIGMA       ?? "0.1");
        this.deviceGroups = deviceGroups;
        this.onTelemetry  = onTelemetry;

        console.log(
            `\x1b[35m[ANONYMISATION] Engine initialised — ` +
            `window=${this.windowSize}, K=${this.kThreshold}, σ=${this.sigma}\x1b[0m`
        );
    }

    getKThreshold(): number { return this.kThreshold; }
    getSigma(): number { return this.sigma; }
    getWindowSize(): number { return this.windowSize; }

    updateConfig(config: { kThreshold?: number; sigma?: number; windowSize?: number }): void {
        if (config.kThreshold !== undefined) {
            this.kThreshold = config.kThreshold;
        }
        if (config.sigma !== undefined) {
            this.sigma = config.sigma;
        }
        if (config.windowSize !== undefined) {
            this.windowSize = config.windowSize;
        }
        console.log(
            `\x1b[35m[ANONYMISATION] Config updated dynamically — ` +
            `window=${this.windowSize}, K=${this.kThreshold}, σ=${this.sigma}\x1b[0m`
        );
    }

    /**
     * Processes one VirtualProfile through the four-step anonymisation pipeline.
     *
     * @param profile - Normalised virtual profile from DevicesMapper.
     * @returns A GroupProfile ready for encryption and publication,
     *          or null if the k-anonymity threshold (active homes in the zone) is not yet reached.
     */
    process(profile: VirtualProfile): GroupProfile | null {
        const { deviceId, type, unit, value } = profile;

        // ---------------------------------------------------------------
        // Step 1 — Temporal aggregation (per device, sliding window)
        // ---------------------------------------------------------------
        if (!this.deviceHistories.has(deviceId)) {
            this.deviceHistories.set(deviceId, []);
        }
        const history = this.deviceHistories.get(deviceId)!;
        const smoothedValue = temporalAggregate(history, value, this.windowSize);

        console.log(
            `\x1b[36m[ANONYMISATION] [1/4 TEMPORAL] device='${deviceId}' ` +
            `raw=${value.toFixed(3)} → smoothed=${smoothedValue.toFixed(3)} ` +
            `(window ${history.length}/${this.windowSize})\x1b[0m`
        );

        // Telemetry: step 1 — temporal aggregation
        this.onTelemetry?.({ step: "temporal", deviceId, rawValue: value, smoothedValue, windowFill: history.length / this.windowSize, timestamp: new Date().toISOString() });

        // ---------------------------------------------------------------
        // Step 2 — Intra-home aggregation (per homeId)
        // ---------------------------------------------------------------
        const config = this.deviceGroups[deviceId] ?? { homeId: `home-${deviceId}`, zoneId: "default-zone" };
        const { homeId, zoneId } = config;

        if (!this.homeStates.has(homeId)) {
            this.homeStates.set(homeId, new Map());
        }
        const homeDevices = this.homeStates.get(homeId)!;
        homeDevices.set(deviceId, smoothedValue);

        // Compute mean of all active devices in this home
        const homeValues = Array.from(homeDevices.values());
        const homeMean = homeValues.reduce((acc, v) => acc + v, 0) / homeValues.length;

        console.log(
            `\x1b[35m[ANONYMISATION] [2/4 INTRA-HOME] Home '${homeId}' ` +
            `(${homeDevices.size} active device(s)) → mean=${homeMean.toFixed(3)}\x1b[0m`
        );

        // ---------------------------------------------------------------
        // Step 3 — K-anonymity (zone-level aggregation, check active homeCount >= K)
        // ---------------------------------------------------------------
        if (!this.zoneStates.has(zoneId)) {
            this.zoneStates.set(zoneId, new Map());
        }
        const zoneHomes = this.zoneStates.get(zoneId)!;
        zoneHomes.set(homeId, homeMean);

        const activeHomeCount = zoneHomes.size;
        const activeRatio = `${activeHomeCount}/${this.kThreshold}`;

        if (activeHomeCount < this.kThreshold) {
            // Log required format: [K-ANONYMITY] Zone 'quartier-nord' : 1/2 maisons actives, donnée retenue
            console.log(
                `[K-ANONYMITY] Zone '${zoneId}' : ${activeHomeCount}/${this.kThreshold} maisons actives, donnée retenue`
            );
            
            console.log(
                `\x1b[33m[ANONYMISATION] [3/4 K-ANONYMITY] Zone '${zoneId}' : ` +
                `${activeRatio} active houses — data withheld (K not reached)\x1b[0m`
            );

            // Telemetry: step 3 — k-anonymity withheld
            this.onTelemetry?.({ step: "kanon", groupId: zoneId, activeDevices: activeHomeCount, kThreshold: this.kThreshold, status: "withheld", timestamp: new Date().toISOString() });
            return null;
        }

        // Seuil K atteint — compute zone mean
        const zoneValues = Array.from(zoneHomes.values());
        const zoneMean = zoneValues.reduce((acc, v) => acc + v, 0) / zoneValues.length;

        console.log(
            `\x1b[32m[ANONYMISATION] [3/4 K-ANONYMITY] Zone '${zoneId}' ✓ : ` +
            `${activeRatio} active houses → zone mean=${zoneMean.toFixed(3)}\x1b[0m`
        );

        // Telemetry: step 3 — k-anonymity passed
        this.onTelemetry?.({ step: "kanon", groupId: zoneId, activeDevices: activeHomeCount, kThreshold: this.kThreshold, status: "published", groupMean: zoneMean, timestamp: new Date().toISOString() });

        // ---------------------------------------------------------------
        // Step 4 — Gaussian perturbation (on the zone aggregate)
        // ---------------------------------------------------------------
        const noise          = gaussianNoise(this.sigma);
        const perturbedValue = parseFloat((zoneMean + noise).toFixed(3));

        console.log(
            `\x1b[32m[ANONYMISATION] [4/4 GAUSSIAN] Zone '${zoneId}' : ` +
            `mean=${zoneMean.toFixed(3)}, noise=${noise.toFixed(4)} → ` +
            `final=${perturbedValue} ${unit}\x1b[0m`
        );

        // ---------------------------------------------------------------
        // Build and return the group profile (respecting the exposed interface structure)
        // ---------------------------------------------------------------
        const groupProfile: GroupProfile = {
            groupId:     zoneId, // Backwards compatibility
            zoneId,
            type,
            unit,
            value:       perturbedValue,
            homeCount:   activeHomeCount,
            deviceCount: activeHomeCount, // Backwards compatibility
            timestamp:   new Date().toISOString(),
        };

        // Telemetry: step 4 — gaussian perturbation (with before/after profiles)
        this.onTelemetry?.({ 
            step: "gaussian", 
            groupId: zoneId, 
            groupMean: zoneMean, 
            noise, 
            finalValue: perturbedValue, 
            unit, 
            timestamp: new Date().toISOString(),
            individualProfile: profile,
            groupProfile: groupProfile
        } as any);

        return groupProfile;
    }
}
