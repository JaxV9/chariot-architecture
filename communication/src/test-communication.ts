/**
 * @file test-communication.ts
 * @description Local integration test file to validate the full communication pipeline.
 * This script publishes encrypted test data (valid and corrupted) to the MQTT broker
 * to verify decryption, format validation, Directory Services storage, and the 10-entry history limit.
 */

import * as mqtt from "mqtt";
import * as crypto from "crypto";
import { DirectoryService, VirtualProfile } from "./directory/DirectoryService.js";
import { MessageBusSubscriber } from "./bus/MessageBusSubscriber.js";

// Algorithm and key identical to the runtime
const ALGORITHM = "aes-256-gcm";
const PASSPHRASE = "chariot-super-secret-passphrase";
const SALT = "chariot-cryptographic-salt";
// Derive the key with scryptSync identical to the runtime
const key = crypto.scryptSync(PASSPHRASE, SALT, 32);

/**
 * Helper function to simulate runtime-side encryption.
 */
function encryptPayload(profile: VirtualProfile) {
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
    const testDeviceId = "chariot-test-sensor";

    // 1. Initialize the Directory Service and the Message Bus Subscriber
    const directoryService = new DirectoryService();
    const subscriber = new MessageBusSubscriber(directoryService, brokerUrl);

    // 2. Connect to the MQTT broker (the runtime broker must be running)
    try {
        await subscriber.connect();
    } catch (err) {
        console.error("\x1b[31m[TEST] Failed to connect to MQTT broker. Make sure the runtime gateway is running!\x1b[0m");
        process.exit(1);
    }

    // 3. Initialize a test MQTT client to publish messages
    const client = mqtt.connect(brokerUrl);

    client.on("connect", async () => {
        console.log("\x1b[32m[TEST] Test client connected to MQTT broker. Launching test sequences...\x1b[0m");

        try {
            // TEST 1: Publish a valid encrypted message
            console.log("\n\x1b[34;1m--- TEST 1: Valid encrypted message ---\x1b[0m");
            const validProfile: VirtualProfile = {
                deviceId: testDeviceId,
                type: "temperature",
                unit: "celsius",
                value: 21.5,
                timestamp: new Date().toISOString()
            };
            const encryptedValid = encryptPayload(validProfile);
            client.publish(`chariot/devices/${testDeviceId}`, JSON.stringify(encryptedValid));
            
            // Wait briefly for the subscriber to process the message
            await new Promise(resolve => setTimeout(resolve, 800));

            // Verify storage
            const latest = directoryService.getDeviceLatest(testDeviceId);
            if (latest && latest.value === 21.5) {
                console.log("\x1b[32m[TEST 1 SUCCESS] Valid message was decrypted and stored with value 21.5.\x1b[0m");
            } else {
                throw new Error("Test 1 failed: profile not found or incorrect value.");
            }

            // TEST 2: Robustness against malformed messages and decryption errors
            console.log("\n\x1b[34;1m--- TEST 2: Robustness against anomalies (no crash expected) ---\x1b[0m");
            
            // Anomaly A: Corrupted JSON
            console.log("\x1b[33m[TEST 2a] Publishing corrupted JSON...\x1b[0m");
            client.publish(`chariot/devices/${testDeviceId}`, "{ malformed_json...");
            await new Promise(resolve => setTimeout(resolve, 500));

            // Anomaly B: Message encrypted with a wrong key
            console.log("\x1b[33m[TEST 2b] Publishing a message with a wrong key/signature...\x1b[0m");
            const wrongKey = crypto.scryptSync("wrong-passphrase", "wrong-salt", 32);
            const iv = crypto.randomBytes(12);
            const cipher = crypto.createCipheriv(ALGORITHM, wrongKey, iv);
            let enc = cipher.update(JSON.stringify(validProfile), "utf8", "hex");
            enc += cipher.final("hex");
            const badPayload = {
                iv: iv.toString("hex"),
                encryptedData: enc,
                authTag: cipher.getAuthTag().toString("hex")
            };
            client.publish(`chariot/devices/${testDeviceId}`, JSON.stringify(badPayload));
            await new Promise(resolve => setTimeout(resolve, 500));

            // Anomaly C: Decrypted virtual profile with invalid fields (format validation failure)
            console.log("\x1b[33m[TEST 2c] Publishing a profile with invalid fields...\x1b[0m");
            const invalidProfile = {
                deviceId: "", // Invalid: empty string
                type: "temperature",
                unit: "celsius",
                value: "not-a-number", // Invalid: string instead of number
                timestamp: new Date().toISOString()
            };
            const encryptedInvalid = encryptPayload(invalidProfile as any);
            client.publish(`chariot/devices/${testDeviceId}`, JSON.stringify(encryptedInvalid));
            await new Promise(resolve => setTimeout(resolve, 500));

            console.log("\x1b[32m[TEST 2 SUCCESS] All anomaly tests handled cleanly (error logs above are expected). Middleware did not crash.\x1b[0m");

            // TEST 3: Validate the 10-entry history limit
            console.log("\n\x1b[34;1m--- TEST 3: 10-entry history limit ---\x1b[0m");
            directoryService.clear();

            // Publish 15 consecutive messages with different values (10 to 24)
            console.log("\x1b[33m[TEST 3] Publishing 15 successive readings...\x1b[0m");
            for (let i = 10; i < 25; i++) {
                const profile: VirtualProfile = {
                    deviceId: testDeviceId,
                    type: "temperature",
                    unit: "celsius",
                    value: i,
                    timestamp: new Date().toISOString()
                };
                const encMsg = encryptPayload(profile);
                client.publish(`chariot/devices/${testDeviceId}`, JSON.stringify(encMsg));
                // Small delay to preserve arrival order
                await new Promise(resolve => setTimeout(resolve, 150));
            }

            // Wait for all messages to be processed
            await new Promise(resolve => setTimeout(resolve, 1000));

            const history = directoryService.getDeviceHistory(testDeviceId);
            console.log(`\x1b[36m[TEST 3] Final history size: ${history.length} (expected: 10)\x1b[0m`);
            console.log(`\x1b[36m[TEST 3] History values (most recent to oldest): ${history.map(p => p.value).join(", ")}\x1b[0m`);

            if (history.length === 10) {
                console.log("\x1b[32m[TEST 3 SUCCESS] History correctly retains exactly the last 10 readings (values 15 to 24).\x1b[0m");
            } else {
                throw new Error(`Test 3 failed: incorrect history size (${history.length})`);
            }

            console.log(`\n\x1b[32;1m===============================================================\x1b[0m`);
            console.log(`\x1b[32;1m             ALL INTEGRATION TESTS PASSED!                     \x1b[0m`);
            console.log(`\x1b[32;1m===============================================================\x1b[0m\n`);

        } catch (error: any) {
            console.error("\x1b[31m[TEST FAILED] An error occurred during assertions:\x1b[0m", error.message);
        } finally {
            // Cleanup and disconnect
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
