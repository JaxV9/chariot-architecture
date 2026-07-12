/**
 * @file EmbeddedBroker.ts
 * @description Broker MQTT Aedes embarqué pour exécuter le middleware en local sans dépendance externe.
 */

import Aedes from "aedes";
import { createServer, Server } from "net";

export class EmbeddedBroker {
    private aedesInstance: Aedes;
    private tcpServer?: Server;
    private port = 1883;

    constructor() {
        this.aedesInstance = new Aedes();
    }

    /**
     * Démarre le broker MQTT Aedes sur le port local.
     */
    async start(): Promise<void> {
        return new Promise((resolve) => {
            this.tcpServer = createServer(this.aedesInstance.handle);
            this.tcpServer.listen(this.port, () => {
                console.log(`\x1b[32m[EMBEDDED BROKER] Broker MQTT Aedes démarré avec succès sur le port ${this.port}.\x1b[0m`);
                resolve();
            });

            // Événements de connexion client
            this.aedesInstance.on("client", (client) => {
                console.log(`\x1b[34m[EMBEDDED BROKER] Client connecté : ${client.id}\x1b[0m`);
            });

            this.aedesInstance.on("clientDisconnect", (client) => {
                console.log(`\x1b[33m[EMBEDDED BROKER] Client déconnecté : ${client.id}\x1b[0m`);
            });

            this.aedesInstance.on("publish", (packet, client) => {
                if (client) {
                    // Masquer les pings internes pour éviter de polluer la console
                    console.log(`\x1b[36m[EMBEDDED BROKER] Message publié par ${client.id} sur le topic '${packet.topic}'\x1b[0m`);
                }
            });
        });
    }

    /**
     * Arrête le broker MQTT Aedes.
     */
    async stop(): Promise<void> {
        console.log(`\x1b[34m[EMBEDDED BROKER] Arrêt du broker MQTT...\x1b[0m`);
        return new Promise((resolve, reject) => {
            if (this.tcpServer) {
                this.tcpServer.close((err) => {
                    if (err) {
                        reject(err);
                    } else {
                        this.aedesInstance.close(() => {
                            console.log(`\x1b[32m[EMBEDDED BROKER] Broker MQTT arrêté.\x1b[0m`);
                            resolve();
                        });
                    }
                });
            } else {
                resolve();
            }
        });
    }
}
