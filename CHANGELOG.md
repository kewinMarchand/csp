# Journal des versions

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Versions en [SemVer](https://semver.org/lang/fr/).

## 0.1.0

Première version : en-tête `Content-Security-Policy-Report-Only` (directives par défaut, origine de l'API, origines ajoutées), route de rapport `POST /api/csp-report` (413, 400, 204 et une phrase par rapport, sans query string), ligne de démarrage du serveur. JavaScript sans dépendance (`Request` → `Response`) et PHP (abonné et contrôleur Symfony), vérifiés par les mêmes cas.
