/**
 * @file AnonymisationEngine.ts
 * @description Local aggregation engine for the CHARIOT runtime gateway (single-home scope).
 * Performs temporal device smoothing and intra-home average aggregation.
 */

import { VirtualProfile } from "../mapping/DevicesMapper.js";
import { HomeAggregateProfile } from "./HomeAggregateProfile.js";
import { DEFAULT_DEVICE_GROUPS, DeviceGroupMap } from "./DeviceGroupConfig.js";

/** Shape of telemetry events sent to the dashboard. */
export interface AnonymisationTelemetryEvent {
    step: "temporal" | "intra_home" | "kanon" | "gaussian";
    deviceId?: string;
    homeId?: string;
    zoneId?: string;
    type?: string;
    value?: number;
    rawValue?: number;
    smoothedValue?: number;
    windowFill?: number;
    activeDevices?: number;
    kThreshold?: number;
    status?: "published" | "withheld";
    groupMean?: number;
    noise?: number;
    finalValue?: number;
    unit?: string;
    timestamp: string;
}

export type OnTelemetryCallback = (event: AnonymisationTelemetryEvent) => void;

/**
 * Appends newValue to history and returns the sliding-window arithmetic mean.
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

export class AnonymisationEngine {
    private readonly deviceHistories: Map<string, number[]> = new Map();
    private readonly deviceLatestSmoothed: Map<string, number> = new Map();
    private readonly deviceTypes: Map<string, string> = new Map();

    private siteId: string;
    private siteType: "home" | "building";
    private homeId: string; // for backward compatibility
    private zoneId: string;
    private windowSize: number;
    private kThreshold: number; // Retained for config backward compatibility
    private sigma: number;      // Retained for config backward compatibility
    private readonly onTelemetry?: OnTelemetryCallback;

    constructor(_deviceGroups: DeviceGroupMap = DEFAULT_DEVICE_GROUPS, onTelemetry?: OnTelemetryCallback) {
        this.siteId = process.env.SITE_ID ?? process.env.HOME_ID ?? "house-1";
        this.siteType = (process.env.SITE_TYPE ?? "home") as "home" | "building";
        this.homeId = this.siteId;
        this.zoneId = process.env.ZONE_ID ?? "quartier-nord";
        this.windowSize = parseInt(process.env.ANON_WINDOW_SIZE ?? "5", 10);
        this.kThreshold = parseInt(process.env.ANON_K_THRESHOLD ?? "2", 10);
        this.sigma = parseFloat(process.env.ANON_SIGMA ?? "0.1");
        this.onTelemetry = onTelemetry;

        console.log(
            `\x1b[35m[AGGREGATION] Engine initialised — ` +
            `siteId=${this.siteId}, siteType=${this.siteType}, zoneId=${this.zoneId}, window=${this.windowSize}\x1b[0m`
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
            `\x1b[35m[AGGREGATION] Config updated dynamically — ` +
            `window=${this.windowSize}, K (unused here)=${this.kThreshold}, σ (unused here)=${this.sigma}\x1b[0m`
        );
    }

    /**
     * Smooths device reading and aggregates all home readings by type.
     */
    process(profile: VirtualProfile): HomeAggregateProfile | null {
        const { deviceId, type, unit, value } = profile;

        // 1. Temporal aggregation
        if (!this.deviceHistories.has(deviceId)) {
            this.deviceHistories.set(deviceId, []);
        }
        const history = this.deviceHistories.get(deviceId)!;
        const smoothedValue = temporalAggregate(history, value, this.windowSize);

        console.log(
            `\x1b[36m[AGGREGATION] [1/2 TEMPORAL] device='${deviceId}' ` +
            `raw=${value.toFixed(2)} → smoothed=${smoothedValue.toFixed(2)} ` +
            `(window ${history.length}/${this.windowSize})\x1b[0m`
        );

        this.onTelemetry?.({
            step: "temporal",
            deviceId,
            rawValue: value,
            smoothedValue,
            windowFill: history.length / this.windowSize,
            unit,
            timestamp: new Date().toISOString()
        });

        // 2. Intra-home aggregation (average per type)
        this.deviceTypes.set(deviceId, type);
        this.deviceLatestSmoothed.set(deviceId, smoothedValue);

        let sum = 0;
        let count = 0;
        for (const [dId, val] of this.deviceLatestSmoothed.entries()) {
            if (this.deviceTypes.get(dId) === type) {
                sum += val;
                count++;
            }
        }
        const homeMean = parseFloat((sum / count).toFixed(2));

        console.log(
            `\x1b[35m[AGGREGATION] [2/2 INTRA-HOME] Site '${this.siteId}' (${this.siteType}) ` +
            `type='${type}' (${count} device(s)) → mean=${homeMean.toFixed(2)} ${unit}\x1b[0m`
        );

        const aggregateProfile: HomeAggregateProfile = {
            siteId: this.siteId,
            siteType: this.siteType,
            homeId: this.homeId,
            zoneId: this.zoneId,
            type,
            unit,
            value: homeMean,
            timestamp: new Date().toISOString()
        };

        // Emit telemetry for the dashboard
        this.onTelemetry?.({
            step: "intra_home",
            siteId: this.siteId,
            siteType: this.siteType,
            homeId: this.homeId,
            zoneId: this.zoneId,
            type,
            unit,
            value: homeMean,
            activeDevices: count,
            timestamp: new Date().toISOString(),
            individualProfile: profile,
            homeProfile: aggregateProfile
        } as any);

        return aggregateProfile;
    }
}
