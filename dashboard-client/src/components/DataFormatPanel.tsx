import React from "react";

function syntaxHighlight(json: any) {
  if (json === null || json === undefined) {
    return '<span class="json-null">null</span>';
  }
  let str = typeof json !== "string" ? JSON.stringify(json, null, 2) : json;
  
  // Escaping HTML characters to prevent XSS
  str = str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  
  return str.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    function (match) {
      let cls = "json-number";
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = "json-key";
        } else {
          cls = "json-string";
        }
      } else if (/true|false/.test(match)) {
        cls = "json-boolean";
      } else if (/null/.test(match)) {
        cls = "json-null";
      }
      return '<span class="' + cls + '">' + match + '</span>';
    }
  );
}

interface DataFormatPanelProps {
  dataFormatState: {
    devicesToRuntime: { before: any; after: any } | null;
    runtimeInternal: { before: any; after: any } | null;
    runtimeToCommunication: { before: any; after: any } | null;
    communicationToServices: { before: any; after: any } | null;
  };
}

export const DataFormatPanel: React.FC<DataFormatPanelProps> = ({ dataFormatState }) => {
  const transitions = [
    {
      id: "devices-to-runtime",
      title: "1. Devices ➡️ Runtime",
      desc: "Payload brut Matter (valeur non convertie) ➡️ Profil virtuel normalisé",
      state: dataFormatState.devicesToRuntime,
      beforeLabel: "Payload brut Matter (JSON)",
      afterLabel: "Profil virtuel normalisé (JSON)",
    },
    {
      id: "runtime-internal",
      title: "2. Runtime (Interne)",
      desc: "Profil virtuel individuel ➡️ Profil de groupe anonymisé (K-anonymat + Perturbation)",
      state: dataFormatState.runtimeInternal,
      beforeLabel: "Profil individuel (JSON)",
      afterLabel: "Profil de groupe anonymisé (JSON)",
    },
    {
      id: "runtime-to-communication",
      title: "3. Runtime ➡️ Communication",
      desc: "Payload chiffré transmis via MQTT ➡️ Payload déchiffré et validé côté Communication",
      state: dataFormatState.runtimeToCommunication,
      beforeLabel: "Payload chiffré transmis (AES-256-GCM)",
      afterLabel: "Profil déchiffré & validé (JSON)",
    },
    {
      id: "communication-to-services",
      title: "4. Communication ➡️ Services",
      desc: "Structure stockée dans l'annuaire Directory Services ➡️ Réponse JSON retournée par l'API REST",
      state: dataFormatState.communicationToServices,
      beforeLabel: "Structure stockée (Historique 10 valeurs)",
      afterLabel: "Réponse API REST (GET /devices/:id)",
    },
  ];

  return (
    <div className="format-tab-container">
      {transitions.map((t) => (
        <div className="transition-block" key={t.id}>
          <div className="transition-header">
            <h3 className="transition-title">{t.title}</h3>
            <p className="transition-desc">{t.desc}</p>
          </div>

          <div className="json-box-container">
            {/* Before Block */}
            <div className="json-box">
              <div className="json-box-title">{t.beforeLabel}</div>
              <div className="json-box-content">
                {t.state && t.state.before ? (
                  <pre
                    className="json-pre"
                    dangerouslySetInnerHTML={{ __html: syntaxHighlight(t.state.before) }}
                  />
                ) : (
                  <div className="json-empty">En attente de données pour cette transition...</div>
                )}
              </div>
            </div>

            {/* After Block */}
            <div className="json-box">
              <div className="json-box-title">{t.afterLabel}</div>
              <div className="json-box-content">
                {t.state && t.state.after ? (
                  <pre
                    className="json-pre"
                    dangerouslySetInnerHTML={{ __html: syntaxHighlight(t.state.after) }}
                  />
                ) : (
                  <div className="json-empty">En attente de données pour cette transition...</div>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
