/**
 * @file anonymisation.test.ts
 * @description Unit tests for the three anonymisation steps.
 *
 * No external test framework required — uses Node.js built-in `assert`.
 * Run with:
 *   npx tsx src/tests/anonymisation.test.ts
 */

import assert from "node:assert/strict";
import { temporalAggregate, gaussianNoise, AnonymisationEngine } from "../anonymisation/AnonymisationEngine.js";
import { VirtualProfile } from "../mapping/DevicesMapper.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProfile(deviceId: string, value: number): VirtualProfile {
    return { deviceId, type: "temperature", unit: "celsius", value, timestamp: new Date().toISOString() };
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
// 1. Temporal aggregation
// ---------------------------------------------------------------------------

console.log("\n\x1b[1m[TEST] 1 — Temporal aggregation\x1b[0m");

test("returns the value itself when history is empty (window of 1)", () => {
    const history: number[] = [];
    const result = temporalAggregate(history, 20.0, 5);
    assert.equal(result, 20.0);
});

test("computes the mean of two values", () => {
    const history: number[] = [];
    temporalAggregate(history, 20.0, 5);
    const result = temporalAggregate(history, 22.0, 5);
    assert.equal(result, 21.0);
});

test("sliding window: discards oldest value when full", () => {
    // Feed 6 values into a window of size 5
    const history: number[] = [];
    for (let i = 1; i <= 5; i++) temporalAggregate(history, i, 5); // [1,2,3,4,5]
    const result = temporalAggregate(history, 10, 5); // window = [2,3,4,5,10] → mean=4.8
    assert.equal(history.length, 5, "window should not exceed N=5");
    assert.equal(result, (2 + 3 + 4 + 5 + 10) / 5);
});

test("single-element window always returns the latest value", () => {
    const history: number[] = [];
    temporalAggregate(history, 99, 1);
    const result = temporalAggregate(history, 42, 1);
    assert.equal(result, 42, "window of 1 should always hold the latest value");
});

// ---------------------------------------------------------------------------
// 2. Gaussian noise (Box-Muller)
// ---------------------------------------------------------------------------

console.log("\n\x1b[1m[TEST] 2 — Gaussian noise (Box-Muller)\x1b[0m");

test("gaussianNoise returns a finite number", () => {
    const noise = gaussianNoise(0.1);
    assert.ok(isFinite(noise), "result must be a finite number");
});

test("gaussianNoise with sigma=0 always returns 0", () => {
    // z0 * 0 = 0 regardless of the Box-Muller output
    const noise = gaussianNoise(0);
    assert.equal(noise, 0);
});

test("large sigma produces larger spread (statistical sanity check)", () => {
    // Average absolute value of 1000 samples with sigma=10 should be >> with sigma=0.01
    const samples = 1000;
    const avgLarge = Array.from({ length: samples }, () => Math.abs(gaussianNoise(10)))
        .reduce((a, b) => a + b, 0) / samples;
    const avgSmall = Array.from({ length: samples }, () => Math.abs(gaussianNoise(0.01)))
        .reduce((a, b) => a + b, 0) / samples;
    assert.ok(avgLarge > avgSmall * 10, `Expected avgLarge (${avgLarge.toFixed(2)}) >> avgSmall (${avgSmall.toFixed(4)})`);
});

// ---------------------------------------------------------------------------
// 3. K-anonymity via AnonymisationEngine — two-level aggregation
// ---------------------------------------------------------------------------

console.log("\n\x1b[1m[TEST] 3 — K-anonymity (AnonymisationEngine)\x1b[0m");

// --- Single-home scenarios ------------------------------------------------

test("1 device in a home and 1 home in zone with K=1 publishes immediately", () => {
    process.env.ANON_K_THRESHOLD = "1";
    process.env.ANON_WINDOW_SIZE = "5";
    process.env.ANON_SIGMA       = "0";

    const engine = new AnonymisationEngine({
        "device-A": { homeId: "house-1", zoneId: "zone-1" }
    });
    const result = engine.process(makeProfile("device-A", 21.5));

    assert.notEqual(result, null, "Should publish when K=1");
    assert.equal(result!.zoneId, "zone-1");
    assert.equal(result!.groupId, "zone-1");
    assert.equal(result!.homeCount, 1);
    assert.equal(result!.value, 21.5);
});

