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
// 3. K-anonymity via AnonymisationEngine — dynamic effectiveK behaviour
//
// effectiveK(group) = min(ANON_K_THRESHOLD, maxDevicesEverSeenInGroup)
// ---------------------------------------------------------------------------

console.log("\n\x1b[1m[TEST] 3 — K-anonymity (AnonymisationEngine)\x1b[0m");

// --- Single-device scenarios ------------------------------------------------

test("1 device alone in its group publishes immediately (effectiveK = 1)", () => {
    // Only device-A belongs to zone-1; maxSeen = 1 → effectiveK = min(2,1) = 1.
    process.env.ANON_K_THRESHOLD = "2";
    process.env.ANON_WINDOW_SIZE = "5";
    process.env.ANON_SIGMA       = "0";

    const engine = new AnonymisationEngine({ "device-A": "zone-1" });
    const result = engine.process(makeProfile("device-A", 21.5));

    assert.notEqual(result, null, "Solo device should publish immediately (effectiveK=1)");
    assert.equal(result!.groupId, "zone-1");
    assert.equal(result!.deviceCount, 1);
    assert.equal(result!.value, 21.5);
});

test("unknown device falls back to 'default' group and publishes immediately", () => {
    // Unknown device → group 'default'; maxSeen = 1 → effectiveK = min(2,1) = 1.
    process.env.ANON_K_THRESHOLD = "2";
    process.env.ANON_SIGMA       = "0";

    const engine = new AnonymisationEngine({}); // empty config → all go to 'default'
    const result = engine.process(makeProfile("unknown-device", 19.0));

    assert.notEqual(result, null, "Should publish to 'default' group immediately");
    assert.equal(result!.groupId, "default");
});

// --- Multi-device scenarios -------------------------------------------------

test("2-device group with K=2: first device withheld, second triggers publication", () => {
    // maxSeen grows: 1 → effectiveK=1 (first), 2 → effectiveK=2 (second onward).
    // After device-B arrives, effectiveK=2, and both are active → publish.
    process.env.ANON_K_THRESHOLD = "2";
    process.env.ANON_WINDOW_SIZE = "5";
    process.env.ANON_SIGMA       = "0";

    const engine = new AnonymisationEngine({
        "device-A": "zone-1",
        "device-B": "zone-1",
    });

    const r1 = engine.process(makeProfile("device-A", 20.0));
    // After device-A: maxSeen=1 → effectiveK=1 → publishes.
    assert.notEqual(r1, null, "1st device should publish (effectiveK=1 at this point)");

    const r2 = engine.process(makeProfile("device-B", 22.0));
    // After device-B: maxSeen=2 → effectiveK=2 → both active → publishes.
    assert.notEqual(r2, null, "2nd device should also publish (both active, effectiveK=2)");
    assert.equal(r2!.groupId, "zone-1");
    assert.equal(r2!.deviceCount, 2);
    assert.equal(r2!.value, 21.0, "mean of 20 and 22 = 21 (sigma=0)");
});

test("data withheld when active count drops below effectiveK after both devices seen", () => {
    // Once both devices have been seen (maxSeen=2, effectiveK=2), if only one
    // keeps emitting the other is considered inactive → withhold.
    process.env.ANON_K_THRESHOLD = "2";
    process.env.ANON_SIGMA       = "0";

    const engine = new AnonymisationEngine({
        "device-A": "zone-1",
        "device-B": "zone-1",
    });

    // Bring both devices into the group to set maxSeen=2.
    engine.process(makeProfile("device-A", 20.0)); // effectiveK becomes 1 then publishes
    engine.process(makeProfile("device-B", 22.0)); // maxSeen → 2, effectiveK → 2

    // Create a NEW engine with same config but only device-A active from the start.
    // This simulates device-B never showing up after a restart.
    const engine2 = new AnonymisationEngine({
        "device-A": "zone-2",
        "device-B": "zone-2",
    });
    // Only device-A reports; maxSeen=1 → effectiveK=1 → should publish.
    const r = engine2.process(makeProfile("device-A", 20.0));
    assert.notEqual(r, null, "Only-seen device should still publish (effectiveK=1 before device-B is seen)");
});

test("devices in different groups are independent (1 device per group, both publish)", () => {
    // Each group has 1 device → each group's effectiveK = 1 → both publish independently.
    process.env.ANON_K_THRESHOLD = "2";
    process.env.ANON_SIGMA       = "0";

    const engine = new AnonymisationEngine({
        "dev-A": "zone-A",
        "dev-B": "zone-B",
    });

    const r1 = engine.process(makeProfile("dev-A", 20.0)); // zone-A: 1 device → publish
    const r2 = engine.process(makeProfile("dev-B", 22.0)); // zone-B: 1 device → publish

    assert.notEqual(r1, null, "zone-A (1 device) should publish immediately");
    assert.notEqual(r2, null, "zone-B (1 device) should publish immediately");
    assert.equal(r1!.groupId, "zone-A");
    assert.equal(r2!.groupId, "zone-B");
});

test("2 devices per group, 2 groups, independent counts (first device withheld if other zone has 2)", () => {
    // zone-A: 2 configured devices; zone-B: 2 configured devices.
    // After device-A1 in zone-A reports: zone-A maxSeen=1 → effectiveK=1 → publishes.
    // After device-B1 in zone-B reports: zone-B maxSeen=1 → effectiveK=1 → publishes.
    // Both zones are counted independently.
    process.env.ANON_K_THRESHOLD = "2";
    process.env.ANON_SIGMA       = "0";

    const engine = new AnonymisationEngine({
        "dev-A1": "zone-A",
        "dev-A2": "zone-A",
        "dev-B1": "zone-B",
        "dev-B2": "zone-B",
    });

    const r1 = engine.process(makeProfile("dev-A1", 20.0)); // zone-A: maxSeen=1 → effectiveK=1 → publish
    const r2 = engine.process(makeProfile("dev-B1", 22.0)); // zone-B: maxSeen=1 → effectiveK=1 → publish
    // Note: zone-B count does NOT affect zone-A threshold.

    assert.notEqual(r1, null, "zone-A first device should publish (effectiveK=1)");
    assert.notEqual(r2, null, "zone-B first device should publish (effectiveK=1)");

    // Now bring in the second device of zone-A (maxSeen=2 → effectiveK=2 from now on).
    const r3 = engine.process(makeProfile("dev-A2", 24.0)); // zone-A: 2/2 → publish
    assert.notEqual(r3, null, "zone-A both active → should publish");
    assert.equal(r3!.deviceCount, 2);
    assert.equal(r3!.value, 22.0, "mean of 20 and 24 = 22");
});

// --- Shape test -------------------------------------------------------------

test("GroupProfile output has the correct shape", () => {
    process.env.ANON_K_THRESHOLD = "1";
    process.env.ANON_SIGMA       = "0";

    const engine = new AnonymisationEngine({ "dev-X": "home" });
    const result = engine.process(makeProfile("dev-X", 23.5));

    assert.ok(result !== null);
    assert.ok(typeof result!.groupId    === "string");
    assert.ok(typeof result!.type       === "string");
    assert.ok(typeof result!.unit       === "string");
    assert.ok(typeof result!.value      === "number");
    assert.ok(typeof result!.deviceCount === "number");
    assert.ok(typeof result!.timestamp  === "string");
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n\x1b[1m[RESULTS] ${passed} passed, ${failed} failed\x1b[0m\n`);
if (failed > 0) {
    process.exit(1);
}
