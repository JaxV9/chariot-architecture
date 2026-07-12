/**
 * @file GroupProfile.ts
 * @description Defines the anonymised group profile emitted by the AnonymisationEngine.
 *
 * A GroupProfile aggregates readings from multiple devices belonging to the same
 * logical zone (group). It replaces the per-device VirtualProfile after anonymisation
 * and is the payload passed to the encryption and MQTT publication steps.
 */

/**
 * Anonymised aggregate profile for a group of devices.
 *
 * @property groupId     - Identifier of the logical zone/group (e.g., "living-room").
 * @property type        - Sensor data type (e.g., "temperature", "humidity").
 * @property unit        - Measurement unit (e.g., "celsius").
 * @property value       - Perturbed aggregate value after temporal smoothing,
 *                         k-anonymity aggregation, and Gaussian noise.
 * @property deviceCount - Number of active devices that contributed to this value
 *                         (included for transparency / demo purposes).
 * @property timestamp   - ISO-8601 timestamp of publication.
 */
export interface GroupProfile {
    groupId: string;
    type: string;
    unit: string;
    value: number;
    deviceCount: number;
    timestamp: string;
}