test("K-anonymity: data is withheld when active homes in zone is less than K", () => {
    process.env.ANON_K_THRESHOLD = "2";
    process.env.ANON_SIGMA       = "0";

    const engine = new AnonymisationEngine({
        "dev-A1": { homeId: "house-1", zoneId: "zone-1" },
        "dev-A2": { homeId: "house-1", zoneId: "zone-1" },
        "dev-B1": { homeId: "house-2", zoneId: "zone-1" },
    });

    // 1st device of house-1 reports: house-1 has 1 active device. activeHomeCount in zone-1 is 1.
    const r1 = engine.process(makeProfile("dev-A1", 20.0));
    assert.equal(r1, null, "Should be withheld as only 1 home is active and K=2");

    // 2nd device of house-1 reports: house-1 has 2 active devices. activeHomeCount in zone-1 is still 1.
    const r2 = engine.process(makeProfile("dev-A2", 22.0));
    assert.equal(r2, null, "Should still be withheld since it is still the same home (house-1)");

    // 1st device of house-2 reports: house-2 becomes active. activeHomeCount in zone-1 is now 2.
    const r3 = engine.process(makeProfile("dev-B1", 24.0));
    assert.notEqual(r3, null, "Should publish because 2 distinct homes (house-1, house-2) are now active in the zone");
    assert.equal(r3!.zoneId, "zone-1");
    assert.equal(r3!.homeCount, 2);
    // house-1 mean = (20 + 22) / 2 = 21
    // house-2 mean = 24
    // zone mean = (21 + 24) / 2 = 22.5
    assert.equal(r3!.value, 22.5);
});

test("unknown device falls back to its own home and default-zone and publishes immediately with K=1", () => {
    process.env.ANON_K_THRESHOLD = "1";
    process.env.ANON_SIGMA       = "0";

    const engine = new AnonymisationEngine({}); // empty config
    const result = engine.process(makeProfile("unknown-device", 19.0));

    assert.notEqual(result, null, "Should publish with K=1");
    assert.equal(result!.zoneId, "default-zone");
});

test("homes in different zones are independent", () => {
    process.env.ANON_K_THRESHOLD = "2";
    process.env.ANON_SIGMA       = "0";

    const engine = new AnonymisationEngine({
        "dev-A": { homeId: "house-A", zoneId: "zone-A" },
        "dev-B": { homeId: "house-B", zoneId: "zone-B" },
    });

    const r1 = engine.process(makeProfile("dev-A", 20.0)); // zone-A: 1 home active -> withheld
    const r2 = engine.process(makeProfile("dev-B", 22.0)); // zone-B: 1 home active -> withheld

    assert.equal(r1, null, "zone-A should be withheld");
    assert.equal(r2, null, "zone-B should be withheld");
});

// --- Shape test -------------------------------------------------------------

test("GroupProfile output has the correct shape", () => {
    process.env.ANON_K_THRESHOLD = "1";
    process.env.ANON_SIGMA       = "0";

    const engine = new AnonymisationEngine({
        "dev-X": { homeId: "house-1", zoneId: "zone-1" }
    });
    const result = engine.process(makeProfile("dev-X", 23.5));

    assert.ok(result !== null);
    assert.equal(result!.groupId, "zone-1");
    assert.equal(result!.zoneId, "zone-1");
    assert.equal(result!.homeCount, 1);
    assert.equal(result!.deviceCount, 1);
    assert.ok(typeof result!.type       === "string");
    assert.ok(typeof result!.unit       === "string");
    assert.ok(typeof result!.value      === "number");
    assert.ok(typeof result!.timestamp  === "string");
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n\x1b[1m[RESULTS] ${passed} passed, ${failed} failed\x1b[0m\n`);
if (failed > 0) {
    process.exit(1);
}
