import React from "react";
import { FlashValue } from "./FlashValue.tsx";

export interface TelemetryCommunicationEvent {
  groupId: string;
  type: string;
  value: number;
  unit: string;
  timestamp: string;
}

interface CommunicationPanelProps {
  groups: Record<string, TelemetryCommunicationEvent>;
}

export const CommunicationPanel: React.FC<CommunicationPanelProps> = ({ groups }) => {
  const groupList = Object.values(groups);

  return (
    <div className="dashboard-card" style={{ "--accent-color": "var(--color-communication)" } as React.CSSProperties}>
      <div className="card-header">
        <div className="card-title">
          Couche Communication
        </div>
        <div style={{ display: "flex", gap: "0.25rem" }}>
          <div className="badge" style={{ backgroundColor: "rgba(45, 212, 191, 0.1)", color: "var(--color-communication)" }}>Actif</div>
          <div className="badge">Services d'annuaire</div>
        </div>
      </div>
      <div className="card-content">
        {groupList.length === 0 ? (
          <div className="empty-state">
            <span className="pulse-circle" style={{ "--pulse-color": "var(--color-communication)" } as React.CSSProperties}></span>
            En attente de données...
            <p style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>Les mises à jour se déclencheront lorsque le runtime publiera les profils chiffrés via le broker MQTT.</p>
          </div>
        ) : (
          <div className="item-list">
            {groupList.map((g) => (
              <div className="data-item" key={g.groupId} style={{ borderLeft: "2px solid var(--color-communication)" }}>
                <div className="data-item-header">
                  <span className="item-name">Zone : "{g.groupId}"</span>
                  <span className="badge" style={{ backgroundColor: "rgba(45, 212, 191, 0.1)", color: "var(--color-communication)" }}>
                    STOCKÉ
                  </span>
                </div>
                <div className="data-item-body">
                  <span className="item-value" style={{ color: "var(--color-communication)" }}>
                    <FlashValue value={g.value} unit={g.unit === "celsius" ? "°C" : g.unit} />
                  </span>
                  <span className="item-meta">
                    {new Date(g.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.4rem", fontFamily: "var(--font-mono)", borderTop: "1px solid rgba(255,255,255,0.03)", paddingTop: "0.25rem" }}>
                  Topic : chariot/devices/{g.groupId}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
