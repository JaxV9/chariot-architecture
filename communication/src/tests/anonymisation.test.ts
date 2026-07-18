/**
 * @file anonymisation.test.ts
 * @description Unit tests for K-anonymity and Gaussian noise in the communication layer.
 * Run with:
 *   npx tsx src/tests/anonymisation.test.ts
 */

import assert from "node:assert/strict";
import { AnonymisationProcessor, gaussianNoise } from "../anonymisation/AnonymisationProcessor.js";
import { HomeAggregateProfile } from "../anonymisation/HomeAggregateProfile.js";

function makeHomeProfile(homeId: string, value: number): HomeAggregateProfile {
    return {
        siteId: homeId,
        siteType: "home",
        homeId,
        zoneId: "quartier-nord",
        type: "temperature",
        unit: "celsius",
        value,
        timestamp: new Date().toISOString()
    };
}

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
    try {
        fn();
        console.log(`\x1b[32m  ✓ ${name}\x1b[0m`);
        passed++;
    } catch (err: any) {
        console.error(`\x1b[31m  ✗ ${name}\x1b[0m`);
        console.error(`    ${err.message}`);
        failed++;
    }
}

// ---------------------------------------------------------------------------
// 1. Gaussian noise
// ---------------------------------------------------------------------------

console.log("\n\x1b[1m[TEST] 1 — Gaussian noise (Box-Muller)\x1b[0m");

test("gaussianNoise returns a finite number", () => {
    const noise = gaussianNoise(0.1);
    assert.ok(isFinite(noise), "result must be finite");
});

test("gaussianNoise with sigma=0 always returns 0", () => {
    const noise = gaussianNoise(0);
    assert.equal(noise, 0);
});

// ---------------------------------------------------------------------------
// 2. K-Anonymity
// ---------------------------------------------------------------------------

console.log("\n\x1b[1m[TEST] 2 — K-anonymity checks\x1b[0m");

test("withholds data when active home count is below K (K=2)", () => {
    const processor = new AnonymisationProcessor();
    
    // First house sends data. Total active homes = 1. Below K=2.
    const result = processor.process(makeHomeProfile("house-1", 20.0), 2, 0);
    assert.equal(result, null, "Should return null (withheld)");
});

test("publishes average value when K threshold is met (K=2)", () => {
    const processor = new AnonymisationProcessor();
    
    // First house sends data. Total = 1.
    processor.process(makeHomeProfile("house-1", 20.0), 2, 0);
    
    // Second house sends data. Total = 2. Threshold met.
    const result = processor.process(makeHomeProfile("house-2", 22.0), 2, 0); // sigma = 0
    assert.notEqual(result, null);
    assert.equal(result!.zoneId, "quartier-nord");
    assert.equal(result!.homeCount, 2);
    assert.equal(result!.value, 21.0); // mean of 20 and 22
});

test("deduplicates multiple contributions from the same home", () => {
    const processor = new AnonymisationProcessor();
    
    // house-1 sends twice. Total active homes is still 1. Below K=2.
    processor.process(makeHomeProfile("house-1", 20.0), 2, 0);
    const result = processor.process(makeHomeProfile("house-1", 22.0), 2, 0);
    assert.equal(result, null, "Should still return null");
});

test("discards inactive homes after timeout (60 seconds)", () => {
    const processor = new AnonymisationProcessor();
    const originalNow = Date.now;
    
    let simulatedTime = 1000;
    Date.now = () => simulatedTime;

    try {
        // house-1 contributes at t = 1000
        processor.process(makeHomeProfile("house-1", 20.0), 2, 0);

        // Advance time by 61 seconds (timeout is 60 seconds)
        simulatedTime += 61000;

        // house-2 contributes at t = 62000. house-1 should be cleaned up. Total active = 1.
        const result = processor.process(makeHomeProfile("house-2", 22.0), 2, 0);
        assert.equal(result, null, "Should withhold because house-1 timed out");
    } finally {
        Date.now = originalNow;
    }
});

test("does not mix different sensor types during zone aggregation", () => {
    const processor = new AnonymisationProcessor();

    // house-1 sends temperature
    const temp1 = {
        siteId: "house-1",
        siteType: "home" as const,
        homeId: "house-1",
        zoneId: "quartier-nord",
        type: "temperature",
        unit: "celsius",
        value: 20.0,
        timestamp: new Date().toISOString()
    };
    processor.process(temp1, 2, 0);

    // house-2 sends energy_consumption
    const energy2 = {
        siteId: "house-2",
        siteType: "home" as const,
        homeId: "house-2",
        zoneId: "quartier-nord",
        type: "energy_consumption",
        unit: "kWh",
        value: 1.5,
        timestamp: new Date().toISOString()
    };
    
    // Each type only has 1 contribution, so K=2 threshold should not be met for either type!
    const resultTemp = processor.process(temp1, 2, 0);
    const resultEnergy = processor.process(energy2, 2, 0);

    assert.equal(resultTemp, null, "Temperature should be withheld because K=2 is not met for temperature");
    assert.equal(resultEnergy, null, "Energy should be withheld because K=2 is not met for energy");
});

test("isolates siteTypes (home vs building) during zone K-anonymity checks", () => {
    const processor = new AnonymisationProcessor();

    // house-1 (home) sends temperature
    const homeProfile = {
        siteId: "house-1",
        siteType: "home" as const,
        homeId: "house-1",
        zoneId: "quartier-nord",
        type: "temperature",
        unit: "celsius",
        value: 20.0,
        timestamp: new Date().toISOString()
    };

    // building-1 (building) sends temperature
    const buildingProfile = {
        siteId: "building-1",
        siteType: "building" as const,
        homeId: "building-1",
        zoneId: "quartier-nord",
        type: "temperature",
        unit: "celsius",
        value: 22.0,
        timestamp: new Date().toISOString()
    };

    // With K=2, if they were mixed, we would have 2 contributions in quartier-nord:temperature,
    // and they would trigger publication.
    // If they are isolated, both will be withheld since each category (home and building) only has 1 contribution.
    const resultHome = processor.process(homeProfile, 2, 0);
    const resultBuilding = processor.process(buildingProfile, 2, 0);

    assert.equal(resultHome, null, "Home profile should be withheld because K=2 is not met for homes");
    assert.equal(resultBuilding, null, "Building profile should be withheld because K=2 is not met for buildings");

    // If we add another home (house-2), K=2 should be met for homes, but still not for buildings
    const homeProfile2 = {
        siteId: "house-2",
        siteType: "home" as const,
        homeId: "house-2",
        zoneId: "quartier-nord",
        type: "temperature",
        unit: "celsius",
        value: 24.0,
        timestamp: new Date().toISOString()
    };

    const resultHome2 = processor.process(homeProfile2, 2, 0);
    assert.notEqual(resultHome2, null, "Home profile should publish because we now have 2 active homes");
    assert.equal(resultHome2!.value, 22.0, "Zone mean for homes should be (20 + 24) / 2 = 22.0");
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n\x1b[1m[RESULTS] ${passed} passed, ${failed} failed\x1b[0m\n`);
if (failed > 0) {
    process.exit(1);
}
