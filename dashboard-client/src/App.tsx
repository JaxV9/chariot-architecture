import React, { useEffect, useState, useRef } from "react";
import { ArchitectureFlow } from "./components/ArchitectureFlow.tsx";
import { DevicesPanel, DeviceData } from "./components/DevicesPanel.tsx";
import { RuntimePanel } from "./components/RuntimePanel.tsx";
import { CommunicationPanel, TelemetryCommunicationEvent } from "./components/CommunicationPanel.tsx";
import { ServicesPanel } from "./components/ServicesPanel.tsx";
import { DataFormatPanel } from "./components/DataFormatPanel.tsx";
import { SpatialView } from "./components/SpatialView.tsx";

interface LogLine {
  id: string;
  time: string;
  layer: "devices" | "runtime" | "communication" | "services";
  message: string;
}

export default function App() {
  const [wsStatus, setWsStatus] = useState<"connecting" | "online" | "offline">("connecting");
  const [lastEventLayer, setLastEventLayer] = useState<"devices" | "runtime" | "communication" | "services" | "">("");

  // Animation states for the 3 sequential arrows
  const [arrow1Active, setArrow1Active] = useState(false);
  const [arrow2Active, setArrow2Active] = useState(false);
  const [arrow3Active, setArrow3Active] = useState(false);
  
  // Devices State
  const [devices, setDevices] = useState<Record<string, DeviceData>>({});
  
  // Tabs Navigation
  const [activeTab, setActiveTab] = useState<"live" | "spatial" | "format">("live");

  // Config State (synced from runtime or modified locally before applying)
  const [config, setConfig] = useState({
    kThreshold: 2,
    sigma: 0.1,
    windowSize: 5
  });
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  // Time metrics
  const [lastReceivedTime, setLastReceivedTime] = useState<number | null>(null);
  const [secondsSinceLastUpdate, setSecondsSinceLastUpdate] = useState<number | null>(null);

  // Data format state
  const [dataFormatState, setDataFormatState] = useState<{
    devicesToRuntime: { before: any; after: any } | null;
    runtimeInternal: { before: any; after: any } | null;
    runtimeToCommunication: { before: any; after: any } | null;
    communicationToServices: { before: any; after: any } | null;
  }>({
    devicesToRuntime: null,
    runtimeInternal: null,
    runtimeToCommunication: null,
    communicationToServices: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  
  // Runtime State
  const [temporalState, setTemporalState] = useState<Record<string, { 
    rawValue: number; 
    smoothedValue: number; 
    windowFill: number; 
    timestamp: string;
    rawHistory: number[];
    smoothedHistory: number[];
  }>>({});

  const [intraHomeState, setIntraHomeState] = useState<Record<string, {
    homeId: string;
    zoneId: string;
    type: string;
    unit: string;
    value: number;
    activeDevices: number;
    timestamp: string;
  }>>({});
  
  const [groupState, setGroupState] = useState<Record<string, { 
    activeDevices: number; 
    kThreshold: number; 
    status: "published" | "withheld"; 
    groupMean?: number; 
    noise?: number; 
    finalValue?: number; 
    unit?: string; 
    timestamp: string;
    groupMeanHistory: number[];
    finalValueHistory: number[];
  }>>({});

  // Communication State
  const [communicationGroups, setCommunicationGroups] = useState<Record<string, TelemetryCommunicationEvent>>({});

  // Logs stream
  const [logs, setLogs] = useState<LogLine[]>([]);
  
  const terminalContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Determine WS URL based on current origin (e.g. support dev mode proxy)
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    // In dev mode: window.location.host is localhost:5173, proxied via /ws
    const wsUrl = `${protocol}//${window.location.host}${window.location.port === "5173" ? "/ws" : ""}`;
    
    console.log(`[DASHBOARD CLIENT] Connexion au WebSocket à ${wsUrl}`);
    let ws: WebSocket;
    let reconnectTimeout: ReturnType<typeof setTimeout>;

    function connect() {
      setWsStatus("connecting");
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("[DASHBOARD CLIENT] WebSocket connecté.");
        setWsStatus("online");
        wsRef.current = ws;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const timestamp = data.timestamp || new Date().toISOString();
          const timeStr = new Date(timestamp).toLocaleTimeString();
          
          // Mark last event time
          setLastReceivedTime(Date.now());
          
          // Route config events
          if (data.layer === "runtime" && data.step === "config") {
            setConfig({
              kThreshold: data.kThreshold,
              sigma: data.sigma,
              windowSize: data.windowSize
            });
            return;
          }
          
          if (!data.layer) return;

          // Catch data formats for transitions
          if (data.layer === "devices") {
            if (data.rawReading && data.virtualProfile) {
              setDataFormatState(prev => ({
                ...prev,
                devicesToRuntime: { before: data.rawReading, after: data.virtualProfile }
              }));
            }
          } else if (data.layer === "runtime") {
            if (data.step === "intra_home" && data.individualProfile && data.homeProfile) {
              setDataFormatState(prev => ({
                ...prev,
                runtimeInternal: { before: data.individualProfile, after: data.homeProfile }
              }));
            }
          } else if (data.layer === "communication_decrypt") {
            if (data.encryptedPayload && data.decryptedPayload) {
              setDataFormatState(prev => ({
                ...prev,
                runtimeToCommunication: { before: data.encryptedPayload, after: data.decryptedPayload }
              }));
            }
            return; // Only for format tab, don't log in terminal
          } else if (data.layer === "communication") {
            if (data.directoryStoreStructure) {
              setDataFormatState(prev => ({
                ...prev,
                communicationToServices: {
                  before: data.directoryStoreStructure,
                  after: prev.communicationToServices?.after || null
                }
              }));
            }
          } else if (data.layer === "services") {
            if (data.responseBody) {
              setDataFormatState(prev => ({
                ...prev,
                communicationToServices: {
                  before: prev.communicationToServices?.before || null,
                  after: data.responseBody
                }
              }));
            }
          }

          // Flash active layer in ArchitectureFlow
          setLastEventLayer(data.layer);

          // Trigger sequential arrows when a new raw device data is processed
          if (data.layer === "devices") {
            setArrow1Active(true);
            setArrow2Active(false);
            setArrow3Active(false);

            setTimeout(() => {
              setArrow1Active(false);
              setArrow2Active(true);
            }, 600);

            setTimeout(() => {
              setArrow2Active(false);
              setArrow3Active(true);
            }, 1200);

            setTimeout(() => {
              setArrow3Active(false);
            }, 1800);
          }
          
          // Add to rolling log stream
          const logMsg = formatLogMessage(data);
          setLogs((prev) => [
            ...prev.slice(-49), // Keep last 50 logs
            {
              id: `${timestamp}-${Math.random()}`,
              time: timeStr,
              layer: data.layer,
              message: logMsg,
            },
          ]);

          // Route to proper state
          if (data.layer === "devices") {
            setDevices((prev) => ({
              ...prev,
              [data.deviceId]: {
                deviceId: data.deviceId,
                protocol: data.protocol,
                rawValue: data.rawValue,
                homeId: data.homeId,
                zoneId: data.zoneId,
                timestamp,
                unit: data.virtualProfile?.unit,
              },
            }));
          } 
          
          else if (data.layer === "runtime") {
            if (data.step === "temporal") {
              setTemporalState((prev) => {
                const current = prev[data.deviceId] || { rawHistory: [], smoothedHistory: [] };
                const rawHistory = [...(current.rawHistory || []).slice(-19), data.rawValue];
                const smoothedHistory = [...(current.smoothedHistory || []).slice(-19), data.smoothedValue];
                return {
                  ...prev,
                  [data.deviceId]: {
                    rawValue: data.rawValue,
                    smoothedValue: data.smoothedValue,
                    windowFill: data.windowFill,
                    unit: data.unit,
                    timestamp,
                    rawHistory,
                    smoothedHistory,
                  },
                };
              });
            } 
            else if (data.step === "intra_home") {
              const siteId = data.siteId || data.homeId;
              const siteType = data.siteType || "home";
              setIntraHomeState((prev) => ({
                ...prev,
                [`${siteId}-${data.type}`]: {
                  siteId,
                  siteType,
                  homeId: siteId,
                  zoneId: data.zoneId,
                  type: data.type,
                  unit: data.unit,
                  value: data.value,
                  activeDevices: data.activeDevices,
                  timestamp,
                }
              }));
            }
            else if (data.step === "kanon") {
              const siteType = data.siteType || "home";
              const stateKey = `${data.zoneId}--${siteType}--${data.type}`;
              setGroupState((prev) => {
                const current = prev[stateKey] || { groupMeanHistory: [], finalValueHistory: [] };
                return {
                  ...prev,
                  [stateKey]: {
                    ...prev[stateKey],
                    activeDevices: data.activeDevices,
                    kThreshold: data.kThreshold,
                    status: data.status,
                    groupMean: data.groupMean,
                    unit: data.unit,
                    timestamp,
                    groupMeanHistory: current.groupMeanHistory || [],
                    finalValueHistory: current.finalValueHistory || [],
                  },
                };
              });
            } 
            else if (data.step === "gaussian") {
              const siteType = data.siteType || "home";
              const stateKey = `${data.zoneId}--${siteType}--${data.type}`;
              setGroupState((prev) => {
                const current = prev[stateKey] || { groupMeanHistory: [], finalValueHistory: [] };
                const groupMeanHistory = data.groupMean !== undefined 
                  ? [...(current.groupMeanHistory || []).slice(-19), data.groupMean]
                  : (current.groupMeanHistory || []);
                const finalValueHistory = data.finalValue !== undefined
                  ? [...(current.finalValueHistory || []).slice(-19), data.finalValue]
                  : (current.finalValueHistory || []);
                return {
                  ...prev,
                  [stateKey]: {
                    ...prev[stateKey],
                    groupMean: data.groupMean,
                    noise: data.noise,
                    finalValue: data.finalValue,
                    unit: data.unit,
                    timestamp,
                    groupMeanHistory,
                    finalValueHistory,
                  },
                };
              });
            }
          } 
          
          else if (data.layer === "communication") {
            if (data.step === "config") {
              return;
            }
            const siteType = data.siteType || "home";
            const stateKey = `${data.zoneId}--${siteType}--${data.type}`;
            setCommunicationGroups((prev) => ({
              ...prev,
              [stateKey]: {
                zoneId: stateKey,
                type: data.type,
                value: data.value,
                unit: data.unit,
                timestamp,
              },
            }));
            
            // Also flash "services" layer as active since it connects downstream
            setTimeout(() => {
              setLastEventLayer("services");
            }, 800);
          }

        } catch (err) {
          console.error("Erreur lors de l'analyse du message de télémétrie :", err);
        }
      };

      ws.onclose = () => {
        console.log("[DASHBOARD CLIENT] WebSocket déconnecté. Reconnexion dans 3s...");
        setWsStatus("offline");
        reconnectTimeout = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      if (ws) ws.close();
      wsRef.current = null;
      clearTimeout(reconnectTimeout);
    };
  }, []);

  // Timer interval for elapsed time since last event
  useEffect(() => {
    if (lastReceivedTime === null) return;
    setSecondsSinceLastUpdate(0);
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - lastReceivedTime) / 1000);
      setSecondsSinceLastUpdate(elapsed);
    }, 1000);
    return () => clearInterval(interval);
  }, [lastReceivedTime]);

  const handleApplyConfig = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "update_config",
        ...config
      }));
      setIsConfigOpen(false);
    }
  };

  // Smart scroll console: only scroll to bottom if user is already at the bottom
  useEffect(() => {
    const container = terminalContainerRef.current;
    if (container) {
      const threshold = 25;
      const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight <= threshold;
      if (isAtBottom) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [logs]);

  const formatLogMessage = (data: any): string => {
    const toFixedSafe = (val: any, decimals = 2) => {
      return typeof val === "number" ? val.toFixed(decimals) : String(val);
    };

    if (data.layer === "devices") {
      return `Lecture brute de ${data.deviceId} (${data.protocol.toUpperCase()}) : valeur=${toFixedSafe(data.rawValue)}`;
    }
    if (data.layer === "runtime") {
      if (data.step === "temporal") {
        return `[Temporel] ${data.deviceId} : brute=${toFixedSafe(data.rawValue)} → lissée=${toFixedSafe(data.smoothedValue)} (remplissage=${Math.round(data.windowFill * 100)}%)`;
      }
      if (data.step === "intra_home") {
        return `[Site] ${data.siteId || data.homeId} (${data.siteType || "home"}) : type=${data.type} moyenne locale=${toFixedSafe(data.value)} (${data.activeDevices} capteur(s) actif(s))`;
      }
      if (data.step === "kanon") {
        return `[k-Anonymat] Zone "${data.zoneId}" (${data.siteType || "home"}) : actifs=${data.activeDevices}/${data.kThreshold} statut=${data.status === "published" ? "PUBLIÉ" : "RETENU"}`;
      }
      if (data.step === "gaussian") {
        return `[Perturbation] Zone "${data.zoneId}" (${data.siteType || "home"}) : moyenne=${toFixedSafe(data.groupMean)} bruit=${toFixedSafe(data.noise)} → finale=${toFixedSafe(data.finalValue)} ${data.unit || ""}`;
      }
    }
    if (data.layer === "communication") {
      if (data.step === "config") {
        return `[Configuration Cloud] K-Anonymat=${data.kThreshold}, σ=${data.sigma}`;
      }
      const zoneIdStr = data.zoneId || "";
      const cleanZoneId = zoneIdStr.includes("--") ? zoneIdStr.split("--")[0] : zoneIdStr;
      return `[Services d'annuaire] Zone "${cleanZoneId}" (${data.siteType || "home"}) stockée : valeur=${toFixedSafe(data.value)} ${data.unit || ""}`;
    }
    if (data.layer === "services") {
      return `API REST GET ${data.path} → Statut ${data.status} (Zero Trust vérifié)`;
    }
    return JSON.stringify(data);
  };

  return (
    <div className="app-container">
      
      {/* Top Header */}
      <header className="app-header">
        <div className="header-title-group">
          <div className="logo-badge">CHARIOT</div>
          <div>
            <h1 className="app-title">Tableau de bord de l'architecture en temps réel</h1>
            <p className="app-subtitle">Interopérabilité Smart Home hétérogène avec anonymisation préservant la vie privée</p>
          </div>
        </div>
        
        <div style={{ display: "flex", gap: "1rem", alignItems: "center", position: "relative" }}>
          {/* Last Update indicator */}
          {secondsSinceLastUpdate !== null && (
            <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontStyle: "italic" }}>
              {secondsSinceLastUpdate === 0 ? "Dernière donnée : à l'instant" : `Dernière donnée reçue il y a ${secondsSinceLastUpdate}s`}
            </div>
          )}

          {/* Telemetry status indicator */}
          <div className="system-status">
            <span className={`status-dot ${wsStatus === "online" ? "" : wsStatus === "connecting" ? "connecting" : "offline"}`} />
            Canal de télémétrie : {wsStatus === "online" ? "CONNECTÉ" : wsStatus === "connecting" ? "CONNEXION..." : "HORS-LIGNE"}
          </div>

          {/* Collapsible live control panel button */}
          {wsStatus === "online" && (
            <div>
              <button className="config-toggle-btn" onClick={() => setIsConfigOpen(!isConfigOpen)}>
                ⚙️ Config Live
              </button>
              {isConfigOpen && (
                <div className="config-panel">
                  <div style={{ fontWeight: "700", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "0.5rem", color: "var(--color-runtime)" }}>
                    Paramètres de l'anonymisation
                  </div>
                  
                  <div className="config-group">
                    <label className="config-label">
                      Seuil K-Anonymat (K)
                      <span className="config-value-badge">{config.kThreshold}</span>
                    </label>
                    <input 
                      type="range" 
                      min="1" 
                      max="10" 
                      step="1"
                      className="config-slider" 
                      value={config.kThreshold} 
                      onChange={(e) => setConfig({ ...config, kThreshold: parseInt(e.target.value) })}
                    />
                  </div>

                  <div className="config-group">
                    <label className="config-label">
                      Bruit Gaussien (σ)
                      <span className="config-value-badge">{config.sigma.toFixed(2)}</span>
                    </label>
                    <input 
                      type="range" 
                      min="0.0" 
                      max="2.0" 
                      step="0.05"
                      className="config-slider" 
                      value={config.sigma} 
                      onChange={(e) => setConfig({ ...config, sigma: parseFloat(e.target.value) })}
                    />
                  </div>

                  <div className="config-group">
                    <label className="config-label">
                      Fenêtre temporelle (N)
                      <span className="config-value-badge">{config.windowSize}</span>
                    </label>
                    <input 
                      type="range" 
                      min="1" 
                      max="20" 
                      step="1"
                      className="config-slider" 
                      value={config.windowSize} 
                      onChange={(e) => setConfig({ ...config, windowSize: parseInt(e.target.value) })}
                    />
                  </div>

                  <button className="config-apply-btn" onClick={handleApplyConfig}>
                    Appliquer
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Main Flow Visualizer */}
      <ArchitectureFlow 
        lastEventLayer={lastEventLayer} 
        arrow1Active={arrow1Active}
        arrow2Active={arrow2Active}
        arrow3Active={arrow3Active}
      />

      {/* Tabs navigation bar */}
      <div className="tabs-navigation">
        <button 
          className={`tab-btn ${activeTab === "live" ? "active" : ""}`}
          onClick={() => setActiveTab("live")}
        >
          Vue live
        </button>
        <button 
          className={`tab-btn ${activeTab === "spatial" ? "active" : ""}`}
          onClick={() => setActiveTab("spatial")}
        >
          Vue spatiale
        </button>
        <button 
          className={`tab-btn ${activeTab === "format" ? "active" : ""}`}
          onClick={() => setActiveTab("format")}
        >
          Format des données
        </button>
      </div>

      {activeTab === "live" ? (
        /* 4 Dashboard Panels Grid */
        <div className="dashboard-grid">
          <DevicesPanel devices={devices} />
          <RuntimePanel temporalState={temporalState} intraHomeState={intraHomeState} />
          <CommunicationPanel zones={communicationGroups} privacyState={groupState} />
          <ServicesPanel />
        </div>
      ) : activeTab === "spatial" ? (
        <SpatialView 
          devices={devices} 
          intraHomeState={intraHomeState} 
          privacyState={groupState} 
        />
      ) : (
        /* Data Format Tab Content */
        <DataFormatPanel dataFormatState={dataFormatState} />
      )}

      {/* Terminal Stream Console */}
      <div className="terminal-panel" ref={terminalContainerRef}>
        {logs.length === 0 ? (
          <div style={{ color: "var(--text-muted)", fontStyle: "italic" }}>
            Connexion à la réception de la télémétrie... Le flux est vide. Veuillez vérifier que les devices, la passerelle runtime et les services MQTT sont actifs.
          </div>
        ) : (
          logs.map((log) => (
            <div className="terminal-line" key={log.id}>
              <span className="terminal-time">[{log.time}]</span>
              <span className={`terminal-layer layer-${log.layer}`}>
                [{log.layer.toUpperCase()}]
              </span>
              <span className="terminal-msg">{log.message}</span>
            </div>
          ))
        )}
      </div>

    </div>
  );
}
