/**
 * @file HomeAggregateProfile.ts
 * @description Defines the home-level aggregate profile published by the runtime.
 */

export interface HomeAggregateProfile {
    siteId: string;
    siteType: 'home' | 'building';
    homeId: string; // for backward compatibility
    zoneId: string;
    type: string;
    unit: string;
    value: number;
    timestamp: string;
}
