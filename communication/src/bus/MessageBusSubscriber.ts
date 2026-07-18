/**
 * @file MessageBusSubscriber.ts
 * @description MQTT client that subscribes to encrypted home aggregate payloads, decrypts, checks K-anonymity, applies noise, and stores results.
 */

import * as mqtt from "mqtt";
import { Encryption, EncryptedPayload } from "../security/Encryption.js";
import { DirectoryService } from "../directory/DirectoryService.js";
import { MessageFormats } from "../formats/MessageFormats.js";
import { AnonymisationProcessor } from "../anonymisation/AnonymisationProcessor.js";

export class MessageBusSubscriber {
    private client: mqtt.MqttClient | null = null;
    private encryption: Encryption;
    private directoryService: DirectoryService;
    private anonymisationProcessor: AnonymisationProcessor;
    private brokerUrl: string;

    private kThreshold: number;
    private sigma: number;

    constructor(
        directoryService: DirectoryService,
        brokerUrl = "mqtt://localhost:1883",
        passphrase?: string,
        salt?: string
    ) {
        this.directoryService = directoryService;
        this.brokerUrl = brokerUrl;
        this.encryption = new Encryption(passphrase, salt);

        this.kThreshold = parseInt(process.env.ANON_K_THRESHOLD ?? "2", 10);
        this.sigma = parseFloat(process.env.ANON_SIGMA ?? "0.1");

        // Initialize AnonymisationProcessor with callback to emit telemetry
        this.anonymisationProcessor = new AnonymisationProcessor((event) => {
            this.directoryService.emitTelemetry(event);
        });

        // Register configuration updates from the dashboard
        this.directoryService.onConfigUpdate((config) => {
            if (config.kThreshold !== undefined) {
                this.kThreshold = config.kThreshold;
            }
            if (config.sigma !== undefined) {
                this.sigma = config.sigma;
            }
            console.log(`\x1b[35m[MESSAGE BUS] Config updated dynamically — K=${this.kThreshold}, σ=${this.sigma}\x1b[0m`);
            
            // Broadcast the configuration back to dashboard
            this.directoryService.emitTelemetry({
                layer: "communication",
                step: "config",
                kThreshold: this.kThreshold,
                sigma: this.sigma,
                timestamp: new Date().toISOString()
            } as any);
        });

        this.directoryService.onConnect(() => {
            this.directoryService.emitTelemetry({
                layer: "communication",
                step: "config",
                kThreshold: this.kThreshold,
                sigma: this.sigma,
                timestamp: new Date().toISOString()
            } as any);
        });
    }

    /**
     * Connects to the MQTT broker and subscribes to the zone aggregation topic.
     */
    connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            console.log(`\x1b[34m[MESSAGE BUS] Connecting to MQTT broker at ${this.brokerUrl}...\x1b[0m`);
            
            this.client = mqtt.connect(this.brokerUrl, {
                clientId: `chariot-communication-middleware-${Math.random().toString(16).substring(2, 10)}`,
            });

            this.client.on("connect", () => {
                console.log(`\x1b[32m[MESSAGE BUS] Connected to MQTT broker.\x1b[0m`);
                const topic = "chariot/zones/+";
                
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
     */
    private handleMessage(topic: string, messageBuffer: Buffer): void {
        const rawMessage = messageBuffer.toString("utf8");
        console.log(`\n\x1b[34m[MESSAGE BUS] Message received on topic: ${topic}\x1b[0m`);
        
        try {
            // Step 1: Parse the raw MQTT message into an encrypted payload
            let encryptedPayload: EncryptedPayload;
            try {
                encryptedPayload = JSON.parse(rawMessage);
            } catch (err: any) {
                console.error(`\x1b[31m[MESSAGE BUS] [PARSE ERROR] Received message is not valid JSON: ${err.message}\x1b[0m`);
                return;
            }

            // Step 2: Validate payload structure
            if (!encryptedPayload.iv || !encryptedPayload.encryptedData || !encryptedPayload.authTag) {
                console.error(`\x1b[31m[MESSAGE BUS] [ENCRYPTED FORMAT ERROR] Incomplete encrypted payload\x1b[0m`);
                return;
            }

            // Step 3: Decrypt using AES-256-GCM
            let decryptedString: string;
            try {
                decryptedString = this.encryption.decrypt(encryptedPayload);
                console.log(`\x1b[32m[MESSAGE BUS] Decryption successful with AES-256 key.\x1b[0m`);
            } catch (err: any) {
                console.error(`\x1b[31m[MESSAGE BUS] [DECRYPTION ERROR] Unable to decrypt payload: ${err.message}\x1b[0m`);
                return;
            }

            // Step 4: Parse decrypted profile
            let decryptedJson: any;
            try {
                decryptedJson = JSON.parse(decryptedString);
            } catch (err: any) {
                console.error(`\x1b[31m[MESSAGE BUS] [PROFILE PARSE ERROR] Decrypted profile is not valid JSON: ${err.message}\x1b[0m`);
                return;
            }

            // Step 5: Validate home aggregate format
            let homeProfile;
            try {
                homeProfile = MessageFormats.validateAndNormalize(decryptedJson);
                console.log(`\x1b[32m[MESSAGE BUS] Structure validation successful for home aggregate profile.\x1b[0m`);
            } catch (err: any) {
                console.error(`\x1b[31m[MESSAGE BUS] [VALIDATION ERROR] Decrypted profile does not match specs: ${err.message}\x1b[0m`);
                return;
            }

            // Emit decryption telemetry for dashboard format tab
            this.directoryService.emitTelemetry({
                layer: "communication_decrypt",
                encryptedPayload: encryptedPayload,
                decryptedPayload: homeProfile,
                timestamp: new Date().toISOString()
            });

            // Step 6: Process K-anonymity & Noise Injection
            const zoneProfile = this.anonymisationProcessor.process(homeProfile, this.kThreshold, this.sigma);
            
            if (zoneProfile) {
                // Step 7: Store in Directory Services
                this.directoryService.saveProfile(zoneProfile);
                console.log(`\x1b[35m[MESSAGE BUS] [SUCCESS] Pipeline completed. Zone aggregate stored.\x1b[0m`);
            } else {
                console.log(`\x1b[33m[MESSAGE BUS] [STOP] Data withheld by privacy filter (K threshold not met).\x1b[0m`);
            }

        } catch (err: any) {
            console.error(`\x1b[31m[MESSAGE BUS] [UNEXPECTED CRITICAL ERROR] ${err.message}\x1b[0m`);
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
