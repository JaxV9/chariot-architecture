/**
 * @file listen.ts
 * @description Script d'écoute MQTT simple pour vérifier la publication et tester le déchiffrement.
 */

import * as mqtt from "mqtt";
import { Encryption, EncryptedPayload } from "./security/Encryption.js";

async function main() {
    console.log(`\n\x1b[35;1m===============================================================\x1b[0m`);
    console.log(`\x1b[35;1m       SCRIPT DE TEST D'ÉCOUTE ET DÉCHIFFREMENT MQTT           \x1b[0m`);
    console.log(`\x1b[35;1m===============================================================\x1b[0m\n`);

    const brokerUrl = "mqtt://localhost:1883";
    const topic = "chariot/devices/#";
    
    // Initialiser le module de déchiffrement avec la même clé scryptSync par défaut
    const encryption = new Encryption();

    console.log(`\x1b[34m[LISTEN] Connexion au broker MQTT à l'adresse ${brokerUrl}...\x1b[0m`);
    const client = mqtt.connect(brokerUrl, {
        clientId: "chariot-test-listener",
    });

    client.on("connect", () => {
        console.log(`\x1b[32m[LISTEN] Connecté avec succès. Abonnement au topic '${topic}'...\x1b[0m`);
        client.subscribe(topic, (err) => {
            if (err) {
                console.error(`\x1b[31m[LISTEN] Échec de l'abonnement :\x1b[0m`, err);
            } else {
                console.log(`\x1b[32m[LISTEN] Abonné avec succès. En attente de messages chiffrés...\x1b[0m`);
            }
        });
    });

    client.on("message", (msgTopic, messageBuffer) => {
        const rawMessage = messageBuffer.toString("utf8");
        console.log(`\n\x1b[34m[LISTEN] [Nouveau message sur topic : ${msgTopic}]\x1b[0m`);
        console.log(`\x1b[36m[LISTEN] Payload brut chiffré reçu :\x1b[0m`);
        console.log(rawMessage);

        try {
            const payload: EncryptedPayload = JSON.parse(rawMessage);
            
            // Tenter de déchiffrer
            const decryptedProfile = encryption.decrypt(payload);
            
            console.log(`\x1b[32m[LISTEN] [DÉCHIFFREMENT RÉUSSI] Profil virtuel décodé :\x1b[0m`);
            console.log(JSON.stringify(decryptedProfile, null, 2));
        } catch (error: any) {
            console.error(`\x1b[31m[LISTEN] [ERREUR DÉCHIFFREMENT] Impossible de décoder ou déchiffrer le payload :\x1b[0m`, error.message);
        }
    });

    client.on("error", (err) => {
        console.error(`\x1b[31m[LISTEN] Erreur MQTT :\x1b[0m`, err);
    });

    const shutdown = () => {
        console.log(`\n\x1b[33m[LISTEN] Déconnexion et arrêt...\x1b[0m`);
        client.end(false, {}, () => {
            process.exit(0);
        });
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
}

main().catch((err) => {
    console.error("Erreur critique dans le script d'écoute :", err);
});
