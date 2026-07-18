/**
 * @file Encryption.ts
 * @description AES-256-GCM encryption/decryption service with key derivation via scryptSync.
 */

import * as crypto from "crypto";
import { VirtualProfile } from "../mapping/DevicesMapper.js";
import { HomeAggregateProfile } from "../anonymisation/HomeAggregateProfile.js";

/** Union of the two possible profile shapes that can flow into encryption. */
export type EncryptableProfile = VirtualProfile | HomeAggregateProfile;

export interface EncryptedPayload {
    iv: string;
    encryptedData: string;
    authTag: string;
}

export class Encryption {
    private key: Buffer;

    constructor(passphrase = "chariot-super-secret-passphrase", salt = "chariot-cryptographic-salt") {
        // Derive a valid 32-byte (256-bit) cryptographic key from the passphrase
        this.key = crypto.scryptSync(passphrase, salt, 32);
        console.log(`\x1b[32m[DATA ENCRYPTION] AES-256 key successfully derived via scryptSync.\x1b[0m`);
    }

    /**
     * Encrypts a virtual profile using AES-256-GCM.
     */
    encrypt(profile: EncryptableProfile): EncryptedPayload {
        const jsonString = JSON.stringify(profile);
        
        // Generate a random 12-byte IV (recommended size for GCM mode)
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

        console.log(`\x1b[32m[DATA ENCRYPTION] Virtual profile encrypted. IV: ${result.iv.slice(0, 8)}..., Tag: ${result.authTag.slice(0, 8)}...\x1b[0m`);
        return result;
    }

    /**
     * Decrypts an encrypted payload (used for verification).
     */
    decrypt(payload: EncryptedPayload): EncryptableProfile {
        const ivBuffer = Buffer.from(payload.iv, "hex");
        const authTagBuffer = Buffer.from(payload.authTag, "hex");
        
        const decipher = crypto.createDecipheriv("aes-256-gcm", this.key, ivBuffer);
        decipher.setAuthTag(authTagBuffer);
        
        let decrypted = decipher.update(payload.encryptedData, "hex", "utf8");
        decrypted += decipher.final("utf8");
        
        return JSON.parse(decrypted);
    }
}
