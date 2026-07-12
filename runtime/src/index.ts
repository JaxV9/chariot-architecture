/**
 * @file index.ts
 * @description Main entry point of the CHARIOT local gateway (Runtime environment).
 */

import { EmbeddedBroker } from "./broker/EmbeddedBroker.js";
import { MqttPublisher } from "./publisher/MqttPublisher.js";
import { ProtocolSupport } from "./protocols/ProtocolSupport.js";
import { MatterDriver } from "./driver/MatterDriver.js";
import { DataAccess } from "./access/DataAccess.js";
import { DevicesMapper } from "./mapping/DevicesMapper.js";
import { Encryption } from "./security/Encryption.js";
import { AnonymisationEngine } from "./anonymisation/AnonymisationEngine.js";

async function main() {
    console.log(`\n\x1b[35;1m===============================================================\x1b[0m`);
    console.log(`\x1b[35;1m    STARTING CHARIOT GATEWAY (RUNTIME ENVIRONMENT)             \x1b[0m`);
    console.log(`\x1b[35;1m===============================================================\x1b[0m\n`);

    // 1. Initialize the system support layers
    const broker = new EmbeddedBroker();
    const publisher = new MqttPublisher();

    // 2. Initialize the pipeline processing modules
    const protocolSupport = new ProtocolSupport();
    const dataAccess = new DataAccess();
    const mapper = new DevicesMapper();
    const encryption = new Encryption(); // Key derived via scryptSync

    // Anonymisation is enabled by default; set ANONYMIZATION_ENABLED=false to bypass
    const anonymisationEnabled = (process.env.ANONYMIZATION_ENABLED ?? "true") !== "false";
    const anonymisationEngine = new AnonymisationEngine();

    if (anonymisationEnabled) {
        console.log(`\x1b[35m[GATEWAY] Anonymisation pipeline ENABLED (K=${process.env.ANON_K_THRESHOLD ?? 2}, N=${process.env.ANON_WINDOW_SIZE ?? 5}, σ=${process.env.ANON_SIGMA ?? 0.1})\x1b[0m`);
    } else {
        console.log(`\x1b[33m[GATEWAY] Anonymisation pipeline DISABLED — raw virtual profiles will be published.\x1b[0m`);
    }

    // 3. Start the MQTT broker and connect the publisher
    await broker.start();
    await publisher.connect();

    // 4. Wire up the data processing pipeline
    protocolSupport.onData((reading) => {
        console.log(`\n\x1b[34m[PIPELINE] New raw reading received from ${reading.deviceId} [${reading.protocol.toUpperCase()}]: ${reading.value}\x1b[0m`);

        // Step A: User consent check (DataAccess)
        if (!dataAccess.isTransmissionAllowed(reading)) {
            console.log(`\x1b[33m[PIPELINE] [STOP] Data blocked by Data Access. Processing halted.\x1b[0m`);
            return;
        }

        // Step B: Devices Mapping (Normalization → VirtualProfile)
        const virtualProfile = mapper.mapToVirtualProfile(reading);

        // Step C: Anonymisation pipeline (temporal aggregation → k-anonymity → Gaussian noise)
        if (anonymisationEnabled) {
            const groupProfile = anonymisationEngine.process(virtualProfile);

            if (groupProfile === null) {
                // K threshold not reached — data withheld, pipeline stops here
                console.log(`\x1b[33m[PIPELINE] [STOP] Anonymisation withheld data (K threshold not reached). No MQTT publish.\x1b[0m`);
                return;
            }

            // Step D: AES-256-GCM Encryption (on GroupProfile)
            const encryptedPayload = encryption.encrypt(groupProfile);

            // Step E: Publish to MQTT Message Bus (topic keyed by groupId)
            publisher.publish(groupProfile.groupId, encryptedPayload);

            console.log(`\x1b[35m[PIPELINE] [SUCCESS] Anonymised group profile published for group '${groupProfile.groupId}' (${groupProfile.deviceCount} device(s)).\x1b[0m`);

        } else {
            // Anonymisation disabled — pass VirtualProfile directly

            // Step D: AES-256-GCM Encryption (on VirtualProfile)
            const encryptedPayload = encryption.encrypt(virtualProfile);

            // Step E: Publish to MQTT Message Bus (topic keyed by deviceId)
            publisher.publish(reading.deviceId, encryptedPayload);

            console.log(`\x1b[35m[PIPELINE] [SUCCESS] Pipeline completed for device '${reading.deviceId}'.\x1b[0m`);
        }
    });

    // 5. Register the active protocol drivers
    const matterDriver = new MatterDriver();
    protocolSupport.registerDriver(matterDriver);

    // 6. Start all registered protocol drivers
    await protocolSupport.startAll();


    // 8. Handle graceful system shutdown
    const shutdown = async () => {
        console.log(`\n\x1b[31;1m[GATEWAY] Shutdown signal received. Closing gracefully...\x1b[0m`);
        try {
            await protocolSupport.stopAll();
            await publisher.disconnect();
            await broker.stop();
            console.log(`\x1b[32m[GATEWAY] Shutdown completed successfully.\x1b[0m`);
            process.exit(0);
        } catch (error) {
            console.error(`\x1b[31m[GATEWAY] Error during shutdown:\x1b[0m`, error);
            process.exit(1);
        }
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
}

main().catch((error) => {
    console.error("Critical failure during gateway startup:", error);
});
