/**
 * @file test-communication.ts
 * @description Local integration test file to validate the full communication pipeline.
 */

import * as mqtt from "mqtt";
import * as crypto from "crypto";
import { DirectoryService, ZoneProfile } from "./directory/DirectoryService.js";
import { MessageBusSubscriber } from "./bus/MessageBusSubscriber.js";
import { HomeAggregateProfile } from "./anonymisation/HomeAggregateProfile.js";

const ALGORITHM = "aes-256-gcm";
const PASSPHRASE = "chariot-super-secret-passphrase";
const SALT = "chariot-cryptographic-salt";
const key = crypto.scryptSync(PASSPHRASE, SALT, 32);

/**
 * Helper function to simulate runtime-side encryption.
 */
function encryptPayload(profile: HomeAggregateProfile) {
    const jsonString = JSON.stringify(profile);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(jsonString, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag().toString("hex");

    return {
        iv: iv.toString("hex"),
        encryptedData: encrypted,
        authTag: authTag
    };
}

async function runTests() {
    console.log(`\n\x1b[35;1m===============================================================\x1b[0m`);
    console.log(`\x1b[35;1m     INTEGRATION & ROBUSTNESS TESTS - COMMUNICATION LAYER      \x1b[0m`);
    console.log(`\x1b[35;1m===============================================================\x1b[0m\n`);

    const brokerUrl = "mqtt://localhost:1883";
    const testZoneId = "quartier-nord";

    // Configure environmental thresholds for tests
    process.env.ANON_K_THRESHOLD = "2";
    process.env.ANON_SIGMA = "0.0"; // Disable noise for predictable validation values

    // 1. Initialize Directory Service and Message Bus Subscriber
    const directoryService = new DirectoryService();
    const subscriber = new MessageBusSubscriber(directoryService, brokerUrl);

    // 2. Connect to the MQTT broker
    try {
        await subscriber.connect();
    } catch (err) {
        console.error("\x1b[31m[TEST] Failed to connect to MQTT broker. Make sure the MQTT broker is running!\x1b[0m");
        process.exit(1);
    }

    // 3. Initialize a test MQTT client to publish messages
    const client = mqtt.connect(brokerUrl);

    client.on("connect", async () => {
        console.log("\x1b[32m[TEST] Test client connected to MQTT broker. Launching test sequences...\x1b[0m");

        try {
            // TEST 1: Publish first home's data (K-anonymity should withhold)
            console.log("\n\x1b[34;1m--- TEST 1: Single home contribution (withheld) ---\x1b[0m");
            const house1Profile: HomeAggregateProfile = {
                siteId: "house-1",
                siteType: "home",
                homeId: "house-1",
                zoneId: testZoneId,
                type: "temperature",
                unit: "celsius",
                value: 20.0,
                timestamp: new Date().toISOString()
            };
            const encrypted1 = encryptPayload(house1Profile);
            client.publish(`chariot/zones/${testZoneId}`, JSON.stringify(encrypted1));
            
            await new Promise(resolve => setTimeout(resolve, 800));

            // Verify withheld in Directory Services
            const latest1 = directoryService.getZoneLatest(`${testZoneId}--home--temperature`);
            if (!latest1) {
                console.log("\x1b[32m[TEST 1 SUCCESS] Data withheld correctly (only 1 home active, K=2).\x1b[0m");
            } else {
                throw new Error("Test 1 failed: zone profile should be withheld.");
            }

            // TEST 2: Publish second home's data (K-anonymity should satisfy)
            console.log("\n\x1b[34;1m--- TEST 2: Second home contribution (published) ---\x1b[0m");
            const house2Profile: HomeAggregateProfile = {
                siteId: "house-2",
                siteType: "home",
                homeId: "house-2",
                zoneId: testZoneId,
                type: "temperature",
                unit: "celsius",
                value: 22.0,
                timestamp: new Date().toISOString()
            };
            const encrypted2 = encryptPayload(house2Profile);
            client.publish(`chariot/zones/${testZoneId}`, JSON.stringify(encrypted2));
            
            await new Promise(resolve => setTimeout(resolve, 800));

            // Verify published & stored in Directory Services
            const latest2 = directoryService.getZoneLatest(`${testZoneId}--home--temperature`);
            if (latest2 && latest2.value === 21.0) { // mean of 20 and 22 is 21
                console.log("\x1b[32m[TEST 2 SUCCESS] Zone profile published and stored with value 21.0 (K=2 threshold met).\x1b[0m");
            } else {
                throw new Error(`Test 2 failed: expected 21.0, found ${latest2 ? latest2.value : "undefined"}`);
            }

            // TEST 3: Validate history limits
            console.log("\n\x1b[34;1m--- TEST 3: 10-entry history limit ---\x1b[0m");
            directoryService.clear();

            // Publish 15 messages (meeting K-anonymity by including both house-1 and house-2)
            console.log("\x1b[33m[TEST 3] Publishing 15 successive zone readings...\x1b[0m");
            for (let i = 10; i < 25; i++) {
                // Alternating house-1 and house-2 to keep both active
                const homeId = i % 2 === 0 ? "house-1" : "house-2";
                const profile: HomeAggregateProfile = {
                    siteId: homeId,
                    siteType: "home",
                    homeId,
                    zoneId: testZoneId,
                    type: "temperature",
                    unit: "celsius",
                    value: i,
                    timestamp: new Date().toISOString()
                };
                const encMsg = encryptPayload(profile);
                client.publish(`chariot/zones/${testZoneId}`, JSON.stringify(encMsg));
                await new Promise(resolve => setTimeout(resolve, 150));
            }

            await new Promise(resolve => setTimeout(resolve, 1000));

            const history = directoryService.getZoneHistory(`${testZoneId}--home--temperature`);
            console.log(`\x1b[36m[TEST 3] Final history size: ${history.length} (expected: 10)\x1b[0m`);
            
            if (history.length === 10) {
                console.log("\x1b[32m[TEST 3 SUCCESS] History retains exactly the last 10 readings.\x1b[0m");
            } else {
                throw new Error(`Test 3 failed: incorrect history size (${history.length})`);
            }

            console.log(`\n\x1b[32;1m===============================================================\x1b[0m`);
            console.log(`\x1b[32;1m             ALL INTEGRATION TESTS PASSED!                     \x1b[0m`);
            console.log(`\x1b[32;1m===============================================================\x1b[0m\n`);

        } catch (error: any) {
            console.error("\x1b[31m[TEST FAILED] An error occurred during assertions:\x1b[0m", error.message);
        } finally {
            client.end(false, {}, () => {
                subscriber.disconnect().then(() => {
                    process.exit(0);
                });
            });
        }
    });
}

runTests().catch(err => {
    console.error("Critical test failure:", err);
});
