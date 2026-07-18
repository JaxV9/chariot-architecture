/**
 * @file index.ts
 * @description Main entry point of the CHARIOT local gateway (Runtime environment).
 */

import { EmbeddedBroker } from "./broker/EmbeddedBroker.js";
import { MqttPublisher } from "./publisher/MqttPublisher.js";
import { ProtocolSupport } from "./protocols/ProtocolSupport.js";
import { MatterDriver } from "./driver/MatterDriver.js";
import { MockDriver } from "./driver/MockDriver.js";
import { EnergyMockDriver } from "./driver/EnergyMockDriver.js";
import { PresenceMockDriver } from "./driver/PresenceMockDriver.js";
import { SecurityMockDriver } from "./driver/SecurityMockDriver.js";
import { AirQualityMockDriver } from "./driver/AirQualityMockDriver.js";
import { DataAccess } from "./access/DataAccess.js";
import { DevicesMapper } from "./mapping/DevicesMapper.js";
import { Encryption } from "./security/Encryption.js";
import { AnonymisationEngine } from "./anonymisation/AnonymisationEngine.js";
import { TelemetryClient } from "./telemetry/TelemetryClient.js";

async function main() {
    const siteId = process.env.SITE_ID ?? process.env.HOME_ID ?? "house-1";
    const siteType = (process.env.SITE_TYPE ?? "home") as "home" | "building";
    const homeId = siteId; // backward compatibility
    const zoneId = process.env.ZONE_ID ?? "quartier-nord";
    const startBroker = (process.env.START_BROKER ?? "true") !== "false";

    console.log(`\n\x1b[35;1m===============================================================\x1b[0m`);
    console.log(`\x1b[35;1m    STARTING CHARIOT GATEWAY [SITE: ${siteId.toUpperCase()} (${siteType.toUpperCase()}), ZONE: ${zoneId.toUpperCase()}]   \x1b[0m`);
    console.log(`\x1b[35;1m===============================================================\x1b[0m\n`);

    // 1. Initialize the system support layers
    const broker = startBroker ? new EmbeddedBroker() : null;
    const publisher = new MqttPublisher();

    // Initialize optional telemetry client (no-op if TELEMETRY_ENABLED !== "true")
    const telemetry = new TelemetryClient();

    // 2. Initialize the pipeline processing modules
    const protocolSupport = new ProtocolSupport();
    const dataAccess = new DataAccess();
    const mapper = new DevicesMapper();
    const encryption = new Encryption(); // Key derived via scryptSync

    // Anonymisation is enabled by default; set ANONYMIZATION_ENABLED=false to bypass
    const anonymisationEnabled = (process.env.ANONYMIZATION_ENABLED ?? "true") !== "false";
    const anonymisationEngine = new AnonymisationEngine(
        undefined,
        // Pass telemetry callback only when both pipelines are active
        (event) => telemetry.emit({ layer: "runtime", ...event })
    );

    if (anonymisationEnabled) {
        console.log(`\x1b[35m[GATEWAY] Aggregation pipeline ENABLED (Window N=${anonymisationEngine.getWindowSize()})\x1b[0m`);

        // Register config update receiver
        telemetry.onConfigUpdate((config) => {
            anonymisationEngine.updateConfig(config);
            // Broadcast the new config back as runtime telemetry
            telemetry.emit({
                layer: "runtime",
                step: "config",
                kThreshold: anonymisationEngine.getKThreshold(),
                sigma: anonymisationEngine.getSigma(),
                windowSize: anonymisationEngine.getWindowSize(),
                timestamp: new Date().toISOString()
            } as any);
        });

        // Register connect/reconnect callback to push current config
        telemetry.onConnect(() => {
            telemetry.emit({
                layer: "runtime",
                step: "config",
                kThreshold: anonymisationEngine.getKThreshold(),
                sigma: anonymisationEngine.getSigma(),
                windowSize: anonymisationEngine.getWindowSize(),
                timestamp: new Date().toISOString()
            } as any);
        });
    } else {
        console.log(`\x1b[33m[GATEWAY] Aggregation pipeline DISABLED — raw virtual profiles will be published.\x1b[0m`);
    }

    // 3. Start the MQTT broker (if configured to start locally) and connect the publisher
    if (broker) {
        await broker.start();
    }
    await publisher.connect();

    // 4. Wire up the data processing pipeline
    protocolSupport.onData((reading) => {
        console.log(`\n\x1b[34m[PIPELINE] New raw reading received from ${reading.deviceId} [${reading.protocol.toUpperCase()}]: ${reading.value}\x1b[0m`);

        // Step B: Devices Mapping (Normalization → VirtualProfile)
        const virtualProfile = mapper.mapToVirtualProfile(reading);

        // Emit device-level telemetry event
        let telemetryRawValue = reading.value;
        if (reading.protocol === "matter") {
            if (reading.cluster === "temperatureMeasurement" && reading.attribute === "measuredValue") {
                telemetryRawValue = reading.value / 100;
            }
        }

        telemetry.emit({
            layer: "devices",
            deviceId: reading.deviceId,
            protocol: reading.protocol,
            rawValue: telemetryRawValue,
            siteId,
            siteType,
            homeId,
            zoneId,
            timestamp: new Date().toISOString(),
            rawReading: {
                deviceId: reading.deviceId,
                protocol: reading.protocol,
                cluster: reading.cluster,
                attribute: reading.attribute,
                value: reading.value,
                timestamp: new Date().toISOString()
            },
            virtualProfile: virtualProfile
        });

        // Step A: User consent check (DataAccess)
        if (!dataAccess.isTransmissionAllowed(reading)) {
            console.log(`\x1b[33m[PIPELINE] [STOP] Data blocked by Data Access. Processing halted.\x1b[0m`);
            return;
        }

        // Step C: Aggregation pipeline (temporal smoothing → intra-home aggregation)
        if (anonymisationEnabled) {
            const homeAggregate = anonymisationEngine.process(virtualProfile);

            if (homeAggregate === null) {
                return;
            }

            // Step D: AES-256-GCM Encryption (on HomeAggregateProfile)
            const encryptedPayload = encryption.encrypt(homeAggregate);

            // Step E: Publish to MQTT Message Bus (topic keyed by zoneId)
            publisher.publish(homeAggregate.zoneId, encryptedPayload);

            console.log(`\x1b[35m[PIPELINE] [SUCCESS] Aggregated home profile published for zone '${homeAggregate.zoneId}'.\x1b[0m`);

        } else {
            // Aggregation disabled — pass VirtualProfile directly (fallback mode)
            const encryptedPayload = encryption.encrypt(virtualProfile);
            publisher.publish(zoneId, encryptedPayload);

            console.log(`\x1b[35m[PIPELINE] [SUCCESS] Pipeline completed for device '${reading.deviceId}' (raw mode).\x1b[0m`);
        }
    });

    // Parse device IDs to load
    let deviceIds: string[] = [];
    if (process.env.DEVICE_IDS) {
        deviceIds = process.env.DEVICE_IDS.split(",").map(id => id.trim());
    } else {
        // Defaults based on siteType / siteId
        if (siteType === "building") {
            deviceIds = ["zigbee-occupancy-01", "zigbee-security-01", "thread-airquality-01"];
        } else if (siteId === "house-1") {
            deviceIds = ["matter-temp-01", "zigbee-temp-01", "zigbee-energy-01"];
        } else if (siteId === "house-2") {
            deviceIds = ["thread-temp-01", "thread-energy-01"];
        } else {
            deviceIds = ["matter-temp-01", "zigbee-energy-01"];
        }
    }

    // 5. Register the active protocol drivers
    for (const dId of deviceIds) {
        const protocol = dId.startsWith("thread") ? "thread" : "zigbee";
        if (dId === "matter-temp-01") {
            const matterDriver = new MatterDriver();
            protocolSupport.registerDriver(matterDriver);
        } else if (dId.includes("energy")) {
            const energyDriver = new EnergyMockDriver(dId, protocol);
            protocolSupport.registerDriver(energyDriver);
        } else if (dId.includes("occupancy")) {
            const occupancyDriver = new PresenceMockDriver(dId, protocol);
            protocolSupport.registerDriver(occupancyDriver);
        } else if (dId.includes("security")) {
            const securityDriver = new SecurityMockDriver(dId, protocol);
            protocolSupport.registerDriver(securityDriver);
        } else if (dId.includes("airquality")) {
            const airQualityDriver = new AirQualityMockDriver(dId, protocol);
            protocolSupport.registerDriver(airQualityDriver);
        } else {
            const mockDriver = new MockDriver(dId, protocol);
            protocolSupport.registerDriver(mockDriver);
        }
    }

    // 6. Start all registered protocol drivers
    await protocolSupport.startAll();

    // 8. Handle graceful system shutdown
    const shutdown = async () => {
        console.log(`\n\x1b[31;1m[GATEWAY] Shutdown signal received. Closing gracefully...\x1b[0m`);
        try {
            await protocolSupport.stopAll();
            await publisher.disconnect();
            if (broker) {
                await broker.stop();
            }
            telemetry.close();
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
