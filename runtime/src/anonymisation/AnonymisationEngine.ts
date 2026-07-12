/**
 * @file AnonymisationEngine.ts
 * @description Three-step privacy-preserving anonymisation pipeline for the CHARIOT runtime.
 *
 * Pipeline order (applied sequentially):
 *   1. Temporal aggregation  — sliding-window mean per individual device (N last values)
 *   2. K-anonymity           — group-level aggregation; publish only when ≥ effectiveK devices active
 *   3. Gaussian perturbation — Box-Muller noise added to the group aggregate
 *
 * ### Adaptive K-anonymity threshold
 *
 * The effective K threshold is determined **dynamically** per group at runtime:
 *
 *   effectiveK(group) = min(ANON_K_THRESHOLD, maxDevicesEverSeenInGroup)
 *
 * "maxDevicesEverSeenInGroup" is the maximum number of distinct devices that have
 * ever reported a reading for that group during the current session. This makes the
 * engine self-adapting to the actual population of any group:
 *
 *   • 1 device in a group (1-to-N devices, 1-to-N groups supported):
 *       maxSeen = 1 → effectiveK = min(K, 1) = 1 → data published on first reading.
 *
 *   • 2 devices in a group with K = 2:
 *       After device-A reports: maxSeen = 1 → effectiveK = 1 → published.
 *       After device-B reports: maxSeen = 2 → effectiveK = 2 → both required from now on.
 *       If device-B goes silent: activeCount = 1 < effectiveK = 2 → data withheld.
 *
 *   • N devices in a group with K < N:
 *       effectiveK stabilises at K once ≥ K devices have been seen.
 *
 * No static group-size configuration is required. Groups are created implicitly the
 * first time any device belonging to them reports a reading.
 *
 * Configuration via environment variables:
 *   ANON_WINDOW_SIZE   — sliding window size N  (default: 5)
 *   ANON_K_THRESHOLD   — minimum devices per group K (default: 2)
 *   ANON_SIGMA         — Gaussian noise std deviation σ (default: 0.1)
 *
 * Input:  VirtualProfile  { deviceId, type, unit, value, timestamp }
 * Output: GroupProfile    { groupId, type, unit, value, deviceCount, timestamp }
 *         or null if the group has not yet reached the effective K threshold.
 */

import { VirtualProfile } from "../mapping/DevicesMapper.js";
import { GroupProfile } from "./GroupProfile.js";
import { DEFAULT_DEVICE_GROUPS, DeviceGroupMap } from "./DeviceGroupConfig.js";

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
 * anonymised GroupProfiles when the k-anonymity threshold is satisfied.
 *
 * Supports any combination of 1-to-N devices per group and 1-to-N groups.
 * The effective K threshold adapts dynamically to the actual population of each
 * group (see module-level JSDoc for the full algorithm).
 */
export class AnonymisationEngine {
    /** Sliding-window history per device: deviceId → ordered value list */
    private readonly deviceHistories: Map<string, number[]> = new Map();

    /**
     * Latest smoothed (temporally aggregated) value per device, grouped by zone.
     * Structure: groupId → (deviceId → smoothedValue)
     * The inner map acts as the "active devices" set for the current cycle.
     */
    private readonly groupState: Map<string, Map<string, number>> = new Map();

    /**
     * Maximum number of distinct devices ever seen per group during this session.
     * Used to derive effectiveK: effectiveK = min(kThreshold, maxSeen).
     * Grows monotonically as new devices report for the first time.
     */
    private readonly groupMaxSeen: Map<string, number> = new Map();

    private readonly windowSize: number;
    private readonly kThreshold: number;
    private readonly sigma: number;
    private readonly deviceGroups: DeviceGroupMap;

    constructor(deviceGroups: DeviceGroupMap = DEFAULT_DEVICE_GROUPS) {
        this.windowSize   = parseInt(process.env.ANON_WINDOW_SIZE ?? "5",  10);
        this.kThreshold   = parseInt(process.env.ANON_K_THRESHOLD ?? "2", 10);
        this.sigma        = parseFloat(process.env.ANON_SIGMA       ?? "0.1");
        this.deviceGroups = deviceGroups;

        console.log(
            `\x1b[35m[ANONYMISATION] Engine initialised — ` +
            `window=${this.windowSize}, K=${this.kThreshold}, σ=${this.sigma}\x1b[0m`
        );
    }

