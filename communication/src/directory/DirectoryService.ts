/**
 * @file DirectoryService.ts
 * @description Directory Services storage layer for virtual device profiles, backed by an in-memory Map.
 */

export interface VirtualProfile {
    deviceId: string;
    type: string;
    unit: string;
    value: number;
    timestamp: string;
    deviceCount?: number;
}

export class DirectoryService {
    // Map storing the profile history per deviceId (maximum 10 entries)
    private store: Map<string, VirtualProfile[]> = new Map();

    /**
     * Saves a new virtual profile for a device.
     * Keeps only the 10 most recent readings (sliding window history).
     */
    saveProfile(profile: VirtualProfile): void {
        const deviceId = profile.deviceId;
        if (!this.store.has(deviceId)) {
            this.store.set(deviceId, []);
        }

        const history = this.store.get(deviceId)!;
        
        // Insert the new profile at the front (most recent first)
        history.unshift(profile);

        // Enforce the 10-entry history limit
        if (history.length > 10) {
            history.pop();
        }

        console.log(`\x1b[32m[DIRECTORY SERVICES] Profile saved for ${deviceId}. Value: ${profile.value} ${profile.unit}. History: ${history.length}/10\x1b[0m`);
    }

    /**
     * Returns the list of all known device identifiers.
     */
    getAllDevices(): string[] {
        return Array.from(this.store.keys());
    }

    /**
     * Returns the most recent virtual profile for a given device.
     */
    getDeviceLatest(deviceId: string): VirtualProfile | undefined {
        const history = this.store.get(deviceId);
        if (!history || history.length === 0) {
            return undefined;
        }
        return history[0]; // First element is the most recent
    }

    /**
     * Returns the full history for a device (up to 10 entries).
     */
    getDeviceHistory(deviceId: string): VirtualProfile[] {
        return this.store.get(deviceId) || [];
    }

    /**
     * Clears all stored data (useful for tests).
     */
    clear(): void {
        this.store.clear();
    }
}
