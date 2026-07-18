/**
 * @file HomeAggregateProfile.ts
 * @description Defines the home-level aggregate profile interface for the communication package.
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
