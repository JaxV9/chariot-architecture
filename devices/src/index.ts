import { ServerNode, Logger, LogLevel } from "@matter/main";
import { TemperatureSensorDevice } from "@matter/main/devices";

/**
 * Main function to boot up the virtual Matter temperature sensor node.
 */
async function main() {
    // Configure log level to NOTICE to suppress verbose DEBUG/INFO logs
    Logger.defaultLogLevel = LogLevel.NOTICE;

    // 1. Initialize the Matter ServerNode
    const node = await ServerNode.create({
        id: "chariot-temp-sensor",
        network: {
            port: 5540,
        },
        productDescription: {
            name: "Chariot Virtual Temp Sensor",
            deviceType: TemperatureSensorDevice.deviceType,
        },
        commissioning: {
            passcode: 20202021,
            discriminator: 3840,
        }
    });

    // 2. Add the Temperature Sensor device endpoint to the node
    const tempSensor = await node.add(TemperatureSensorDevice, {
        id: "temp-sensor",
        temperatureMeasurement: {
            measuredValue: 2000,     // 20.00°C (Matter values are scaled by 100)
            minMeasuredValue: -5000,  // -50.00°C
            maxMeasuredValue: 10000,  // 100.00°C
        }
    });

    // 3. Start the node (this outputs the QR Code and pairing details in the console)
    await node.start();
    console.log("Matter Virtual Temperature Sensor is now online and commissionable.");

    // Initial temperature state (in Celsius)
    let currentTemp = 20.0;

    // 4. Periodically update the temperature using a realistic random walk
    const updateInterval = () => {
        // Realistic step: random walk fluctuation between -0.25°C and +0.25°C
        const delta = (Math.random() - 0.5) * 0.5;
        currentTemp += delta;

        // Clamp the values to keep it realistic for an indoor temperature (16°C to 26°C)
        if (currentTemp < 16.0) currentTemp = 16.0;
        if (currentTemp > 26.0) currentTemp = 26.0;

        // Matter protocol representation: 0.01°C increments
        const matterValue = Math.round(currentTemp * 100);

        // Update the cluster attribute on the device
        tempSensor.set({
            temperatureMeasurement: {
                measuredValue: matterValue
            }
        }).then(() => {
            console.log(`[SIMULATOR] Updated Temperature: ${currentTemp.toFixed(2)}°C (Matter value: ${matterValue})`);
        }).catch(err => {
            console.error("[SIMULATOR] Failed to update temperature:", err);
        });

        // Schedule next update between 5 and 10 seconds randomly
        const nextTimeout = Math.floor(Math.random() * (10000 - 5000 + 1) + 5000);
        setTimeout(updateInterval, nextTimeout);
    };

    // Start the periodic update loop
    setTimeout(updateInterval, 5000);
}

main().catch(error => {
    console.error("Failed to run virtual Matter device:", error);
});
