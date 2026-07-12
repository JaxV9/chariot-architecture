/**
 * @file EmbeddedBroker.ts
 * @description Embedded Aedes MQTT broker running the middleware locally without any external dependency.
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
     * Starts the Aedes MQTT broker on the local port.
     */
    async start(): Promise<void> {
        return new Promise((resolve) => {
            this.tcpServer = createServer(this.aedesInstance.handle);
            this.tcpServer.listen(this.port, () => {
                console.log(`\x1b[32m[EMBEDDED BROKER] Aedes MQTT broker started successfully on port ${this.port}.\x1b[0m`);
                resolve();
            });

            // Client connection events
            this.aedesInstance.on("client", (client) => {
                console.log(`\x1b[34m[EMBEDDED BROKER] Client connected: ${client.id}\x1b[0m`);
            });

            this.aedesInstance.on("clientDisconnect", (client) => {
                console.log(`\x1b[33m[EMBEDDED BROKER] Client disconnected: ${client.id}\x1b[0m`);
            });

            this.aedesInstance.on("publish", (packet, client) => {
                if (client) {
                    // Hide internal ping packets to avoid polluting the console
                    console.log(`\x1b[36m[EMBEDDED BROKER] Message published by ${client.id} on topic '${packet.topic}'\x1b[0m`);
                }
            });
        });
    }

    /**
     * Stops the Aedes MQTT broker.
     */
    async stop(): Promise<void> {
        console.log(`\x1b[34m[EMBEDDED BROKER] Stopping MQTT broker...\x1b[0m`);
        return new Promise((resolve, reject) => {
            if (this.tcpServer) {
                this.tcpServer.close((err) => {
                    if (err) {
                        reject(err);
                    } else {
                        this.aedesInstance.close(() => {
                            console.log(`\x1b[32m[EMBEDDED BROKER] MQTT broker stopped.\x1b[0m`);
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
