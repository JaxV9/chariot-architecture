/**
 * @file Encryption.ts
 * @description Services de chiffrement AES-256-GCM avec dérivation de clé via scryptSync.
 */

import * as crypto from "crypto";
import { VirtualProfile } from "../mapping/DevicesMapper.js";

export interface EncryptedPayload {
    iv: string;
    encryptedData: string;
    authTag: string;
}

export class Encryption {
    private key: Buffer;

    constructor(passphrase = "chariot-super-secret-passphrase", salt = "chariot-cryptographic-salt") {
        // Dérive une clé cryptographique valide de 32 octets (256 bits) à partir de la phrase de passe
        this.key = crypto.scryptSync(passphrase, salt, 32);
        console.log(`\x1b[32m[DATA ENCRYPTION] Clé AES-256 dérivée avec succès via scryptSync.\x1b[0m`);
    }

    /**
     * Chiffre le profil virtuel en AES-256-GCM.
     */
    encrypt(profile: VirtualProfile): EncryptedPayload {
        const jsonString = JSON.stringify(profile);
        
        // Générer un IV aléatoire de 12 octets (taille recommandée pour GCM)
        const iv = crypto.randomBytes(12);
        
        const cipher = crypto.createCipheriv("aes-256-gcm", this.key, iv);
        
        let encrypted = cipher.update(jsonString, "utf8", "hex");
        encrypted += cipher.final("hex");
        
        const authTag = cipher.getAuthTag().toString("hex");

        const result: EncryptedPayload = {
            iv: iv.toString("hex"),
            encryptedData: encrypted,
            authTag: authTag,
        };

        console.log(`\x1b[32m[DATA ENCRYPTION] Profil virtuel chiffré. IV: ${result.iv.slice(0, 8)}..., Tag: ${result.authTag.slice(0, 8)}...\x1b[0m`);
        return result;
    }

    /**
     * Déchiffre un payload chiffré (utilisé pour la vérification).
     */
    decrypt(payload: EncryptedPayload): VirtualProfile {
        const ivBuffer = Buffer.from(payload.iv, "hex");
        const authTagBuffer = Buffer.from(payload.authTag, "hex");
        
        const decipher = crypto.createDecipheriv("aes-256-gcm", this.key, ivBuffer);
        decipher.setAuthTag(authTagBuffer);
        
        let decrypted = decipher.update(payload.encryptedData, "hex", "utf8");
        decrypted += decipher.final("utf8");
        
        return JSON.parse(decrypted);
    }
}
