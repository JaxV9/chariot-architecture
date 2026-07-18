/**
 * @file DeviceGroupConfig.ts
 * @description Static mapping of device IDs to their respective homes and zones.
 */

export interface DeviceConfig {
    siteId: string;
    siteType: 'home' | 'building';
    homeId: string; // for backward compatibility
    zoneId: string;
}

export type DeviceGroupMap = Record<string, DeviceConfig>;

/**
 * Default static configuration for the CHARIOT demo.
 * Maps each device ID to its respective site and zone identifiers.
 */
export const DEFAULT_DEVICE_GROUPS: DeviceGroupMap = {
    "matter-temp-01":      { siteId: "house-1", siteType: "home", homeId: "house-1", zoneId: "quartier-nord" },
    "zigbee-temp-01":      { siteId: "house-1", siteType: "home", homeId: "house-1", zoneId: "quartier-nord" },
    "zigbee-energy-01":    { siteId: "house-1", siteType: "home", homeId: "house-1", zoneId: "quartier-nord" },
    "thread-temp-01":      { siteId: "house-2", siteType: "home", homeId: "house-2", zoneId: "quartier-nord" },
    "thread-energy-01":    { siteId: "house-2", siteType: "home", homeId: "house-2", zoneId: "quartier-nord" },
    "zigbee-occupancy-01":  { siteId: "building-1", siteType: "building", homeId: "building-1", zoneId: "quartier-nord" },
    "zigbee-security-01":   { siteId: "building-1", siteType: "building", homeId: "building-1", zoneId: "quartier-nord" },
    "thread-airquality-01": { siteId: "building-1", siteType: "building", homeId: "building-1", zoneId: "quartier-nord" },
    
    "zigbee-occupancy-02":  { siteId: "building-2", siteType: "building", homeId: "building-2", zoneId: "quartier-nord" },
    "zigbee-security-02":   { siteId: "building-2", siteType: "building", homeId: "building-2", zoneId: "quartier-nord" },
    "thread-airquality-02": { siteId: "building-2", siteType: "building", homeId: "building-2", zoneId: "quartier-nord" },
    
    "zigbee-occupancy-03":  { siteId: "building-3", siteType: "building", homeId: "building-3", zoneId: "quartier-nord" },
    "zigbee-security-03":   { siteId: "building-3", siteType: "building", homeId: "building-3", zoneId: "quartier-nord" },
    "thread-airquality-03": { siteId: "building-3", siteType: "building", homeId: "building-3", zoneId: "quartier-nord" },
    
    "zigbee-occupancy-04":  { siteId: "building-4", siteType: "building", homeId: "building-4", zoneId: "quartier-nord" },
    "zigbee-security-04":   { siteId: "building-4", siteType: "building", homeId: "building-4", zoneId: "quartier-nord" },
    "thread-airquality-04": { siteId: "building-4", siteType: "building", homeId: "building-4", zoneId: "quartier-nord" },
    "matter-temp-03":      { siteId: "house-3", siteType: "home", homeId: "house-3", zoneId: "quartier-nord" },
    "zigbee-temp-03":      { siteId: "house-3", siteType: "home", homeId: "house-3", zoneId: "quartier-nord" },
    "zigbee-energy-03":    { siteId: "house-3", siteType: "home", homeId: "house-3", zoneId: "quartier-nord" },

    "matter-temp-04":      { siteId: "house-4", siteType: "home", homeId: "house-4", zoneId: "quartier-nord" },
    "zigbee-temp-04":      { siteId: "house-4", siteType: "home", homeId: "house-4", zoneId: "quartier-nord" },
    "zigbee-energy-04":    { siteId: "house-4", siteType: "home", homeId: "house-4", zoneId: "quartier-nord" },

    "matter-temp-05":      { siteId: "house-5", siteType: "home", homeId: "house-5", zoneId: "quartier-nord" },
    "zigbee-temp-05":      { siteId: "house-5", siteType: "home", homeId: "house-5", zoneId: "quartier-nord" },
    "zigbee-energy-05":    { siteId: "house-5", siteType: "home", homeId: "house-5", zoneId: "quartier-nord" },
};
