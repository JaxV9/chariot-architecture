/**
 * @file DeviceGroupConfig.ts
 * @description Static mapping of device IDs to their respective homes and zones.
 */

export interface DeviceConfig {
    homeId: string;
    zoneId: string;
}

export type DeviceGroupMap = Record<string, DeviceConfig>;

/**
 * Default static configuration for the CHARIOT demo.
 * Maps each device ID to its respective home and zone identifiers.
 */
export const DEFAULT_DEVICE_GROUPS: DeviceGroupMap = {
    "matter-temp-01":      { homeId: "house-1", zoneId: "quartier-nord" },
    "zigbee-temp-01":      { homeId: "house-1", zoneId: "quartier-nord" },
    "zigbee-energy-01":    { homeId: "house-1", zoneId: "quartier-nord" },
    "thread-temp-01":      { homeId: "house-2", zoneId: "quartier-nord" },
    "thread-energy-01":    { homeId: "house-2", zoneId: "quartier-nord" },
};
