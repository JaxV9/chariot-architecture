import React, { useEffect, useState } from "react";
import { FlashValue } from "./FlashValue.tsx";

interface ZoneProfile {
  zoneId: string;
  siteType?: 'home' | 'building';
  type: string;
  unit: string;
  value: number;
  timestamp: string;
  siteCount?: number;
  homeCount?: number;
}

const Sparkline: React.FC<{ values: number[]; color: string }> = ({ values, color }) => {
  if (!values || values.length < 2) return null;
  const width = 120;
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
    <svg width={width} height={height} style={{ overflow: "visible", display: "block", marginTop: "6px" }}>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        points={points}
      />
    </svg>
  );
};

export const ServicesPanel: React.FC = () => {
  const [zones, setZones] = useState<string[]>([]);
  const [latestProfiles, setLatestProfiles] = useState<Record<string, ZoneProfile>>({});
  const [histories, setHistories] = useState<Record<string, ZoneProfile[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Poll the REST API via our dashboard proxy
  useEffect(() => {
    let active = true;

    const fetchData = async () => {
      try {
        const res = await fetch("/api/proxy/zones");
        if (!res.ok) {
          throw new Error(`HTTP Error ${res.status}`);
        }
        const zoneIds: string[] = await res.json();
        if (!active) return;
        setZones(zoneIds);
        setError(null);

        // Fetch details and history for each zone
        zoneIds.forEach(async (id) => {
          try {
            // Latest profile
            const profileRes = await fetch(`/api/proxy/zones/${id}`);
            if (profileRes.ok) {
              const profile: ZoneProfile = await profileRes.json();
              if (active) {
                setLatestProfiles(prev => ({ ...prev, [id]: profile }));
              }
            }

            // History
            const historyRes = await fetch(`/api/proxy/zones/${id}/history`);
            if (historyRes.ok) {
              const history: ZoneProfile[] = await historyRes.json();
              if (active) {
                setHistories(prev => ({ ...prev, [id]: history }));
              }
            }
          } catch (err) {
            console.error(`Failed to fetch details for zone ${id}:`, err);
          }
        });
      } catch (err: any) {
        if (active) {
          setError(err.message || "Impossible de contacter la couche services.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 3000); // Poll every 3 seconds

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="dashboard-card" style={{ "--accent-color": "var(--color-services)" } as React.CSSProperties}>
      <div className="card-header">
        <div className="card-title">
          Couche Services (REST)
        </div>
        <div style={{ display: "flex", gap: "0.25rem" }}>
          <div className="badge" style={{ backgroundColor: error ? "rgba(239, 68, 68, 0.1)" : "rgba(74, 222, 128, 0.1)", color: error ? "#ef4444" : "var(--color-services)" }}>
            {error ? "API Hors-ligne" : "API En ligne"}
          </div>
        </div>
      </div>
      <div className="card-content">
        {error && (
          <div style={{ padding: "0.5rem", borderRadius: "6px", background: "rgba(239, 68, 68, 0.05)", border: "1px solid rgba(239, 68, 68, 0.15)", fontSize: "0.8rem", color: "#f87171" }}>
            Erreur : {error} (Le service API REST n'est peut-être pas encore démarré)
          </div>
        )}

        {zones.length === 0 ? (
          <div className="empty-state">
            <span className="pulse-circle" style={{ "--pulse-color": "var(--color-services)" } as React.CSSProperties}></span>
            En attente de données...
            <p style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>Les services Smart City demandent les profils en utilisant l'API REST Zero Trust.</p>
          </div>
        ) : (
          <div className="item-list">
            {zones.map((id) => {
              const profile = latestProfiles[id];
              const history = histories[id] || [];
              const sparklineValues = [...history].reverse().map(h => h.value);

              return (
                <div className="data-item" key={id} style={{ borderLeft: "2px solid var(--color-services)" }}>
                  <div className="data-item-header">
                    <span className="item-name">Zone ID : "{id}"</span>
                    <span className="item-meta" style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem" }}>
                      HTTP 200 OK
                    </span>
                  </div>

                  {profile ? (
                    <>
                      <div className="data-item-body" style={{ marginTop: "0.25rem" }}>
                        <span className="item-value" style={{ color: "var(--color-services)" }}>
                          <FlashValue value={profile.value} unit={profile.unit === "celsius" ? "°C" : profile.unit} />
                        </span>
                        <span className="item-meta">
                          {new Date(profile.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.4rem", borderTop: "1px solid rgba(255,255,255,0.03)", paddingTop: "0.4rem" }}>
                        <div>Type : <strong>{profile.type}</strong></div>
                        {profile.siteType && (
                          <div>Type de site : <strong>{profile.siteType === "building" ? "Bâtiment" : "Maison"}</strong></div>
                        )}
                        {profile.siteCount !== undefined ? (
                          <div>Sites dans la zone anonymisée : <strong>{profile.siteCount}</strong></div>
                        ) : profile.homeCount !== undefined ? (
                          <div>Maisons dans la zone anonymisée : <strong>{profile.homeCount}</strong></div>
                        ) : null}
                      </div>

                      {/* Sparkline & History timeline dots */}
                      {history.length > 0 && (
                        <div style={{ marginTop: "0.5rem" }}>
                          <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.025em" }}>
                            Historique glissant ({history.length} entrées) :
                          </span>
                          <div className="history-dots" style={{ marginBottom: "0.25rem" }}>
                            {history.slice(0, 10).map((h, index) => (
                              <div 
                                className="history-dot active" 
                                key={index} 
                                title={`Valeur : ${h.value.toFixed(2)} à ${new Date(h.timestamp).toLocaleTimeString()}`}
                              />
                            ))}
                          </div>
                          <Sparkline values={sparklineValues} color="var(--color-services)" />
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Récupération du profil...</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