    /**
     * Returns the effective K threshold for a given group.
     *
     *   effectiveK = min(kThreshold, maxDevicesEverSeenInGroup)
     *
     * Because maxSeen grows as devices report, effectiveK adapts progressively:
     * - With 1 device seen so far  → effectiveK = 1  → publishes immediately.
     * - With 2+ devices seen        → effectiveK = min(K, 2+) → standard quorum.
     *
     * @param groupId - The logical group/zone identifier.
     * @returns The effective minimum number of active devices required to publish.
     */
    private effectiveK(groupId: string): number {
        const maxSeen = this.groupMaxSeen.get(groupId) ?? 1;
        return Math.min(this.kThreshold, maxSeen);
    }

    /**
     * Processes one VirtualProfile through the three-step anonymisation pipeline.
     *
     * @param profile - Normalised virtual profile from DevicesMapper.
     * @returns A GroupProfile ready for encryption and publication,
     *          or null if the effective k-anonymity threshold is not yet reached.
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
            `\x1b[36m[ANONYMISATION] [1/3 TEMPORAL] device='${deviceId}' ` +
            `raw=${value.toFixed(3)} → smoothed=${smoothedValue.toFixed(3)} ` +
            `(window ${history.length}/${this.windowSize})\x1b[0m`
        );

        // ---------------------------------------------------------------
        // Step 2 — K-anonymity (group-level aggregation)
        // ---------------------------------------------------------------
        const groupId = this.deviceGroups[deviceId] ?? "default";

        if (!this.groupState.has(groupId)) {
            this.groupState.set(groupId, new Map());
        }
        const groupDevices = this.groupState.get(groupId)!;
        groupDevices.set(deviceId, smoothedValue);

        // Update the maximum distinct devices ever seen for this group.
        const currentCount = groupDevices.size;
        const prevMax      = this.groupMaxSeen.get(groupId) ?? 0;
        if (currentCount > prevMax) {
            this.groupMaxSeen.set(groupId, currentCount);
        }

        const activeCount = currentCount;
        const kEff        = this.effectiveK(groupId);
        const activeRatio = `${activeCount}/${kEff}`;

        if (activeCount < kEff) {
            // Effective K threshold not reached — withhold data.
            console.log(
                `\x1b[33m[ANONYMISATION] [2/3 K-ANONYMITY] Group '${groupId}': ` +
                `${activeRatio} active devices — data withheld (K not reached)\x1b[0m`
            );
            return null;
        }

        // Effective K threshold reached — compute group mean.
        const groupValues = Array.from(groupDevices.values());
        const groupMean   = groupValues.reduce((acc, v) => acc + v, 0) / groupValues.length;

        console.log(
            `\x1b[32m[ANONYMISATION] [2/3 K-ANONYMITY] Group '${groupId}': ` +
            `${activeRatio} active devices ✓ — group mean=${groupMean.toFixed(3)}\x1b[0m`
        );

        // ---------------------------------------------------------------
        // Step 3 — Gaussian perturbation (on the group aggregate)
        // ---------------------------------------------------------------
        const noise          = gaussianNoise(this.sigma);
        const perturbedValue = parseFloat((groupMean + noise).toFixed(3));

        console.log(
            `\x1b[32m[ANONYMISATION] [3/3 GAUSSIAN] Group '${groupId}': ` +
            `mean=${groupMean.toFixed(3)}, noise=${noise.toFixed(4)} → ` +
            `final=${perturbedValue} ${unit}\x1b[0m`
        );

        // ---------------------------------------------------------------
        // Build and return the group profile
        // ---------------------------------------------------------------
        const groupProfile: GroupProfile = {
            groupId,
            type,
            unit,
            value:       perturbedValue,
            deviceCount: activeCount,
            timestamp:   new Date().toISOString(),
        };

        return groupProfile;
    }
}
