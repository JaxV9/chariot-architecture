/**
 * @file DeviceGroupConfig.ts
 * @description Static mapping of device IDs to their logical zone/group.
 *
 * Design choice: group configuration is kept here in the runtime package rather than
 * in the `devices/` package. This avoids modifying the Matter commissioning code and
 * keeps all anonymisation logic fully contained within `runtime/`. A static map is
 * sufficient for the MVP demo — no dynamic zone management is needed.
 *
 * To add a new device to a group, simply add an entry to DEFAULT_DEVICE_GROUPS below.
 * If a device ID is not listed here, the AnonymisationEngine assigns it to the
 * catch-all group "default".
 */

/**
 * Maps a device ID to its logical group (zone).
 * Key: deviceId (as emitted by the driver, e.g., "chariot-temp-sensor").
 * Value: groupId (e.g., "living-room", "office").
 */
export interface DeviceConfig {
    homeId: string;
    zoneId: string;
}

export type DeviceGroupMap = Record<string, DeviceConfig>;

/**
 * Default static group configuration for the CHARIOT demo.
 * Maps each device ID to its respective home and zone identifiers.
 */
export const DEFAULT_DEVICE_GROUPS: DeviceGroupMap = {
    "chariot-temp-sensor": { homeId: "house-1", zoneId: "quartier-nord" },
    "zigbee-temp-01":      { homeId: "house-1", zoneId: "quartier-nord" },
    "thread-temp-01":      { homeId: "house-2", zoneId: "quartier-nord" },
};
