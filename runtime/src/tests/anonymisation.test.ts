/**
 * @file anonymisation.test.ts
 * @description Unit tests for the local gateway aggregation steps (temporal and intra-home).
 * Run with:
 *   npx tsx src/tests/anonymisation.test.ts
 */

import assert from "node:assert/strict";
import { temporalAggregate, AnonymisationEngine } from "../anonymisation/AnonymisationEngine.js";
import { DevicesMapper, VirtualProfile } from "../mapping/DevicesMapper.js";

function makeProfile(deviceId: string, type: string, value: number): VirtualProfile {
    return { deviceId, type, unit: "celsius", value, timestamp: new Date().toISOString() };
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
    const history: number[] = [];
    for (let i = 1; i <= 5; i++) temporalAggregate(history, i, 5); // [1,2,3,4,5]
    const result = temporalAggregate(history, 10, 5); // window = [2,3,4,5,10] → mean=4.8
    assert.equal(history.length, 5, "window should not exceed N=5");
    assert.equal(result, (2 + 3 + 4 + 5 + 10) / 5);
});

// ---------------------------------------------------------------------------
// 2. Intra-home aggregation
// ---------------------------------------------------------------------------

console.log("\n\x1b[1m[TEST] 2 — Intra-home aggregation (AnonymisationEngine)\x1b[0m");

test("aggregates multiple devices of the same type in a home immediately", () => {
    process.env.HOME_ID = "house-1";
    process.env.ZONE_ID = "zone-1";
    process.env.ANON_WINDOW_SIZE = "5";

    const engine = new AnonymisationEngine();

    // First temperature device publishes
    const r1 = engine.process(makeProfile("device-A", "temperature", 20.0));
    assert.notEqual(r1, null);
    assert.equal(r1!.homeId, "house-1");
    assert.equal(r1!.zoneId, "zone-1");
    assert.equal(r1!.type, "temperature");
    assert.equal(r1!.value, 20.0);

    // Second temperature device publishes
    const r2 = engine.process(makeProfile("device-B", "temperature", 22.0));
    assert.notEqual(r2, null);
    assert.equal(r2!.value, 21.0); // mean of A (20.0) and B (22.0)
});

test("does not mix different sensor types during aggregation", () => {
    process.env.HOME_ID = "house-1";
    process.env.ZONE_ID = "zone-1";

    const engine = new AnonymisationEngine();

    // Temp device publishes
    const r1 = engine.process(makeProfile("device-temp", "temperature", 20.0));
    // Humidity device publishes
    const r2 = engine.process(makeProfile("device-humidity", "humidity", 50.0));

    assert.notEqual(r1, null);
    assert.equal(r1!.type, "temperature");
    assert.equal(r1!.value, 20.0);

    assert.notEqual(r2, null);
    assert.equal(r2!.type, "humidity");
    assert.equal(r2!.value, 50.0); // should not be influenced by temperature value
});

test("security_event conversion (normal/door_open/alarm_triggered -> 0/1 -> frequency aggregated)", () => {
    const mapper = new DevicesMapper();
    
    // Map normal, door_open, and alarm_triggered raw security states
    const rNormal = mapper.mapToVirtualProfile({
        deviceId: "sec-01",
        protocol: "zigbee",
        cluster: "security",
        attribute: "value",
        value: "normal"
    });
    const rDoorOpen = mapper.mapToVirtualProfile({
        deviceId: "sec-01",
        protocol: "zigbee",
        cluster: "security",
        attribute: "value",
        value: "door_open"
    });
    const rAlarm = mapper.mapToVirtualProfile({
        deviceId: "sec-01",
        protocol: "zigbee",
        cluster: "security",
        attribute: "value",
        value: "alarm_triggered"
    });

    assert.equal(rNormal.value, 0, "normal should map to 0");
    assert.equal(rDoorOpen.value, 1, "door_open should map to 1");
    assert.equal(rAlarm.value, 1, "alarm_triggered should map to 1");
    assert.equal(rNormal.type, "security_event");
    assert.equal(rNormal.unit, "frequency");

    // Configure environmental variables for aggregating this building's security anomalies
    process.env.SITE_ID = "building-1";
    process.env.SITE_TYPE = "building";
    process.env.ZONE_ID = "quartier-nord";
    process.env.ANON_WINDOW_SIZE = "3"; // sliding window size of 3

    const engine = new AnonymisationEngine();

    // 1st: normal (value: 0) -> smoothed: 0
    const agg1 = engine.process(rNormal);
    assert.notEqual(agg1, null);
    assert.equal(agg1!.value, 0.0);

    // 2nd: door_open (value: 1) -> smoothed: (0 + 1) / 2 = 0.50
    const agg2 = engine.process(rDoorOpen);
    assert.notEqual(agg2, null);
    assert.equal(agg2!.value, 0.50);

    // 3rd: normal (value: 0) -> smoothed: (0 + 1 + 0) / 3 = 0.33
    const agg3 = engine.process(rNormal);
    assert.notEqual(agg3, null);
    assert.equal(agg3!.value, 0.33);

    // 4th: alarm (value: 1) -> window slides to [1, 0, 1] -> smoothed: (1 + 0 + 1) / 3 = 0.67
    const agg4 = engine.process(rAlarm);
    assert.notEqual(agg4, null);
    assert.equal(agg4!.value, 0.67);
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n\x1b[1m[RESULTS] ${passed} passed, ${failed} failed\x1b[0m\n`);
if (failed > 0) {
    process.exit(1);
}
