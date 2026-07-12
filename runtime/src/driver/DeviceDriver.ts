/**
 * @file DeviceDriver.ts
 * @description Interface commune pour tous les drivers de protocole de communication de CHARIOT.
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
