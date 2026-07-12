import React from "react";

interface ArchitectureFlowProps {
  lastEventLayer?: "devices" | "runtime" | "communication" | "services" | "";
  arrow1Active?: boolean;
  arrow2Active?: boolean;
  arrow3Active?: boolean;
}

export const ArchitectureFlow: React.FC<ArchitectureFlowProps> = ({ 
  lastEventLayer,
  arrow1Active,
  arrow2Active,
  arrow3Active
}) => {
  return (
    <div className="flow-container">
      <div className="flow-title">
        <span className="pulse-circle" style={{ "--pulse-color": "var(--color-runtime)" } as React.CSSProperties}></span>
        Visualisateur de flux de l'architecture
      </div>
      <div className="architecture-flow">
        {/* Étape 1 : Devices */}
        <div 
          className={`flow-node ${lastEventLayer === "devices" ? "active" : ""}`}
          style={{ 
            "--node-color": "var(--color-devices)", 
            "--node-color-rgb": "192, 132, 252" 
          } as React.CSSProperties}
        >
          <div className="flow-node-title" style={{ color: "var(--color-devices)" }}>1. Couche Devices</div>
          <div className="flow-node-desc">Protocoles Matter & Mocks (Zigbee/Thread)</div>
          <div className="badge">Données brutes</div>
        </div>

        <div className="flow-arrow flow-arrow-1">
          {arrow1Active && <div className="flow-pulse" style={{ "--color-runtime": "var(--color-devices)" } as React.CSSProperties} />}
        </div>

        {/* Étape 2 : Passerelle Runtime */}
        <div 
          className={`flow-node ${lastEventLayer === "runtime" ? "active" : ""}`}
          style={{ 
            "--node-color": "var(--color-runtime)", 
            "--node-color-rgb": "56, 189, 248" 
          } as React.CSSProperties}
        >
          <div className="flow-node-title" style={{ color: "var(--color-runtime)" }}>2. Passerelle Runtime</div>
          <div className="flow-node-desc">Consentement & Pipeline d'anonymisation</div>
          <div className="badge">Anonymisées &amp; Chiffrées</div>
        </div>

        <div className="flow-arrow flow-arrow-2">
          {arrow2Active && <div className="flow-pulse" style={{ "--color-runtime": "var(--color-runtime)" } as React.CSSProperties} />}
        </div>

        {/* Étape 3 : Couche Communication */}
        <div 
          className={`flow-node ${lastEventLayer === "communication" ? "active" : ""}`}
          style={{ 
            "--node-color": "var(--color-communication)", 
            "--node-color-rgb": "45, 212, 191" 
          } as React.CSSProperties}
        >
          <div className="flow-node-title" style={{ color: "var(--color-communication)" }}>3. Couche Communication</div>
          <div className="flow-node-desc">Message Bus MQTT &amp; Services d'annuaire</div>
          <div className="badge">Stockage sécurisé</div>
        </div>

        <div className="flow-arrow flow-arrow-3">
          {arrow3Active && <div className="flow-pulse" style={{ "--color-runtime": "var(--color-communication)" } as React.CSSProperties} />}
        </div>

        {/* Étape 4 : Couche Services */}
        <div 
          className={`flow-node ${lastEventLayer === "services" ? "active" : ""}`}
          style={{ 
            "--node-color": "var(--color-services)", 
            "--node-color-rgb": "74, 222, 128" 
          } as React.CSSProperties}
        >
          <div className="flow-node-title" style={{ color: "var(--color-services)" }}>4. Couche Services</div>
          <div className="flow-node-desc">API REST Zero Trust (Serveur Express)</div>
          <div className="badge">Point d'entrée Smart City</div>
        </div>
      </div>
    </div>
  );
};
