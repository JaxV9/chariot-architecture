/**
 * @file DirectoryService.ts
 * @description Directory Services storage layer for zone profiles, backed by an in-memory Map.
 */

import { TelemetryClient } from "../telemetry/TelemetryClient.js";

export interface ZoneProfile {
    zoneId: string;
    type: string;
    unit: string;
    value: number;
    homeCount: number;
    timestamp: string;
}

export class DirectoryService {
    // Map storing the profile history per zoneId (maximum 10 entries)
    private store: Map<string, ZoneProfile[]> = new Map();

    private readonly telemetry?: TelemetryClient;

    constructor(telemetry?: TelemetryClient) {
        this.telemetry = telemetry;
    }

    /**
     * Saves a new zone profile.
     * Keeps only the 10 most recent readings (sliding window history).
     */
    saveProfile(profile: ZoneProfile): void {
        const key = `${profile.zoneId}--${profile.type}`;
        if (!this.store.has(key)) {
            this.store.set(key, []);
        }

        const history = this.store.get(key)!;
        
        // Insert the new profile at the front (most recent first)
        history.unshift(profile);

        // Enforce the 10-entry history limit
        if (history.length > 10) {
            history.pop();
        }

        console.log(`\x1b[32m[DIRECTORY SERVICES] Profile saved for key ${key}. Value: ${profile.value} ${profile.unit}, homes count: ${profile.homeCount}. History: ${history.length}/10\x1b[0m`);

        // Emit communication-layer telemetry event (fire-and-forget)
        this.telemetry?.emit({
            layer: "communication",
            zoneId: key,
            type: profile.type,
            value: profile.value,
            unit: profile.unit,
            homeCount: profile.homeCount,
            timestamp: profile.timestamp,
            directoryStoreStructure: history,
        });
    }

    /**
     * Emits a telemetry event via the Directory Services telemetry client.
     */
    emitTelemetry(event: any): void {
        this.telemetry?.emit(event);
    }

    /**
     * Registers a callback for config updates via the telemetry client.
     */
    onConfigUpdate(listener: (config: any) => void): void {
        this.telemetry?.onConfigUpdate(listener);
    }

    /**
     * Registers a callback for telemetry connect events.
     */
    onConnect(listener: () => void): void {
        this.telemetry?.onConnect(listener);
    }

    /**
     * Returns the list of all known zone identifiers.
     */
    getAllZones(): string[] {
        return Array.from(this.store.keys());
    }

    /**
     * Returns the most recent profile for a given zone.
     */
    getZoneLatest(zoneId: string): ZoneProfile | undefined {
        const history = this.store.get(zoneId);
        if (!history || history.length === 0) {
            return undefined;
        }
        return history[0]; // First element is the most recent
    }

    /**
     * Returns the full history for a zone (up to 10 entries).
     */
    getZoneHistory(zoneId: string): ZoneProfile[] {
        return this.store.get(zoneId) || [];
    }

    /**
     * Clears all stored data (useful for tests).
     */
    clear(): void {
        this.store.clear();
    }
}
