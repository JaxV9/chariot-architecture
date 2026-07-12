import React from "react";
import { FlashValue } from "./FlashValue.tsx";

export interface TelemetryRuntimeEvent {
  step: "temporal" | "kanon" | "gaussian";
  deviceId?: string;
  groupId?: string;
  rawValue?: number;
  smoothedValue?: number;
  windowFill?: number;
  activeDevices?: number;
  kThreshold?: number;
  status?: "published" | "withheld";
  groupMean?: number;
  noise?: number;
  finalValue?: number;
  unit?: string;
  timestamp: string;
}

interface RuntimePanelProps {
  temporalState: Record<string, { 
    rawValue: number; 
    smoothedValue: number; 
    windowFill: number; 
    timestamp: string;
    rawHistory?: number[];
    smoothedHistory?: number[];
  }>;
  groupState: Record<string, { 
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

export const RuntimePanel: React.FC<RuntimePanelProps> = ({ temporalState, groupState }) => {
  const groupsList = Object.entries(groupState);
  const temporalList = Object.entries(temporalState);

  return (
    <div className="dashboard-card" style={{ "--accent-color": "var(--color-runtime)" } as React.CSSProperties}>
      <div className="card-header">
        <div className="card-title">
          Passerelle Runtime
        </div>
        <div style={{ display: "flex", gap: "0.25rem" }}>
          <div className="badge" style={{ backgroundColor: "rgba(56, 189, 248, 0.1)", color: "var(--color-runtime)" }}>Actif</div>
          <div className="badge">Moteur d'anonymisation</div>
        </div>
      </div>
      
      <div className="card-content">
        {temporalList.length === 0 && groupsList.length === 0 ? (
          <div className="empty-state">
            <span className="pulse-circle" style={{ "--pulse-color": "var(--color-runtime)" } as React.CSSProperties}></span>
            En attente de données...
            <p style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>Télémétrie optionnelle activée par TELEMETRY_ENABLED=true.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            
            {/* Section 1 : Lissage Temporel */}
            {temporalList.length > 0 && (
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
                  1. Lissage Temporel (Fenêtre Glissante)
                </div>
                <div className="item-list">
                  {temporalList.map(([deviceId, state]) => (
                    <div className="data-item" key={deviceId} style={{ borderLeft: "2px solid var(--color-runtime)" }}>
                      <div className="data-item-header">
                        <span className="item-name" style={{ fontSize: "0.8rem" }}>{deviceId}</span>
                        <span className="item-meta">Remplissage : {Math.round(state.windowFill * 100)}%</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", fontSize: "0.85rem", marginTop: "0.25rem" }}>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ color: "var(--text-muted)" }}>
                            Brute : <strong style={{ fontFamily: "var(--font-mono)", color: "#f87171" }}><FlashValue value={state.rawValue} />°C</strong>
                          </span>
                          <Sparkline values={state.rawHistory || []} color="#f87171" />
                        </div>
                        <span style={{ marginTop: "2px" }}>➡️</span>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                          <span>
                            Lissée : <strong style={{ fontFamily: "var(--font-mono)", color: "var(--color-runtime)" }}><FlashValue value={state.smoothedValue} />°C</strong>
                          </span>
                          <Sparkline values={state.smoothedHistory || []} color="var(--color-runtime)" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Section 2 : k-Anonymat */}
            {groupsList.length > 0 && (
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
                  2. k-Anonymat &amp; Insertion de Bruit
                </div>
                <div className="item-list">
                  {groupsList.map(([groupId, state]) => {
                    const isPublished = state.status === "published";
                    const withheldStyle = !isPublished ? { opacity: 0.6, filter: "grayscale(20%)" } : {};
                    return (
                      <div 
                        className="data-item" 
                        key={groupId} 
                        style={{ 
                          borderLeft: `2px solid ${isPublished ? "var(--color-services)" : "#ef4444"}`,
                          ...withheldStyle
                        }}
                      >
                        <div className="data-item-header">
                          <span className="item-name" style={{ fontWeight: "600" }}>Groupe : "{groupId}"</span>
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
                            <span className="stat-label">Actifs / K</span>
                            <span className="stat-value" style={{ color: isPublished ? "var(--color-services)" : "#ef4444" }}>
                              {state.activeDevices} / {state.kThreshold}
                            </span>
                          </div>
                          <div className="stat-item">
                            <span className="stat-label">Moyenne Groupe</span>
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
          </div>
        )}
      </div>
    </div>
  );
};
