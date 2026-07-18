# Instruction : ajouter un type de donnée "consommation d'énergie"

## Contexte
@AGENT.md contient l'architecture complète du projet CHARIOT. Actuellement, seul un type de donnée est simulé (température). Pour rendre la pipeline d'anonymisation plus pertinente à démontrer, on ajoute un second type de donnée : la **consommation d'énergie** (kWh).

## Pourquoi ce type de donnée
Contrairement à la température (peu sensible en soi), la consommation d'énergie révèle des informations bien plus intimes sur les habitants : présence/absence du foyer, usage d'appareils spécifiques, habitudes de vie. C'est un cas d'usage directement lié à la résilience énergétique (smart grid) et rend le principe d'anonymisation (agrégation intra-maison + k-anonymat inter-maisons + bruit) beaucoup plus parlant en démo : on peut expliquer concrètement pourquoi il ne faut jamais exposer la consommation d'une maison individuelle (ça permettrait de déduire si quelqu'un est chez lui ou non).

## Fonctionnalités attendues
1. Ajoute un nouveau device simulé de type consommation d'énergie (mock, comme les devices Zigbee/Thread existants — pas besoin de protocole Matter réel pour celui-ci).
2. Valeur simulée réaliste : consommation en kWh, avec une variation qui suit un pattern journalier simple (ex. plus haute le matin/soir, plus basse la nuit) plutôt qu'une marche aléatoire pure — pour illustrer un cas d'usage crédible en démo.
3. Ce device doit passer par la même pipeline que les devices existants : agrégation temporelle → agrégation intra-maison (par type — donc les devices "energy" d'une maison sont agrégés ensemble, séparément des devices "temperature") → k-anonymat inter-maisons → bruit gaussien.
4. Chaque maison simulée dans la démo doit avoir au moins un device de chaque type (température ET énergie), pour montrer que la pipeline gère plusieurs types de données en parallèle, chacun avec son propre flux d'agrégation par zone.

## Choix techniques
- Nouveau mock driver (ex. `EnergyMockDriver.ts`), suivant le même pattern que les mocks Zigbee/Thread déjà en place.
- Unité : `kWh`. Type de donnée : `"energy_consumption"` (ou équivalent cohérent avec le champ `type` déjà utilisé pour température).
- Le profil virtuel suit la même structure existante (`{ deviceId, type, unit, value, timestamp }`), juste avec `type: "energy_consumption"` et `unit: "kWh"`.

## Exigences techniques
- Logs clairs en console, cohérents avec le reste du pipeline existant.
- Code commented in English (cf. AGENT.md).
- Mets à jour le README concerné (runtime) pour mentionner ce nouveau type de donnée et sa justification (pertinence pour l'anonymisation).

## Contrat d'interface à respecter
- Le `type` du profil virtuel (`"energy_consumption"` vs `"temperature"`) doit être utilisé comme clé de séparation dans l'agrégation intra-maison ET dans le k-anonymat inter-maisons — un groupe/zone ne doit jamais mélanger des valeurs de température avec des valeurs d'énergie dans une même moyenne.

## Livrables attendus
- Nouveau mock driver fonctionnel, intégré au pipeline runtime existant
- Configuration mise à jour pour que chaque maison simulée ait un device de chaque type
- Test unitaire simple vérifiant que les agrégations par type restent bien séparées (pas de mélange température/énergie)

## Ne pas faire
- Ne pas ajouter d'autres types de données que celui-ci pour l'instant (pas de CO2, humidité, etc. — un seul type additionnel suffit pour illustrer le principe de séparation par type)
- Ne pas modifier la logique de k-anonymat elle-même — juste s'assurer qu'elle s'applique correctement par type de donnée