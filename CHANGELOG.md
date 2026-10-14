# Journal des versions

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Versions en [SemVer](https://semver.org/lang/fr/).

## 0.1.1

### Corrigé

- Route JavaScript : un corps un peu au-delà de 10 000 caractères est lu jusqu'au bout avant la réponse 413. Annuler le flux faisait couper la connexion par le serveur Node, et le client recevait une erreur réseau au lieu du 413. La lecture n'est annulée qu'au-delà de 40 000 octets.

## 0.1.0

Première version : en-tête `Content-Security-Policy-Report-Only` (directives par défaut, origine de l'API, origines ajoutées), route de rapport `POST /api/csp-report` (413, 400, 204 et une phrase par rapport, sans query string), ligne de démarrage du serveur. JavaScript sans dépendance (`Request` → `Response`) et PHP (abonné et contrôleur Symfony), vérifiés par les mêmes cas.
