# Instruction : vue spatiale hiérarchique (zone → maisons → devices)

## Contexte
@AGENT.md contient l'architecture complète du projet CHARIOT. Le dashboard existant (packages `dashboard` et `dashboard-client`) affiche déjà une vue "flux" par couches (Devices → Runtime → Communication → Services) et un onglet "Format des données". On ajoute maintenant une troisième vue : une représentation **spatiale/hiérarchique** qui montre visuellement l'organisation en groupes imbriqués (device → maison → zone), et comment ces groupes communiquent avec la communication layer et le service layer.

## Objectif de cette vue
Illustrer visuellement le principe de confidentialité à deux niveaux de l'architecture : plusieurs devices regroupés dans une maison (agrégation intra-maison), plusieurs maisons regroupées dans une zone (k-anonymat inter-maisons), puis la zone qui communique avec le middleware cloud et les services externes. Le but est de rendre ce concept immédiatement compréhensible visuellement pour un jury, sans lecture de texte.

## Fonctionnalités attendues
1. Nouvel onglet dans la navigation existante (ex. "Vue spatiale"), aux côtés de "Vue live" et "Format des données".
2. Représentation visuelle imbriquée :
   - Un ou plusieurs **conteneurs "zone"** (ex. "quartier-nord"), affichés comme de grands cadres.
   - À l'intérieur de chaque zone, un ou plusieurs **conteneurs "maison"** (ex. "house-1", "house-2"), affichés comme des cadres plus petits imbriqués dans la zone.
   - À l'intérieur de chaque maison, les **devices** actifs de cette maison (icônes ou petites cartes), avec leur type et dernière valeur brute.
3. Lignes/flèches de connexion visuelles :
   - De chaque device vers sa maison (agrégation intra-maison).
   - De chaque zone vers un bloc "Communication Layer" (k-anonymat inter-maisons + bruit).
   - Du bloc "Communication Layer" vers un bloc "Service Layer" (API REST exposée).
4. Mise à jour en temps réel : la couleur/état visuel d'une maison ou d'une zone reflète son statut (ex. maison active = contour vert, zone dont le seuil K est atteint = badge "publié" vs "en attente").
5. Affichage du seuil K et du nombre de maisons actives par zone directement sur le conteneur de la zone (ex. "2/2 maisons — publié").

## Choix techniques
- Reste dans le package `dashboard-client` (React), nouveau composant (ex. `SpatialView.tsx`).
- Pas besoin de librairie de diagramme complexe (D3, React Flow) si une mise en page CSS simple (flexbox/grid imbriqué) suffit à représenter la hiérarchie zone > maison > device — privilégie la simplicité si le rendu reste clair. Si tu juges qu'une librairie légère (ex. `react-flow` pour les connexions/flèches) apporte une vraie valeur visuelle sans complexité excessive, tu peux la proposer, mais documente ce choix.
- Réutilise le même canal de télémétrie WebSocket déjà en place (pas de nouveau canal de données nécessaire) — cette vue est une réorganisation visuelle des données déjà reçues, pas une nouvelle source de données.

## Exigences techniques
- Design cohérent avec le reste du dashboard (mêmes couleurs par couche, mode sombre).
- Lisible même en projection (grande salle, écran partagé) — tailles de police et contrastes suffisants.
- Code commented in English (cf. AGENT.md).
- Met à jour le README du dashboard pour mentionner cette nouvelle vue.

## Contrat d'interface à respecter
- Consomme les mêmes événements de télémétrie déjà émis par runtime/communication (pas de nouveau format de données à créer côté backend, sauf si un champ manque clairement pour cette vue — dans ce cas, ajoute-le au format de télémétrie existant plutôt que de créer un canal séparé).

## Livrables attendus
- Nouveau composant fonctionnel, accessible via le nouvel onglet
- Mise à jour en temps réel visible pendant une démo (plusieurs maisons, plusieurs devices)
- README à jour

## Ne pas faire
- Ne pas dupliquer la logique métier (agrégation, k-anonymat) côté frontend — cette vue affiche uniquement ce que le backend calcule déjà et transmet via télémétrie
- Ne pas sur-ingénierer avec une librairie de diagramme lourde si une mise en page CSS simple suffit
- Ne pas casser les vues existantes ("Vue live", "Format des données") — cette vue s'ajoute en parallèle