/**
 * @file MatterDriver.ts
 * @description Driver Matter client pour se connecter au capteur de température virtuel de CHARIOT.
 */

import { ServerNode, Seconds } from "@matter/main";
import { TemperatureMeasurementBehavior } from "@matter/main/behaviors";
import { DeviceDriver, RawReading } from "./DeviceDriver.js";

export class MatterDriver implements DeviceDriver {
    readonly id = "chariot-temp-sensor";
    readonly protocol = "matter";
    private controllerNode?: ServerNode;
    private onRawDataCallback?: (reading: RawReading) => void;

    /**
     * Démarre le contrôleur Matter et procède au commissioning du capteur virtuel.
     */
    async start(): Promise<void> {
        console.log(`\x1b[34m[DRIVER Matter] Démarrage du contrôleur Matter...\x1b[0m`);
        
        try {
            // 1. Initialiser le nœud serveur (Gateway / Contrôleur)
            this.controllerNode = await ServerNode.create({
                id: "chariot-gateway-controller",
                network: {
                    port: 0, // Utilise un port libre aléatoire pour éviter le conflit avec le capteur (port 5540)
                }
            });

            // 2. Lancer le nœud
            await this.controllerNode.start();
            console.log(`\x1b[32m[DRIVER Matter] Contrôleur démarré avec succès.\x1b[0m`);

            // 3. Lancer le commissioning
            console.log(`\x1b[34m[DRIVER Matter] Recherche et appairage avec le capteur Matter (${this.id})...\x1b[0m`);
            console.log(`\x1b[34m[DRIVER Matter] Paramètres: Passcode: 20202021, Discriminator: 3840\x1b[0m`);
            
            const clientNode = await this.controllerNode.peers.commission({
                passcode: 20202021,
                discriminator: 3840,
                // Facultatif : timeout de 60 secondes pour laisser le temps de démarrer
                timeout: Seconds(60),
            });

            console.log(`\x1b[32m[DRIVER Matter] Appairage RÉUSSI avec le capteur (${this.id}).\x1b[0m`);

            // 4. Analyser les endpoints pour trouver le cluster TemperatureMeasurement
            for (const endpoint of clientNode.endpoints) {
                if (endpoint.behaviors.has(TemperatureMeasurementBehavior)) {
                    console.log(`\x1b[32m[DRIVER Matter] Cluster de température trouvé sur l'endpoint #${endpoint.number}.\x1b[0m`);

                    // Lecture de la valeur initiale
                    const initialValue = endpoint.stateOf(TemperatureMeasurementBehavior).measuredValue;
                    if (initialValue !== undefined && initialValue !== null) {
                        console.log(`\x1b[36m[DRIVER Matter] Valeur initiale lue : ${initialValue}\x1b[0m`);
                        this.emitReading(initialValue);
                    }

                    // S'abonner aux futures mises à jour
                    endpoint.eventsOf(TemperatureMeasurementBehavior).measuredValue$Changed.on((newValue) => {
                        if (newValue !== undefined && newValue !== null) {
                            console.log(`\x1b[36m[DRIVER Matter] Notification de changement de température reçue : ${newValue}\x1b[0m`);
                            this.emitReading(newValue);
                        }
                    });
                }
            }

        } catch (error) {
            console.error(`\x1b[31m[DRIVER Matter] Échec du driver Matter :\x1b[0m`, error);
        }
    }

    /**
     * Arrête proprement le contrôleur Matter.
     */
    async stop(): Promise<void> {
        console.log(`\x1b[34m[DRIVER Matter] Arrêt du driver Matter...\x1b[0m`);
        if (this.controllerNode) {
            await this.controllerNode.close();
            console.log(`\x1b[32m[DRIVER Matter] Contrôleur Matter arrêté.\x1b[0m`);
        }
    }

    /**
     * Enregistre le callback pour la transmission des données brutes.
     */
    onRawData(callback: (reading: RawReading) => void): void {
        this.onRawDataCallback = callback;
    }

    /**
     * Émet une lecture brute formatée vers le pipeline supérieur.
     */
    private emitReading(value: number): void {
        if (this.onRawDataCallback) {
            this.onRawDataCallback({
                deviceId: this.id,
                protocol: this.protocol,
                cluster: "temperatureMeasurement",
                attribute: "measuredValue",
                value: value,
            });
        }
    }
}
