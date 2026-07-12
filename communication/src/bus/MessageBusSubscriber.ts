/**
 * @file MessageBusSubscriber.ts
 * @description MQTT client that subscribes to encrypted runtime messages, decrypts, validates, and stores them.
 */

import * as mqtt from "mqtt";
import { Encryption, EncryptedPayload } from "../security/Encryption.js";
import { DirectoryService } from "../directory/DirectoryService.js";
import { MessageFormats } from "../formats/MessageFormats.js";

export class MessageBusSubscriber {
    private client: mqtt.MqttClient | null = null;
    private encryption: Encryption;
    private directoryService: DirectoryService;
    private brokerUrl: string;

    constructor(
        directoryService: DirectoryService,
        brokerUrl = "mqtt://localhost:1883",
        passphrase?: string,
        salt?: string
    ) {
        this.directoryService = directoryService;
        this.brokerUrl = brokerUrl;
        // Initialize the decryption module with the scryptSync-derived key
        this.encryption = new Encryption(passphrase, salt);
    }

    /**
     * Connects to the MQTT broker and subscribes to the runtime's publication topic.
     */
    connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            console.log(`\x1b[34m[MESSAGE BUS] Connecting to MQTT broker at ${this.brokerUrl}...\x1b[0m`);
            
            this.client = mqtt.connect(this.brokerUrl, {
                clientId: `chariot-communication-middleware-${Math.random().toString(16).substring(2, 10)}`,
            });

            this.client.on("connect", () => {
                console.log(`\x1b[32m[MESSAGE BUS] Connected to MQTT broker.\x1b[0m`);
                const topic = "chariot/devices/+";
                
                this.client!.subscribe(topic, (err) => {
                    if (err) {
                        console.error(`\x1b[31m[MESSAGE BUS] Failed to subscribe to topic ${topic}:\x1b[0m`, err);
                        reject(err);
                    } else {
                        console.log(`\x1b[32m[MESSAGE BUS] Successfully subscribed to topic '${topic}'.\x1b[0m`);
                        resolve();
                    }
                });
            });

            this.client.on("message", (topic, messageBuffer) => {
                this.handleMessage(topic, messageBuffer);
            });

            this.client.on("error", (err) => {
                console.error(`\x1b[31m[MESSAGE BUS] MQTT error:\x1b[0m`, err);
            });
        });
    }

    /**
     * Processes each message received on the MQTT topic.
     * This function guarantees that no exception can crash the process (global try/catch).
     */
    private handleMessage(topic: string, messageBuffer: Buffer): void {
        const rawMessage = messageBuffer.toString("utf8");
        console.log(`\n\x1b[34m[MESSAGE BUS] Message received on topic: ${topic}\x1b[0m`);
        
        try {
            // Step 1: Parse the raw MQTT message into an encrypted payload (IV, encrypted data, auth tag)
            let encryptedPayload: EncryptedPayload;
            try {
                encryptedPayload = JSON.parse(rawMessage);
            } catch (err: any) {
                console.error(`\x1b[31m[MESSAGE BUS] [PARSE ERROR] Received message is not valid JSON: ${err.message}\x1b[0m`);
                return; // Stop processing this message and continue
            }

            // Step 2: Validate that the payload contains the required fields for decryption
            if (!encryptedPayload.iv || !encryptedPayload.encryptedData || !encryptedPayload.authTag) {
                console.error(`\x1b[31m[MESSAGE BUS] [ENCRYPTED FORMAT ERROR] Incomplete encrypted payload (required fields: iv, encryptedData, authTag)\x1b[0m`);
                return;
            }

            // Step 3: Decrypt the message using AES-256-GCM
            let decryptedString: string;
            try {
                decryptedString = this.encryption.decrypt(encryptedPayload);
                console.log(`\x1b[32m[MESSAGE BUS] Decryption successful with AES-256 key.\x1b[0m`);
            } catch (err: any) {
                console.error(`\x1b[31m[MESSAGE BUS] [DECRYPTION ERROR] Unable to decrypt payload (wrong key or corrupted data): ${err.message}\x1b[0m`);
                return; // Does not crash — continues running
            }

            // Step 4: Parse the decrypted virtual profile
            let decryptedJson: any;
            try {
                decryptedJson = JSON.parse(decryptedString);
            } catch (err: any) {
                console.error(`\x1b[31m[MESSAGE BUS] [PROFILE PARSE ERROR] Decrypted profile is not valid JSON: ${err.message}\x1b[0m`);
                return;
            }

            // Step 5: Validate the virtual profile format (Message Formats)
            let virtualProfile;
            try {
                virtualProfile = MessageFormats.validateAndNormalize(decryptedJson);
                console.log(`\x1b[32m[MESSAGE BUS] Structure validation successful for virtual profile.\x1b[0m`);
            } catch (err: any) {
                console.error(`\x1b[31m[MESSAGE BUS] [VALIDATION ERROR] Virtual profile does not match specs: ${err.message}\x1b[0m`);
                return; // Does not crash — continues running
            }

            // Step 6: Store/register in the Directory Services
            this.directoryService.saveProfile(virtualProfile);
            console.log(`\x1b[35m[MESSAGE BUS] [SUCCESS] Full processing pipeline completed.\x1b[0m`);

        } catch (err: any) {
            // Ultimate safety net to NEVER crash the middleware process
            console.error(`\x1b[31m[MESSAGE BUS] [UNEXPECTED CRITICAL ERROR] An unexpected error occurred: ${err.message}\x1b[0m`);
        }
    }

    /**
     * Gracefully disconnects the MQTT client.
     */
    disconnect(): Promise<void> {
        return new Promise((resolve) => {
            if (this.client) {
                console.log(`\x1b[33m[MESSAGE BUS] Disconnecting from MQTT broker...\x1b[0m`);
                this.client.end(false, {}, () => {
                    console.log(`\x1b[32m[MESSAGE BUS] Cleanly disconnected.\x1b[0m`);
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }
}
