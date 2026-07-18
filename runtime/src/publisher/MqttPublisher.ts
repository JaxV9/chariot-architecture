/**
 * @file MqttPublisher.ts
 * @description MQTT client that publishes encrypted home aggregate payloads to the chariot/zones/{zoneId} topic.
 * Uses a non-blocking connection design with auto-reconnect.
 */

import * as mqtt from "mqtt";
import { EncryptedPayload } from "../security/Encryption.js";

export class MqttPublisher {
    private client?: mqtt.MqttClient;
    private brokerUrl = "mqtt://localhost:1883";

    /**
     * Connects to the local MQTT broker asynchronously without blocking the startup flow.
     */
    async connect(): Promise<void> {
        console.log(`\x1b[34m[MQTT PUBLISHER] Initiating connection to MQTT broker at ${this.brokerUrl}...\x1b[0m`);
        
        const homeId = process.env.HOME_ID ?? "default-home";

        this.client = mqtt.connect(this.brokerUrl, {
            clientId: `chariot-gateway-publisher-${homeId}-${Math.random().toString(16).substring(2, 6)}`,
            reconnectPeriod: 2000, // Retry every 2 seconds if connection is lost/unestablished
        });

        this.client.on("connect", () => {
            console.log(`\x1b[32m[MQTT PUBLISHER] Connected successfully to MQTT broker.\x1b[0m`);
        });

        this.client.on("error", (err) => {
            console.warn(`\x1b[33m[MQTT PUBLISHER] MQTT connection status: ${err.message} (will auto-retry in the background)\x1b[0m`);
        });
    }

    /**
     * Publishes an encrypted aggregate payload to the zone's MQTT topic.
     */
    publish(zoneId: string, payload: EncryptedPayload): void {
        if (!this.client) {
            console.error(`\x1b[31m[MQTT PUBLISHER] Cannot publish: MQTT client is not initialized.\x1b[0m`);
            return;
        }

        const topic = `chariot/zones/${zoneId}`;
        const message = JSON.stringify(payload);

        this.client.publish(topic, message, { qos: 1 }, (err) => {
            if (err) {
                console.error(`\x1b[31m[MQTT PUBLISHER] Failed to publish on ${topic}:\x1b[0m`, err);
            } else {
                console.log(`\x1b[32m[MQTT PUBLISHER] Message published on '${topic}' (size: ${message.length} chars).\x1b[0m`);
            }
        });
    }

    /**
     * Gracefully disconnects the MQTT client.
     */
    async disconnect(): Promise<void> {
        console.log(`\x1b[34m[MQTT PUBLISHER] Disconnecting MQTT client...\x1b[0m`);
        return new Promise((resolve) => {
            if (this.client) {
                this.client.end(false, {}, () => {
                    console.log(`\x1b[32m[MQTT PUBLISHER] MQTT client disconnected.\x1b[0m`);
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }
}
