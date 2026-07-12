/**
 * @file MatterDriver.ts
 * @description Matter client driver for connecting to the CHARIOT virtual temperature sensor.
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
     * Starts the Matter controller and commissions the virtual sensor.
     */
    async start(): Promise<void> {
        // Suppress verbose internal multicast/network logs from matter.js
        Logger.defaultLogLevel = LogLevel.WARN;

        // Detect and configure active interface
        setupMdnsInterface();

        console.log(`\x1b[34m[DRIVER Matter] Starting Matter controller...\x1b[0m`);

        
        try {
            // 1. Initialize the server node (Gateway / Controller) with controller role support
            const ControllerRootEndpoint = ServerNode.RootEndpoint.with(ControllerBehavior);

            this.controllerNode = await ServerNode.create(ControllerRootEndpoint, {
                id: "chariot-gateway-controller",
                network: {
                    port: 0, // Use a random free port to avoid conflict with the sensor (port 5540)
                }
            });

            // 2. Start the node
            await this.controllerNode.start();
            console.log(`\x1b[32m[DRIVER Matter] Controller started successfully.\x1b[0m`);

            // 3. Commission the sensor with a robust retry mechanism
            console.log(`\x1b[34m[DRIVER Matter] Searching and pairing with Matter sensor (${this.id})...\x1b[0m`);
            console.log(`\x1b[34m[DRIVER Matter] Parameters: Passcode: 20202021, Discriminator: 3840\x1b[0m`);
            
            let clientNode;
            const maxRetries = 5;
            const retryDelayMs = 5000;
            
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    console.log(`\x1b[34m[DRIVER Matter] Direct connection to sensor at ${targetIp}:5540 (ATTEMPT ${attempt}/${maxRetries})...\x1b[0m`);
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
                    
                    // Associate the peer node with the controller before commissioning
                    this.controllerNode.peers.add(peerNode);

                    await peerNode.commission({
                        passcode: 20202021,
                    });
                    clientNode = peerNode;
                    break;
                } catch (err: any) {
                    console.warn(`\x1b[33m[DRIVER Matter] [ATTEMPT ${attempt}/${maxRetries}] Temporary direct pairing failure: ${err.message || err}\x1b[0m`);
                    if (attempt === maxRetries) {
                        throw err;
                    }
                    console.log(`\x1b[34m[DRIVER Matter] Waiting ${retryDelayMs / 1000}s before next attempt...\x1b[0m`);
                    await new Promise(resolve => setTimeout(resolve, retryDelayMs));
                }
            }

            if (!clientNode) {
                throw new Error("Unable to pair with the Matter sensor: clientNode is undefined.");
            }

            console.log(`\x1b[32m[DRIVER Matter] Pairing SUCCESSFUL with sensor (${this.id}).\x1b[0m`);

            // 4. Scan endpoints to locate the TemperatureMeasurement cluster
            for (const endpoint of clientNode.endpoints) {
                if (endpoint.behaviors.has(TemperatureMeasurementBehavior)) {
                    console.log(`\x1b[32m[DRIVER Matter] Temperature cluster found on endpoint #${endpoint.number}.\x1b[0m`);

                    // Read the initial value
                    const initialValue = endpoint.stateOf(TemperatureMeasurementBehavior).measuredValue;
                    if (initialValue !== undefined && initialValue !== null) {
                        console.log(`\x1b[36m[DRIVER Matter] Initial value read: ${initialValue}\x1b[0m`);
                        this.emitReading(initialValue);
                    }

                    // Subscribe to future attribute updates
                    endpoint.eventsOf(TemperatureMeasurementBehavior).measuredValue$Changed.on((newValue) => {
                        if (newValue !== undefined && newValue !== null) {
                            console.log(`\x1b[36m[DRIVER Matter] Temperature change notification received: ${newValue}\x1b[0m`);
                            this.emitReading(newValue);
                        }
                    });
                }
            }

        } catch (error) {
            console.error(`\x1b[31m[DRIVER Matter] Matter driver failed:\x1b[0m`, error);
        }
    }

    /**
     * Gracefully stops the Matter controller.
     */
    async stop(): Promise<void> {
        console.log(`\x1b[34m[DRIVER Matter] Stopping Matter driver...\x1b[0m`);
        if (this.controllerNode) {
            await this.controllerNode.close();
            console.log(`\x1b[32m[DRIVER Matter] Matter controller stopped.\x1b[0m`);
        }
    }

    /**
     * Registers the callback for raw data transmission to the pipeline.
     */
    onRawData(callback: (reading: RawReading) => void): void {
        this.onRawDataCallback = callback;
    }

    /**
     * Emits a formatted raw reading to the upstream pipeline.
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
