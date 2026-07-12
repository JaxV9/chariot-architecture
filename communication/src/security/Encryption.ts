/**
 * @file Encryption.ts
 * @description AES-256-GCM decryption service with key derivation via scryptSync.
 */

import * as crypto from "crypto";

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
        console.log(`\x1b[32m[DECRYPTION MODULE] AES-256 key successfully derived via scryptSync.\x1b[0m`);
    }

    /**
     * Decrypts an AES-256-GCM encrypted payload.
     * This function is always called from within a try/catch in the caller to prevent crashes on corrupted messages.
     */
    decrypt(payload: EncryptedPayload): string {
        const ivBuffer = Buffer.from(payload.iv, "hex");
        const authTagBuffer = Buffer.from(payload.authTag, "hex");
        
        const decipher = crypto.createDecipheriv("aes-256-gcm", this.key, ivBuffer);
        decipher.setAuthTag(authTagBuffer);
        
        let decrypted = decipher.update(payload.encryptedData, "hex", "utf8");
        decrypted += decipher.final("utf8");
        
        return decrypted;
    }
}
