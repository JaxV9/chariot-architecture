/**
 * @file MqttPublisher.ts
 * @description Client MQTT publiant les payloads chiffrés sur le topic chariot/devices/{deviceId}.
 */

import * as mqtt from "mqtt";
import { EncryptedPayload } from "../security/Encryption.js";

export class MqttPublisher {
    private client?: mqtt.MqttClient;
    private brokerUrl = "mqtt://localhost:1883";

    /**
     * Se connecte au broker MQTT local.
     */
    async connect(): Promise<void> {
        console.log(`\x1b[34m[MQTT PUBLISHER] Connexion au broker MQTT à l'adresse ${this.brokerUrl}...\x1b[0m`);
        
        return new Promise((resolve, reject) => {
            this.client = mqtt.connect(this.brokerUrl, {
                clientId: "chariot-gateway-publisher",
            });

            this.client.on("connect", () => {
                console.log(`\x1b[32m[MQTT PUBLISHER] Connecté au broker MQTT local.\x1b[0m`);
                resolve();
            });

            this.client.on("error", (err) => {
                console.error(`\x1b[31m[MQTT PUBLISHER] Erreur de connexion MQTT :\x1b[0m`, err);
                reject(err);
            });
        });
    }

    /**
     * Publie le payload chiffré du capteur sur le topic correspondant.
     */
    publish(deviceId: string, payload: EncryptedPayload): void {
        if (!this.client || !this.client.connected) {
            console.error(`\x1b[31m[MQTT PUBLISHER] Impossible de publier : non connecté au broker.\x1b[0m`);
            return;
        }

        const topic = `chariot/devices/${deviceId}`;
        const message = JSON.stringify(payload);

        this.client.publish(topic, message, { qos: 1 }, (err) => {
            if (err) {
                console.error(`\x1b[31m[MQTT PUBLISHER] Échec de publication sur ${topic} :\x1b[0m`, err);
            } else {
                console.log(`\x1b[32m[MQTT PUBLISHER] Message publié sur '${topic}' (taille : ${message.length} caractères).\x1b[0m`);
            }
        });
    }

    /**
     * Déconnecte proprement le client MQTT.
     */
    async disconnect(): Promise<void> {
        console.log(`\x1b[34m[MQTT PUBLISHER] Déconnexion du client MQTT...\x1b[0m`);
        return new Promise((resolve) => {
            if (this.client) {
                this.client.end(false, {}, () => {
                    console.log(`\x1b[32m[MQTT PUBLISHER] Client MQTT déconnecté.\x1b[0m`);
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }
}
