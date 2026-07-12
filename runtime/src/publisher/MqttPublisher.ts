/**
 * @file MqttPublisher.ts
 * @description MQTT client that publishes encrypted payloads to the chariot/devices/{deviceId} topic.
 */

import * as mqtt from "mqtt";
import { EncryptedPayload } from "../security/Encryption.js";

export class MqttPublisher {
    private client?: mqtt.MqttClient;
    private brokerUrl = "mqtt://localhost:1883";

    /**
     * Connects to the local MQTT broker.
     */
    async connect(): Promise<void> {
        console.log(`\x1b[34m[MQTT PUBLISHER] Connecting to MQTT broker at ${this.brokerUrl}...\x1b[0m`);
        
        return new Promise((resolve, reject) => {
            this.client = mqtt.connect(this.brokerUrl, {
                clientId: "chariot-gateway-publisher",
            });

            this.client.on("connect", () => {
                console.log(`\x1b[32m[MQTT PUBLISHER] Connected to local MQTT broker.\x1b[0m`);
                resolve();
            });

            this.client.on("error", (err) => {
                console.error(`\x1b[31m[MQTT PUBLISHER] MQTT connection error:\x1b[0m`, err);
                reject(err);
            });
        });
    }

    /**
     * Publishes an encrypted sensor payload to the device's MQTT topic.
     */
    publish(deviceId: string, payload: EncryptedPayload): void {
        if (!this.client || !this.client.connected) {
            console.error(`\x1b[31m[MQTT PUBLISHER] Cannot publish: not connected to broker.\x1b[0m`);
            return;
        }

        const topic = `chariot/devices/${deviceId}`;
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
