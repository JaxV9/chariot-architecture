/**
 * @file DevicesMapper.ts
 * @description Maps raw driver readings to normalized virtual profiles (Profile Property Identifier).
 */

import { RawReading } from "../driver/DeviceDriver.js";

export interface VirtualProfile {
    deviceId: string;
    type: string;
    unit: string;
    value: number;
    timestamp: string;
}

export class DevicesMapper {
    /**
     * Maps a raw sensor reading to a protocol-independent, standardized virtual profile.
     */
    mapToVirtualProfile(reading: RawReading): VirtualProfile {
        let mappedValue = reading.value;
        let unit = "unknown";
        let type = "unknown";

        // Protocol-specific processing of the raw value
        if (reading.protocol === "matter") {
            if (reading.cluster === "temperatureMeasurement" && reading.attribute === "measuredValue") {
                // Matter temperature values are scaled by 100 (e.g., 2000 = 20.00°C)
                mappedValue = reading.value / 100;
                unit = "celsius";
                type = "temperature";
            }
        } else {
            // Other protocols (mocked Zigbee/Thread)
            if (reading.cluster === "temperature") {
                mappedValue = reading.value;
                unit = "celsius";
                type = "temperature";
            } else if (reading.cluster === "energy_consumption") {
                mappedValue = reading.value;
                unit = "kWh";
                type = "energy_consumption";
            }
        }

        const profile: VirtualProfile = {
            deviceId: reading.deviceId,
            type: type,
            unit: unit,
            value: Number(mappedValue.toFixed(2)),
            timestamp: new Date().toISOString(),
        };

        console.log(`\x1b[32m[DEVICES MAPPING] Mapped data: { deviceId: "${profile.deviceId}", type: "${profile.type}", value: ${profile.value} ${profile.unit} }\x1b[0m`);
        return profile;
    }
}
