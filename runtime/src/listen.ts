/**
 * @file listen.ts
 * @description Simple MQTT listener script to verify message publication and test decryption.
 */

import * as mqtt from "mqtt";
import { Encryption, EncryptedPayload } from "./security/Encryption.js";

async function main() {
    console.log(`\n\x1b[35;1m===============================================================\x1b[0m`);
    console.log(`\x1b[35;1m       MQTT LISTEN & DECRYPT TEST SCRIPT                       \x1b[0m`);
    console.log(`\x1b[35;1m===============================================================\x1b[0m\n`);

    const brokerUrl = "mqtt://localhost:1883";
    const topic = "chariot/devices/#";
    
    // Initialize the decryption module using the same default scryptSync key
    const encryption = new Encryption();

    console.log(`\x1b[34m[LISTEN] Connecting to MQTT broker at ${brokerUrl}...\x1b[0m`);
    const client = mqtt.connect(brokerUrl, {
        clientId: "chariot-test-listener",
    });

    client.on("connect", () => {
        console.log(`\x1b[32m[LISTEN] Connected successfully. Subscribing to topic '${topic}'...\x1b[0m`);
        client.subscribe(topic, (err) => {
            if (err) {
                console.error(`\x1b[31m[LISTEN] Subscription failed:\x1b[0m`, err);
            } else {
                console.log(`\x1b[32m[LISTEN] Subscribed successfully. Waiting for encrypted messages...\x1b[0m`);
            }
        });
    });

    client.on("message", (msgTopic, messageBuffer) => {
        const rawMessage = messageBuffer.toString("utf8");
        console.log(`\n\x1b[34m[LISTEN] [New message on topic: ${msgTopic}]\x1b[0m`);
        console.log(`\x1b[36m[LISTEN] Raw encrypted payload received:\x1b[0m`);
        console.log(rawMessage);

        try {
            const payload: EncryptedPayload = JSON.parse(rawMessage);
            
            // Attempt to decrypt the payload
            const decryptedProfile = encryption.decrypt(payload);
            
            console.log(`\x1b[32m[LISTEN] [DECRYPTION SUCCESS] Decoded virtual profile:\x1b[0m`);
            console.log(JSON.stringify(decryptedProfile, null, 2));
        } catch (error: any) {
            console.error(`\x1b[31m[LISTEN] [DECRYPTION ERROR] Unable to parse or decrypt payload:\x1b[0m`, error.message);
        }
    });

    client.on("error", (err) => {
        console.error(`\x1b[31m[LISTEN] MQTT error:\x1b[0m`, err);
    });

    const shutdown = () => {
        console.log(`\n\x1b[33m[LISTEN] Disconnecting and shutting down...\x1b[0m`);
        client.end(false, {}, () => {
            process.exit(0);
        });
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
}

main().catch((err) => {
    console.error("Critical error in the listen script:", err);
});
