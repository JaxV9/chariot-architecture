/**
 * @file HomeAggregateProfile.ts
 * @description Defines the home-level aggregate profile published by the runtime.
 */

export interface HomeAggregateProfile {
    homeId: string;
    zoneId: string;
    type: string;
    unit: string;
    value: number;
    timestamp: string;
}
