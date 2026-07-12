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
export type DeviceGroupMap = Record<string, string>;

/**
 * Default static group configuration for the CHARIOT demo.
 *
 * - "chariot-temp-sensor"  → "living-room"  (real Matter device)
 * - "zigbee-temp-01"       → "living-room"  (mock Zigbee device, same group)
 * - "thread-temp-01"       → "office"       (mock Thread device, different group)
 *
 * Adjust these mappings and the K threshold (ANON_K_THRESHOLD env var) to
 * demonstrate both the "data withheld" and "data published" behaviours in demo.
 */
export const DEFAULT_DEVICE_GROUPS: DeviceGroupMap = {
    "chariot-temp-sensor": "living-room",
    "zigbee-temp-01":      "living-room",
    "thread-temp-01":      "office",
};
