/**
 * @file DeviceDriver.ts
 * @description Common interface for all CHARIOT protocol drivers.
 */

export interface RawReading {
    deviceId: string;
    protocol: 'matter' | 'zigbee' | 'thread';
    cluster: string;
    attribute: string;
    value: any;
}

export interface DeviceDriver {
    id: string;
    protocol: 'matter' | 'zigbee' | 'thread';
    start(): Promise<void>;
    stop(): Promise<void>;
    onRawData(callback: (reading: RawReading) => void): void;
}
