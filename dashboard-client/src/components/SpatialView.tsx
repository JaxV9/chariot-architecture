/**
 * @file SpatialView.tsx
 * @description Hierarchical spatial visualization tab (Zone -> Houses -> Devices)
 * illustrating the two-level privacy architecture (local aggregation and cloud anonymity).
 */

import React from "react";
import { DeviceData } from "./DevicesPanel.tsx";
import { FlashValue } from "./FlashValue.tsx";

interface SpatialViewProps {
  devices: Record<string, DeviceData>;
  intraHomeState: Record<string, {
    siteId?: string;
    siteType?: 'home' | 'building';
    homeId: string;
    zoneId: string;
    type: string;
    unit: string;
    value: number;
    activeDevices: number;
    timestamp: string;
  }>;
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

export const SpatialView: React.FC<SpatialViewProps> = ({ devices, intraHomeState, privacyState }) => {
  // Group devices by zoneId, then siteId
  const grouped: Record<string, {
    zoneId: string;
    sites: Record<string, {
      siteId: string;
      siteType: 'home' | 'building';
      devices: DeviceData[];
    }>;
  }> = {};

  Object.values(devices).forEach((dev) => {
    const zoneId = dev.zoneId || "quartier-nord"; // fallback to default
    const siteId = dev.siteId || dev.homeId || (dev.deviceId.includes("house-2") || dev.deviceId.includes("thread") ? "house-2" : "house-1");
    
    // Infer siteType: building if device ID contains building-specific terms
    const isBuilding = dev.siteType === "building" || 
                       dev.deviceId.includes("occupancy") || 
                       dev.deviceId.includes("security") || 
                       dev.deviceId.includes("airquality") || 
                       siteId.includes("building");
    const siteType = isBuilding ? "building" : "home";

    if (!grouped[zoneId]) {
      grouped[zoneId] = { zoneId, sites: {} };
    }
    if (!grouped[zoneId].sites[siteId]) {
      grouped[zoneId].sites[siteId] = { siteId, siteType, devices: [] };
    }
    grouped[zoneId].sites[siteId].devices.push(dev);
  });

  const zoneList = Object.values(grouped);

  // Helper colors for protocols
  const getProtocolColor = (proto: string) => {
    switch (proto.toLowerCase()) {
      case "matter": return "#f43f5e"; // Rose/Red
      case "zigbee": return "#eab308"; // Yellow
      case "thread": return "#a855f7"; // Purple
      default: return "#94a3b8";
    }
  };

  const formatUnit = (unit?: string) => {
    if (!unit) return "";
    if (unit === "celsius") return "°C";
    if (unit === "percent") return "%";
    if (unit === "ppm") return " ppm";
    if (unit === "frequency") return "";
    return " " + unit;
  };

  return (
    <div className="spatial-view-container">
      {/* Self-contained premium scoped styles */}
      <style>{`
        .spatial-view-container {
          display: grid;
          grid-template-columns: 1.8fr 1fr;
          gap: 1.5rem;
          width: 100%;
          min-height: 600px;
        }

        @media (max-width: 1200px) {
          .spatial-view-container {
            grid-template-columns: 1fr;
          }
        }

        /* Spatial hierarchy cards */
        .spatial-zone-card {
          background: rgba(13, 17, 39, 0.4);
          border: 1px solid rgba(45, 212, 191, 0.15);
          border-radius: 16px;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
          backdrop-filter: blur(10px);
          animation: pulseGlow 4s infinite ease-in-out;
          position: relative;
        }

        .spatial-zone-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          padding-bottom: 0.75rem;
        }

        .spatial-zone-title {
          font-size: 1.15rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: var(--color-communication);
        }

        .houses-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.25rem;
        }

        .spatial-house-card {
          background: rgba(255, 255, 255, 0.02);
          border-radius: 12px;
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          transition: all 0.3s ease;
        }

        .spatial-house-card:hover {
          border-color: rgba(56, 189, 248, 0.4);
          transform: translateY(-2px);
          box-shadow: 0 4px 20px rgba(56, 189, 248, 0.1);
        }

        .spatial-house-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-weight: 600;
          font-size: 0.95rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
          padding-bottom: 0.5rem;
        }

        /* Aggregated averages inside the house */
        .house-aggregates {
          background: rgba(255, 255, 255, 0.01);
          border: 1px dashed rgba(255, 255, 255, 0.06);
          border-radius: 8px;
          padding: 0.6rem;
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }

        .aggregate-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.8rem;
        }

        /* Raw device mini card */
        .spatial-device-item {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 8px;
          padding: 0.6rem 0.75rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.8rem;
        }

        /* Pipeline side */
        .pipeline-column {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .pipeline-card {
          background: rgba(13, 17, 39, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 16px;
          padding: 1.25rem;
          backdrop-filter: blur(10px);
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .pipeline-header {
          font-size: 1rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          padding-bottom: 0.5rem;
        }

        /* Animated connection lines */
        .connector-flow {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 30px;
          position: relative;
        }

        .arrow-line {
          width: 2px;
          height: 100%;
          background: linear-gradient(to bottom, var(--color-communication), var(--color-services));
          position: relative;
        }

        /* Keyframes */
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37), 0 0 15px rgba(45, 212, 191, 0.05); }
          50% { box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37), 0 0 30px rgba(45, 212, 191, 0.2); }
        }

        @keyframes flowDash {
          to {
            stroke-dashoffset: -20;
          }
        }
      `}</style>

      {/* Left Column: Spatial Hierarchy */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <h3 style={{ fontSize: "1.1rem", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", margin: "0.2rem 0" }}>
          Hiérarchie Spatiale Locale (Passerelles de Résidence)
        </h3>

        {zoneList.length === 0 ? (
          <div className="dashboard-card" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "200px" }}>
            <span style={{ color: "var(--text-muted)" }}>Aucune zone détectée. En attente de données...</span>
          </div>
        ) : (
          zoneList.map((zone) => {
            // Find active status of this zone
            const tempK = privacyState[`${zone.zoneId}--home--temperature`];
            const energyK = privacyState[`${zone.zoneId}--home--energy_consumption`];
            const occupancyK = privacyState[`${zone.zoneId}--building--occupancy`];
            const securityK = privacyState[`${zone.zoneId}--building--security_event`];
            const airQualityK = privacyState[`${zone.zoneId}--building--air_quality`];
            
            const isTempPub = tempK?.status === "published";
            const isEnergyPub = energyK?.status === "published";
            const isOccupancyPub = occupancyK?.status === "published";
            const isSecurityPub = securityK?.status === "published";
            const isAirQualityPub = airQualityK?.status === "published";

            return (
              <div className="spatial-zone-card" key={zone.zoneId}>
                <div className="spatial-zone-header">
                  <div className="spatial-zone-title">
                    {/* Map-pin network icon */}
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"/>
                      <circle cx="12" cy="10" r="3"/>
                    </svg>
                    Zone : "{zone.zoneId}"
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "flex-end", maxWidth: "70%" }}>
                    {tempK && (
                      <span className="badge" style={{ backgroundColor: isTempPub ? "rgba(74, 222, 128, 0.1)" : "rgba(239, 68, 68, 0.1)", color: isTempPub ? "var(--color-services)" : "#ef4444" }}>
                        Maison Temp : {tempK.activeDevices}/{tempK.kThreshold}
                      </span>
                    )}
                    {energyK && (
                      <span className="badge" style={{ backgroundColor: isEnergyPub ? "rgba(74, 222, 128, 0.1)" : "rgba(239, 68, 68, 0.1)", color: isEnergyPub ? "var(--color-services)" : "#ef4444" }}>
                        Maison Énergie : {energyK.activeDevices}/{energyK.kThreshold}
                      </span>
                    )}
                    {occupancyK && (
                      <span className="badge" style={{ backgroundColor: isOccupancyPub ? "rgba(74, 222, 128, 0.1)" : "rgba(239, 68, 68, 0.1)", color: isOccupancyPub ? "var(--color-services)" : "#ef4444" }}>
                        Bâtiment Occ : {occupancyK.activeDevices}/{occupancyK.kThreshold}
                      </span>
                    )}
                    {securityK && (
                      <span className="badge" style={{ backgroundColor: isSecurityPub ? "rgba(74, 222, 128, 0.1)" : "rgba(239, 68, 68, 0.1)", color: isSecurityPub ? "var(--color-services)" : "#ef4444" }}>
                        Bâtiment Sécu : {securityK.activeDevices}/{securityK.kThreshold}
                      </span>
                    )}
                    {airQualityK && (
                      <span className="badge" style={{ backgroundColor: isAirQualityPub ? "rgba(74, 222, 128, 0.1)" : "rgba(239, 68, 68, 0.1)", color: isAirQualityPub ? "var(--color-services)" : "#ef4444" }}>
                        Bâtiment Air : {airQualityK.activeDevices}/{airQualityK.kThreshold}
                      </span>
                    )}
                  </div>
                </div>

                <div className="houses-grid">
                  {Object.values(zone.sites).map((site) => {
                    const isBuilding = site.siteType === "building";
                    const cardBorderColor = isBuilding ? "rgba(249, 115, 22, 0.25)" : "rgba(56, 189, 248, 0.15)";
                    const hoverGlow = isBuilding ? "rgba(249, 115, 22, 0.1)" : "rgba(56, 189, 248, 0.1)";
                    const titleColor = isBuilding ? "rgba(249, 115, 22, 0.95)" : "var(--color-runtime)";

                    // Extract local aggregates for this site
                    const tempAggregate = intraHomeState[`${site.siteId}-temperature`];
                    const energyAggregate = intraHomeState[`${site.siteId}-energy_consumption`];
                    const occupancyAggregate = intraHomeState[`${site.siteId}-occupancy`];
                    const securityAggregate = intraHomeState[`${site.siteId}-security_event`];
                    const airQualityAggregate = intraHomeState[`${site.siteId}-air_quality`];

                    return (
                      <div 
                        className="spatial-house-card" 
                        key={site.siteId}
                        style={{
                          border: `1px solid ${cardBorderColor}`,
                          boxShadow: `0 4px 15px ${hoverGlow}`
                        }}
                      >
                        <div className="spatial-house-header" style={{ color: titleColor }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            {isBuilding ? (
                              /* Building Icon */
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <rect x="4" y="2" width="16" height="20" rx="2" ry="2"/>
                                <line x1="9" y1="22" x2="9" y2="16"/>
                                <line x1="15" y1="22" x2="15" y2="16"/>
                                <line x1="9" y1="16" x2="15" y2="16"/>
                                <path d="M8 6h2v2H8V6zm0 4h2v2H8v-2zm0 4h2v2H8v-2zm6-8h2v2h-2V6zm0 4h2v2h-2v-2zm0 4h2v2h-2v-2z"/>
                              </svg>
                            ) : (
                              /* Home icon */
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                                <polyline points="9 22 9 12 15 12 15 22"/>
                              </svg>
                            )}
                            {site.siteId}
                          </div>
                          <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                            {isBuilding ? "Building Gateway" : "Home Gateway"}
                          </span>
                        </div>

                        {/* Local Gateway Aggregated values */}
                        <div className="house-aggregates">
                          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: "bold", textTransform: "uppercase", marginBottom: "0.1rem" }}>
                            Abonnement Intra-Site
                          </div>
                          {!isBuilding ? (
                            <>
                              {tempAggregate ? (
                                <div className="aggregate-row" style={{ color: "var(--color-runtime)" }}>
                                  <span>Moyenne Temp :</span>
                                  <strong><FlashValue value={tempAggregate.value} />°C</strong>
                                </div>
                              ) : (
                                <div className="aggregate-row" style={{ color: "var(--text-muted)" }}>
                                  <span>Moyenne Temp :</span>
                                  <span>N/A</span>
                                </div>
                              )}
                              {energyAggregate ? (
                                <div className="aggregate-row" style={{ color: "var(--color-devices)" }}>
                                  <span>Moyenne Énergie :</span>
                                  <strong><FlashValue value={energyAggregate.value} /> kWh</strong>
                                </div>
                              ) : (
                                <div className="aggregate-row" style={{ color: "var(--text-muted)" }}>
                                  <span>Moyenne Énergie :</span>
                                  <span>N/A</span>
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              {occupancyAggregate ? (
                                <div className="aggregate-row" style={{ color: "var(--color-communication)" }}>
                                  <span>Moyenne Occupation :</span>
                                  <strong><FlashValue value={occupancyAggregate.value} />%</strong>
                                </div>
                              ) : (
                                <div className="aggregate-row" style={{ color: "var(--text-muted)" }}>
                                  <span>Moyenne Occupation :</span>
                                  <span>N/A</span>
                                </div>
                              )}
                              {securityAggregate ? (
                                <div className="aggregate-row" style={{ color: "#f43f5e" }}>
                                  <span>Fréq. Anomalie :</span>
                                  <strong><FlashValue value={securityAggregate.value} /></strong>
                                </div>
                              ) : (
                                <div className="aggregate-row" style={{ color: "var(--text-muted)" }}>
                                  <span>Fréq. Anomalie :</span>
                                  <span>N/A</span>
                                </div>
                              )}
                              {airQualityAggregate ? (
                                <div className="aggregate-row" style={{ color: "#10b981" }}>
                                  <span>Moyenne CO2 :</span>
                                  <strong><FlashValue value={airQualityAggregate.value} /> ppm</strong>
                                </div>
                              ) : (
                                <div className="aggregate-row" style={{ color: "var(--text-muted)" }}>
                                  <span>Moyenne CO2 :</span>
                                  <span>N/A</span>
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        {/* Connected raw devices */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: "bold", textTransform: "uppercase", marginTop: "0.2rem" }}>
                            Capteurs Physiques (Bruts)
                          </div>
                          {site.devices.map((dev) => (
                            <div className="spatial-device-item" key={dev.deviceId}>
                              <div style={{ display: "flex", flexDirection: "column", gap: "0.1rem" }}>
                                <span style={{ fontWeight: "500", color: "#f1f5f9" }}>{dev.deviceId}</span>
                                <span style={{ fontSize: "0.65rem", color: getProtocolColor(dev.protocol) }}>
                                  {dev.protocol.toUpperCase()}
                                </span>
                              </div>
                              <strong style={{ fontFamily: "var(--font-mono)" }}>
                                <FlashValue value={dev.rawValue} unit={formatUnit(dev.unit)} />
                              </strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Right Column: Privacy Pipeline & REST Exposure */}
      <div className="pipeline-column">
        <h3 style={{ fontSize: "1.1rem", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", margin: "0.2rem 0" }}>
          Pipeline d'Anonymisation &amp; Services
        </h3>

        {/* Connector from local to Cloud Middleware */}
        <div style={{ display: "flex", justifyContent: "center", padding: "0.2rem" }}>
          <svg width="100%" height="40" style={{ overflow: "visible" }}>
            <path 
              d="M 10 20 L 300 20" 
              fill="none" 
              stroke="rgba(45, 212, 191, 0.4)" 
              strokeWidth="2" 
              strokeDasharray="6 4"
              style={{ animation: "flowDash 2s linear infinite" }}
            />
            {/* Animated circle following path */}
            <circle r="4" fill="var(--color-communication)">
              <animateMotion dur="3s" repeatCount="indefinite" path="M 10 20 L 300 20" />
            </circle>
          </svg>
        </div>

        {/* 1. Cloud Middleware Card */}
        <div className="pipeline-card" style={{ borderLeft: "4px solid var(--color-communication)" }}>
          <div className="pipeline-header" style={{ color: "var(--color-communication)" }}>
            {/* Cloud icon */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M17.5 19A3.5 3.5 0 0 0 21 15.5c0-2.79-2.54-4.5-5-4.5-.42-1.89-1.74-3.5-3.5-3.5a5.5 5.5 0 0 0-5.5 5.5c-1.39.2-2.5 1.53-2.5 3A3.5 3.5 0 0 0 8 19.5h9.5"/>
            </svg>
            Communication Layer (Cloud)
          </div>

          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: "1.4" }}>
            Reçoit les profils chiffrés de chaque site. Applique le <strong>K-Anonymat</strong> par type de site, puis injecte un <strong>Bruit Gaussien</strong>.
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "0.25rem" }}>
            {Object.entries(privacyState).map(([key, state]) => {
              const [zoneId, siteType, type] = key.split("--");
              const isPublished = state.status === "published";
              return (
                <div 
                  key={key} 
                  style={{ 
                    background: "rgba(255,255,255,0.02)", 
                    border: "1px solid rgba(255,255,255,0.05)",
                    borderRadius: "8px",
                    padding: "0.75rem",
                    opacity: isPublished ? 1 : 0.7
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", fontWeight: "600", marginBottom: "0.3rem" }}>
                    <span>{zoneId} ({siteType === "building" ? "Bâtiment" : "Maison"} - {type})</span>
                    <span style={{ color: isPublished ? "var(--color-services)" : "#ef4444" }}>
                      {isPublished ? "PUBLIÉ ✓" : "RETENU ❌"}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.25rem 1rem" }}>
                    <div>Seuil K : <strong>{state.activeDevices}/{state.kThreshold}</strong></div>
                    <div>Bruit : <strong style={{ color: "#60a5fa" }}>{state.noise !== undefined ? (state.noise > 0 ? "+" : "") + state.noise.toFixed(4) : "0.0000"}</strong></div>
                    <div style={{ gridColumn: "span 2" }}>
                      Valeur finale : <strong style={{ color: isPublished ? "var(--color-services)" : "var(--text-muted)" }}>
                        {state.finalValue !== undefined ? `${state.finalValue}${formatUnit(state.unit)}` : "RETENU"}
                      </strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Connector from Cloud Middleware to API Layer */}
        <div style={{ display: "flex", justifyContent: "center", padding: "0.2rem" }}>
          <svg width="100%" height="40" style={{ overflow: "visible" }}>
            <path 
              d="M 10 20 L 300 20" 
              fill="none" 
              stroke="rgba(74, 222, 128, 0.4)" 
              strokeWidth="2" 
              strokeDasharray="6 4"
              style={{ animation: "flowDash 2s linear infinite" }}
            />
            <circle r="4" fill="var(--color-services)">
              <animateMotion dur="2.5s" repeatCount="indefinite" path="M 10 20 L 300 20" />
            </circle>
          </svg>
        </div>

        {/* 2. Service Layer Card */}
        <div className="pipeline-card" style={{ borderLeft: "4px solid var(--color-services)" }}>
          <div className="pipeline-header" style={{ color: "var(--color-services)" }}>
            {/* Terminal/Code icon */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="16 18 22 12 16 6"/>
              <polyline points="8 6 2 12 8 18"/>
            </svg>
            Service Layer (REST API)
          </div>

          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: "1.4" }}>
            Point d'entrée unique et sécurisé (Zero Trust) pour les applications de la Smart City. Expose uniquement les données de zone anonymisées.
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.25rem" }}>
            {Object.entries(privacyState).map(([key, state]) => {
              const [zoneId, siteType, type] = key.split("--");
              const isPublished = state.status === "published";
              if (!isPublished) return null;

              return (
                <div 
                  key={key} 
                  style={{ 
                    background: "rgba(74, 222, 128, 0.02)", 
                    border: "1px solid rgba(74, 222, 128, 0.15)",
                    borderRadius: "8px",
                    padding: "0.6rem 0.75rem",
                    fontSize: "0.75rem"
                  }}
                >
                  <div style={{ fontFamily: "var(--font-mono)", color: "var(--color-services)", fontWeight: "bold" }}>
                    GET /zones/{zoneId}--{siteType}--{type}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.25rem", color: "var(--text-muted)" }}>
                    <span>Statut : <strong style={{ color: "var(--color-services)" }}>200 OK</strong></span>
                    <span>Valeur : <strong style={{ color: "#f1f5f9" }}>{state.finalValue}{formatUnit(state.unit)}</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
