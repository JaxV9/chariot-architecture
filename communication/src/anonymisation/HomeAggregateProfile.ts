/**
 * @file HomeAggregateProfile.ts
 * @description Defines the home-level aggregate profile interface for the communication package.
 */

export interface HomeAggregateProfile {
    homeId: string;
    zoneId: string;
    type: string;
    unit: string;
    value: number;
    timestamp: string;
}
