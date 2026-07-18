import React from "react";
import { FlashValue } from "./FlashValue.tsx";

interface RuntimePanelProps {
  temporalState: Record<string, { 
    rawValue: number; 
    smoothedValue: number; 
    windowFill: number; 
    timestamp: string;
    rawHistory?: number[];
    smoothedHistory?: number[];
    unit?: string;
  }>;
  intraHomeState: Record<string, {
    homeId: string;
    zoneId: string;
    type: string;
    unit: string;
    value: number;
    activeDevices: number;
    timestamp: string;
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

export const RuntimePanel: React.FC<RuntimePanelProps> = ({ temporalState, intraHomeState }) => {
  const temporalList = Object.entries(temporalState);
  const intraHomeList = Object.entries(intraHomeState);

  return (
    <div className="dashboard-card" style={{ "--accent-color": "var(--color-runtime)" } as React.CSSProperties}>
      <div className="card-header">
        <div className="card-title">
          Passerelle Runtime
        </div>
        <div style={{ display: "flex", gap: "0.25rem" }}>
          <div className="badge" style={{ backgroundColor: "rgba(56, 189, 248, 0.1)", color: "var(--color-runtime)" }}>Actif</div>
          <div className="badge">Gateway locale</div>
        </div>
      </div>
      
      <div className="card-content">
        {temporalList.length === 0 && intraHomeList.length === 0 ? (
          <div className="empty-state">
            <span className="pulse-circle" style={{ "--pulse-color": "var(--color-runtime)" } as React.CSSProperties}></span>
            En attente de données...
            <p style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>La passerelle de la maison agrège localement les capteurs.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            
            {/* Section 1 : Lissage Temporel */}
            {temporalList.length > 0 && (
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
                  1. Lissage Temporel (Moyenne Glissante)
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
                            Brute : <strong style={{ fontFamily: "var(--font-mono)", color: "#f87171" }}><FlashValue value={state.rawValue} />{state.unit === "celsius" ? "°C" : (state.unit || "°C")}</strong>
                          </span>
                          <Sparkline values={state.rawHistory || []} color="#f87171" />
                        </div>
                        <span style={{ marginTop: "2px" }}>➡️</span>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                          <span>
                            Lissée : <strong style={{ fontFamily: "var(--font-mono)", color: "var(--color-runtime)" }}><FlashValue value={state.smoothedValue} />{state.unit === "celsius" ? "°C" : (state.unit || "°C")}</strong>
                          </span>
                          <Sparkline values={state.smoothedHistory || []} color="var(--color-runtime)" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Section 2 : Agrégation Intra-Maison */}
            {intraHomeList.length > 0 && (
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
                  2. Agrégation Intra-Maison (Par Type)
                </div>
                <div className="item-list">
                  {intraHomeList.map(([key, state]) => (
                    <div className="data-item" key={key} style={{ borderLeft: "2px solid #a855f7" }}>
                      <div className="data-item-header">
                        <span className="item-name" style={{ fontWeight: "600" }}>{state.homeId} ({state.type})</span>
                        <span className="badge" style={{ backgroundColor: "rgba(168, 85, 247, 0.1)", color: "#a855f7" }}>Moyenne Locale</span>
                      </div>
                      
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem", marginTop: "0.25rem" }}>
                        <div>
                          <span style={{ color: "var(--text-muted)" }}>Capteurs actifs : </span>
                          <strong style={{ color: "var(--text-muted)" }}>{state.activeDevices}</strong>
                        </div>
                        <div>
                          <span style={{ color: "var(--text-muted)" }}>Moyenne : </span>
                          <strong style={{ fontFamily: "var(--font-mono)", color: "#a855f7", fontSize: "1.05rem" }}>
                            <FlashValue value={state.value} />{state.unit === "celsius" ? "°C" : state.unit}
                          </strong>
                        </div>
                      </div>
                      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.25rem", fontFamily: "var(--font-mono)" }}>
                        Zone ciblée : {state.zoneId}
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
