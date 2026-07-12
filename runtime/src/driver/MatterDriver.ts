/**
 * @file MatterDriver.ts
 * @description Driver Matter client pour se connecter au capteur de température virtuel de CHARIOT.
 */

import { ServerNode, Seconds, Logger, LogLevel } from "@matter/main";
import { TemperatureMeasurementBehavior } from "@matter/main/behaviors";
import { DeviceDriver, RawReading } from "./DeviceDriver.js";
import { ControllerBehavior } from "@matter/node/behaviors/system/controller";
import os from "os";

let targetIp = "127.0.0.1";

/**
 * Configure the network interface for Matter to avoid tunnel interfaces.
 */
function setupMdnsInterface() {
    const interfaces = os.networkInterfaces();
    const candidates = ["en0", "wlan0", "eth0", "en1"];
    let selected: string | undefined;

    for (const name of candidates) {
        if (interfaces[name] && interfaces[name].some((i: any) => !i.internal && (i.family === "IPv4" || (i.family as any) === 4))) {
            selected = name;
            break;
        }
    }

    if (!selected) {
        for (const name of Object.keys(interfaces)) {
            if (name === "lo" || name === "lo0" || name.startsWith("utun") || name.startsWith("awdl")) {
                continue;
            }
            if (interfaces[name]?.some((i: any) => !i.internal && (i.family === "IPv4" || (i.family as any) === 4))) {
                selected = name;
                break;
            }
        }
    }

    if (selected) {
        console.log(`[NETWORK] Configuring Matter controller to use network interface: ${selected}`);
        process.env.MATTER_MDNS_NETWORKINTERFACE = selected;
        process.env.PRIMARY_INTERFACE = selected;

        // Find the IPv4 address of the active interface
        const ip = interfaces[selected]?.find((i: any) => !i.internal && (i.family === "IPv4" || (i.family as any) === 4))?.address;
        if (ip) {
            console.log(`[NETWORK] Detected active interface IP: ${ip}`);
            targetIp = ip;
        }
    }
}

export class MatterDriver implements DeviceDriver {
    readonly id = "chariot-temp-sensor";
    readonly protocol = "matter";
    private controllerNode?: ServerNode;
    private onRawDataCallback?: (reading: RawReading) => void;

    /**
     * Démarre le contrôleur Matter et procède au commissioning du capteur virtuel.
     */
    async start(): Promise<void> {
        // Supprime les logs internes multicast/réseau très verbeux de matter.js
        Logger.defaultLogLevel = LogLevel.WARN;

        // Detect and configure active interface
        setupMdnsInterface();

        console.log(`\x1b[34m[DRIVER Matter] Démarrage du contrôleur Matter...\x1b[0m`);

        
        try {
            // 1. Initialiser le nœud serveur (Gateway / Contrôleur) avec le support du rôle de contrôleur
            const ControllerRootEndpoint = ServerNode.RootEndpoint.with(ControllerBehavior);

            this.controllerNode = await ServerNode.create(ControllerRootEndpoint, {
                id: "chariot-gateway-controller",
                network: {
                    port: 0, // Utilise un port libre aléatoire pour éviter le conflit avec le capteur (port 5540)
                }
            });

            // 2. Lancer le nœud
            await this.controllerNode.start();
            console.log(`\x1b[32m[DRIVER Matter] Contrôleur démarré avec succès.\x1b[0m`);

            // 3. Lancer le commissioning avec mécanisme de réessai robuste
            console.log(`\x1b[34m[DRIVER Matter] Recherche et appairage avec le capteur Matter (${this.id})...\x1b[0m`);
            console.log(`\x1b[34m[DRIVER Matter] Paramètres: Passcode: 20202021, Discriminator: 3840\x1b[0m`);
            
            let clientNode;
            const maxRetries = 5;
            const retryDelayMs = 5000;
            
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    console.log(`\x1b[34m[DRIVER Matter] Connexion directe au capteur via ${targetIp}:5540 (ATTEMPT ${attempt}/${maxRetries})...\x1b[0m`);
                    const descriptor = {
                        D: 3840,
                        CM: 1,
                        addresses: [{
                            ip: targetIp,
                            port: 5540,
                            type: "udp" as const,
                        }]
                    };
                    const peerNode = await this.controllerNode.peers.forDescriptor(descriptor);
                    
                    // Associer le nœud client au contrôleur avant l'appairage
                    this.controllerNode.peers.add(peerNode);

                    await peerNode.commission({
                        passcode: 20202021,
                    });
                    clientNode = peerNode;
                    break;
                } catch (err: any) {
                    console.warn(`\x1b[33m[DRIVER Matter] [ATTEMPT ${attempt}/${maxRetries}] Échec temporaire d'appairage direct : ${err.message || err}\x1b[0m`);
                    if (attempt === maxRetries) {
                        throw err;
                    }
                    console.log(`\x1b[34m[DRIVER Matter] Attente de ${retryDelayMs / 1000}s avant la prochaine tentative...\x1b[0m`);
                    await new Promise(resolve => setTimeout(resolve, retryDelayMs));
                }
            }

            if (!clientNode) {
                throw new Error("Impossible d'appairer le capteur Matter : clientNode non défini.");
            }

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
