import React from "react";
import { FlashValue } from "./FlashValue.tsx";

export interface DeviceData {
  deviceId: string;
  protocol: string;
  rawValue: number;
  timestamp: string;
  unit?: string;
}

interface DevicesPanelProps {
  devices: Record<string, DeviceData>;
}

export const DevicesPanel: React.FC<DevicesPanelProps> = ({ devices }) => {
  const deviceList = Object.values(devices);

  const getProtocolColor = (proto: string) => {
    switch (proto.toLowerCase()) {
      case "matter": return "#f43f5e"; // Rose
      case "zigbee": return "#eab308"; // Jaune
      case "thread": return "#a855f7"; // Violet
      default: return "var(--text-muted)";
    }
  };

  return (
    <div className="dashboard-card" style={{ "--accent-color": "var(--color-devices)" } as React.CSSProperties}>
      <div className="card-header">
        <div className="card-title">
          Couche Devices
        </div>
        <div style={{ display: "flex", gap: "0.25rem" }}>
          <div className="badge" style={{ backgroundColor: "rgba(192, 132, 252, 0.1)", color: "var(--color-devices)" }}>
            {deviceList.length} ACTIF{deviceList.length !== 1 ? "S" : ""}
          </div>
        </div>
      </div>
      <div className="card-content">
        {deviceList.length === 0 ? (
          <div className="empty-state">
            <span className="pulse-circle" style={{ "--pulse-color": "var(--color-devices)" } as React.CSSProperties}></span>
            En attente de données...
            <p style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>La mise en service Matter ou les simulateurs Zigbee/Thread doivent être actifs.</p>
          </div>
        ) : (
          <div className="item-list">
            {deviceList.map((dev) => (
              <div className="data-item" key={dev.deviceId}>
                <div className="data-item-header">
                  <span className="item-name">{dev.deviceId}</span>
                  <span 
                    className="badge" 
                    style={{ 
                      backgroundColor: `${getProtocolColor(dev.protocol)}15`, 
                      color: getProtocolColor(dev.protocol),
                      borderColor: `${getProtocolColor(dev.protocol)}30`,
                      borderWidth: "1px",
                      borderStyle: "solid"
                    }}
                  >
                    {dev.protocol}
                  </span>
                </div>
                <div className="data-item-body">
                  <span className="item-value">
                    <FlashValue value={dev.rawValue} unit={dev.unit === "celsius" ? "°C" : (dev.unit || "°C")} />
                  </span>
                  <span className="item-meta">
                    {new Date(dev.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
