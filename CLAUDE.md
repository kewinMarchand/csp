# CLAUDE.md : csp

Paquet personnel. Les conventions générales sont dans `~/.claude/CLAUDE.md` : ce fichier ne note que les choix propres au dépôt.

- **Projet personnel** : aucune mention d'employeur ni du projet d'où vient la demande. Auteur des commits : Kewin Marchand <kewin.marchand@gmail.com>.
- **Développement en conteneur** : seuls prérequis Docker avec Compose, `make` et git. Service `node` (Node 24.14.1 alpine, plus git pour lint-staged) et service `php` (même image que le boilerplate Symfony, `dunglas/frankenphp:1-php8.4-bookworm`, Composer copié de `composer/composer:2-bin`).
- **Deux langages, un seul comportement** : `src/index.ts` (JavaScript) et `php/src/Csp.php` (PHP) se traduisent l'un l'autre. `tests/cases.json` est lu par Vitest et par PHPUnit : un cas ajouté vaut pour les deux, et une différence d'en-tête ou de phrase fait échouer l'un des deux. Changer la phrase, c'est changer les deux implémentations et le cas.
- **Un seul gestionnaire de route** : `cspReportRoute()` prend une `Request` et rend une `Response`. Next, SvelteKit, Nuxt (`toWebRequest`) et Hono (`c.req.raw`) l'appellent en une ligne : pas d'adaptateur par framework.
- **`dist/` versionné** : les sites consomment le paquet par dépendance git, sans étape de build. `make build` le régénère, `make qa` échoue s'il est périmé (`build:check`). JavaScript plutôt que les sources TypeScript, que Next ne compile pas dans `node_modules` sans réglage.
- **`composer.json` à la racine** : Composer n'installe depuis git qu'un paquet dont le `composer.json` est à la racine du dépôt. Le code PHP vit dans `php/`. Pas de `composer.lock` versionné (bibliothèque).
- **Lecture bornée** : la route JS lit le corps par morceaux et s'arrête dès 10 000 caractères dépassés, même sans `Content-Length`. Un `Content-Length` annoncé au-delà de 4 × la limite (un caractère UTF-8 fait au plus 4 octets) renvoie 413 sans lecture, en JS comme en PHP.
- **Pas de query string dans une ligne** : page = chemin de `document-uri`, source = origine et chemin de `source-file`. Les paramètres d'URL peuvent porter des données de visiteur.

## Règles de lint

- `simple-import-sort/imports` en erreur : tiers, relatifs, types, effets de bord (ordre de standards-front, sans les groupes de couches, sans objet ici).
- `no-console` permet `info` : la route écrit ses lignes par `console.info`, sur la sortie standard.
