/**
 * @file index.ts
 * @description Point d'entrée principal de la Gateway locale (Runtime environment) de CHARIOT.
 */

import { EmbeddedBroker } from "./broker/EmbeddedBroker.js";
import { MqttPublisher } from "./publisher/MqttPublisher.js";
import { ProtocolSupport } from "./protocols/ProtocolSupport.js";
import { MatterDriver } from "./driver/MatterDriver.js";
import { DataAccess } from "./access/DataAccess.js";
import { DevicesMapper } from "./mapping/DevicesMapper.js";
import { Encryption } from "./security/Encryption.js";

async function main() {
    console.log(`\n\x1b[35;1m===============================================================\x1b[0m`);
    console.log(`\x1b[35;1m    DEMARRAGE DE LA GATEWAY CHARIOT (RUNTIME ENVIRONMENT)      \x1b[0m`);
    console.log(`\x1b[35;1m===============================================================\x1b[0m\n`);

    // 1. Initialiser les couches de support système
    const broker = new EmbeddedBroker();
    const publisher = new MqttPublisher();
    
    // 2. Initialiser les modules de traitement du pipeline
    const protocolSupport = new ProtocolSupport();
    const dataAccess = new DataAccess();
    const mapper = new DevicesMapper();
    const encryption = new Encryption(); // Clé dérivée via scryptSync

    // 3. Lancer le Broker MQTT et connecter l'éditeur
    await broker.start();
    await publisher.connect();

    // 4. Brancher le pipeline de traitement des données
    protocolSupport.onData((reading) => {
        console.log(`\n\x1b[34m[PIPELINE] Nouvelle lecture brute reçue de ${reading.deviceId} [${reading.protocol.toUpperCase()}] : ${reading.value}\x1b[0m`);

        // Etape A : Contrôle de consentement de l'utilisateur (DataAccess)
        if (!dataAccess.isTransmissionAllowed(reading)) {
            console.log(`\x1b[33m[PIPELINE] [STOP] Donnée bloquée par Data Access. Fin du traitement.\x1b[0m`);
            return;
        }

        // Etape B : Devices Mapping (Normalisation)
        const virtualProfile = mapper.mapToVirtualProfile(reading);

        // Etape C : Chiffrement AES-256-GCM
        const encryptedPayload = encryption.encrypt(virtualProfile);

        // Etape D : Publication sur le Message Bus MQTT
        publisher.publish(reading.deviceId, encryptedPayload);
        
        console.log(`\x1b[35m[PIPELINE] [SUCCÈS] Flux complété pour la donnée de température.\x1b[0m`);
    });

    // 5. Enregistrer les drivers de protocoles actifs
    const matterDriver = new MatterDriver();
    protocolSupport.registerDriver(matterDriver);

    // 6. Démarrer les drivers de protocoles
    await protocolSupport.startAll();


    // 8. Gestion propre de l'arrêt système
    const shutdown = async () => {
        console.log(`\n\x1b[31;1m[GATEWAY] Signal d'arrêt reçu. Fermeture propre...\x1b[0m`);
        try {
            await protocolSupport.stopAll();
            await publisher.disconnect();
            await broker.stop();
            console.log(`\x1b[32m[GATEWAY] Arrêt complété avec succès.\x1b[0m`);
            process.exit(0);
        } catch (error) {
            console.error(`\x1b[31m[GATEWAY] Erreur lors de l'arrêt :\x1b[0m`, error);
            process.exit(1);
        }
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
}

main().catch((error) => {
    console.error("Échec critique au démarrage de la gateway :", error);
});
