# Gateway locale (Runtime environment) - CHARIOT

Ce package contient l'implémentation de la couche **Runtime** (Gateway locale) du projet CHARIOT.

## Rôle et Pipeline Interne

La gateway s'exécute localement et traite les données des capteurs de la smart home de bout en bout via le pipeline suivant :

1. **Embedded Broker** : Lance un broker MQTT embarqué (Aedes) sur le port `1883`.
2. **Drivers (Matter)** : Se connecte au capteur de température virtuel Matter (démarré sur le port `5540`), s'abonne à ses valeurs brutes de température et les injecte dans le pipeline.
3. **Protocoles Support** : Couche d'abstraction unifiant les événements de tous les drivers de protocoles.
4. **Data Access** : Contrôle de conformité de consentement utilisateur (Data Act). Si l'utilisateur n'autorise pas un type de données, la transmission est immédiatement interrompue.
5. **Devices Mapping** : Normalise la lecture brute en un format générique normalisé (Profile Property Identifier) de type `{ deviceId, type, unit, value, timestamp }`. Le mappage gère également la division par 100 de la valeur brute Matter (conformément aux spécifications du cluster de température Matter).
6. **Data Encryption** : Chiffrement AES-256-GCM du profil virtuel. La clé de 32 octets est dérivée à l'aide de la méthode cryptographique native `crypto.scryptSync`.
7. **Mqtt Publisher** : Publie le message chiffré sur le broker Aedes local, sur le topic `chariot/devices/{deviceId}`.

## Installation et Lancement

### Étape 1 : Démarrer le capteur virtuel Matter
Dans un terminal dédié à la racine du monorepo :
```bash
npm start -w devices
```

### Étape 2 : Démarrer le Runtime (la Gateway)
Dans un autre terminal à la racine du monorepo :
```bash
npm run build -w runtime
npm start -w runtime
```

## Démo et Simulation de Consentement

Pour faciliter la démonstration orale, le runtime intègre un simulateur dynamique de consentement utilisateur :
1. **Pendant les 15 premières secondes** : Les données du capteur de température sont autorisées, normalisées, chiffrées, et publiées sur le broker MQTT.
2. **Après 15 secondes** : Le système révoque dynamiquement l'autorisation de transmettre le type de donnée `temperature`.
3. **Mises à jour suivantes** : Les données brutes reçues du driver Matter sont immédiatement bloquées par la couche `DataAccess`, montrant des logs d'interruption clairs en console.

## Vérification et Écoute MQTT

Vous pouvez vérifier le contenu publié sur le broker en utilisant un script d'écoute MQTT ou un client graphique comme MQTT X.

### Script de test rapide (`listen.js`)
Un script d'écoute rapide est fourni à la racine de la gateway. Pour le lancer dans un troisième terminal :
```bash
node dist/listen.js
```
Il affichera en temps réel les payloads chiffrés reçus et tentera de les déchiffrer avec la clé dérivée pour prouver la validité du chiffrement/déchiffrement de bout en bout.
