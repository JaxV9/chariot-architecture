import React from "react";
import { FlashValue } from "./FlashValue.tsx";

export interface TelemetryCommunicationEvent {
  zoneId: string;
  type: string;
  value: number;
  unit: string;
  timestamp: string;
}

interface CommunicationPanelProps {
  zones: Record<string, TelemetryCommunicationEvent>;
  privacyState: Record<string, { 
    activeDevices: number; 
    kThreshold: number; 
    status: "published" | "withheld"; 
    groupMean?: number; 
    noise?: number; 
    finalValue?: number; 
    unit?: string; 
    timestamp: string;
    groupMeanHistory?: number[];
    finalValueHistory?: number[];
  }>;
}

const Sparkline: React.FC<{ values: number[]; color: string }> = ({ values, color }) => {
  if (!values || values.length < 2) return null;
  const width = 100;
  const height = 16;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min === 0 ? 1 : max - min;
  
  const points = values.map((val, idx) => {
    const x = (idx / (values.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={width} height={height} style={{ overflow: "visible", display: "block", marginTop: "4px" }}>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        points={points}
      />
    </svg>
  );
};

const formatNoise = (noise: number | undefined): string => {
  if (noise === undefined) return "N/A";
  const abs = Math.abs(noise);
  if (abs === 0) return "0.0000";
  if (abs < 0.001) {
    return (noise > 0 ? "+" : "") + noise.toExponential(3);
  }
  return (noise > 0 ? "+" : "") + noise.toFixed(4);
};

export const CommunicationPanel: React.FC<CommunicationPanelProps> = ({ zones, privacyState }) => {
  const zoneList = Object.values(zones);
  const privacyList = Object.entries(privacyState);

  return (
    <div className="dashboard-card" style={{ "--accent-color": "var(--color-communication)" } as React.CSSProperties}>
      <div className="card-header">
        <div className="card-title">
          Couche Communication
        </div>
        <div style={{ display: "flex", gap: "0.25rem" }}>
          <div className="badge" style={{ backgroundColor: "rgba(45, 212, 191, 0.1)", color: "var(--color-communication)" }}>Actif</div>
          <div className="badge">Cloud Middleware</div>
        </div>
      </div>
      <div className="card-content">
        {zoneList.length === 0 && privacyList.length === 0 ? (
          <div className="empty-state">
            <span className="pulse-circle" style={{ "--pulse-color": "var(--color-communication)" } as React.CSSProperties}></span>
            En attente de données...
            <p style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>Le middleware reçoit les flux de toutes les maisons par zone géographique.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            
            {/* Section 1: Privacy pipeline */}
            {privacyList.length > 0 && (
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
                  1. K-Anonymat Inter-Maisons &amp; Bruit
                </div>
                <div className="item-list">
                  {privacyList.map(([zoneId, state]) => {
                    const isPublished = state.status === "published";
                    const withheldStyle = !isPublished ? { opacity: 0.6, filter: "grayscale(20%)" } : {};
                    return (
                      <div 
                        className="data-item" 
                        key={zoneId} 
                        style={{ 
                          borderLeft: `2px solid ${isPublished ? "var(--color-services)" : "#ef4444"}`,
                          ...withheldStyle
                        }}
                      >
                        <div className="data-item-header">
                          <span className="item-name" style={{ fontWeight: "600" }}>Zone : "{zoneId}"</span>
                          <span 
                            className="badge"
                            style={{
                              backgroundColor: isPublished ? "rgba(74, 222, 128, 0.1)" : "rgba(239, 68, 68, 0.1)",
                              color: isPublished ? "var(--color-services)" : "#ef4444",
                              border: `1px solid ${isPublished ? "rgba(74, 222, 128, 0.2)" : "rgba(239, 68, 68, 0.2)"}`
                            }}
                          >
                            {isPublished ? "PUBLIÉ" : "RETENU"}
                          </span>
                        </div>

                        <div className="stats-box" style={{ marginTop: "0.5rem", marginBottom: "0.5rem" }}>
                          <div className="stat-item">
                            <span className="stat-label">Maisons / K</span>
                            <span className="stat-value" style={{ color: isPublished ? "var(--color-services)" : "#ef4444" }}>
                              {state.activeDevices} / {state.kThreshold}
                            </span>
                          </div>
                          <div className="stat-item">
                            <span className="stat-label">Moyenne Zone</span>
                            <span className="stat-value" style={{ color: "var(--text-muted)" }}>
                              {state.groupMean !== undefined ? (
                                <><FlashValue value={state.groupMean} />°C</>
                              ) : "N/A"}
                            </span>
                          </div>
                          <div className="stat-item">
                            <span className="stat-label">Bruit Gaussien</span>
                            <span className="stat-value" style={{ color: state.noise && state.noise !== 0 ? "#60a5fa" : "var(--text-muted)" }}>
                              <FlashValue value={state.noise} format={formatNoise} />
                            </span>
                          </div>
                          <div className="stat-item">
                            <span className="stat-label">Valeur Finale</span>
                            <span className="stat-value" style={{ color: isPublished ? "var(--color-services)" : "var(--text-muted)", fontSize: "1.1rem" }}>
                              {state.finalValue !== undefined ? (
                                <><FlashValue value={state.finalValue} />°C</>
                              ) : "RETENU"}
                            </span>
                            {isPublished && state.finalValueHistory && (
                              <Sparkline values={state.finalValueHistory} color="var(--color-services)" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Section 2: Directory Services store */}
            {zoneList.length > 0 && (
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
                  2. Annuaire des Zones Stockées
                </div>
                <div className="item-list">
                  {zoneList.map((z) => (
                    <div className="data-item" key={z.zoneId} style={{ borderLeft: "2px solid var(--color-communication)" }}>
                      <div className="data-item-header">
                        <span className="item-name">Zone : "{z.zoneId}"</span>
                        <span className="badge" style={{ backgroundColor: "rgba(45, 212, 191, 0.1)", color: "var(--color-communication)" }}>
                          STOCKÉ
                        </span>
                      </div>
                      <div className="data-item-body">
                        <span className="item-value" style={{ color: "var(--color-communication)" }}>
                          <FlashValue value={z.value} unit={z.unit === "celsius" ? "°C" : z.unit} />
                        </span>
                        <span className="item-meta">
                          {new Date(z.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.4rem", fontFamily: "var(--font-mono)", borderTop: "1px solid rgba(255,255,255,0.03)", paddingTop: "0.25rem" }}>
                        Topic : chariot/zones/{z.zoneId}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
};
