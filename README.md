# @kewinmarchand/csp

Content-Security-Policy en mode **Report-Only**, pour tout site : l'en-tête, la route qui reçoit les rapports du navigateur, et une phrase lisible par rapport dans les logs du serveur.

```
[csp-report] https://cdn.exemple.com a besoin d'une autorisation de type script (script-src) — bloqué sur /chemin, chargé par https://www.googletagmanager.com/gtm.js
```

Chaque ligne se lit comme si la ressource avait été bloquée : on voit ce qu'une CSP stricte casserait, avant de la rendre bloquante.

- **JavaScript** (`src/`, compilé dans `dist/`) : sans dépendance ni framework. La route parle `Request` et `Response`, comme Next, SvelteKit, Nuxt (h3) et Hono.
- **PHP** (`php/`) : la même logique, plus un abonné qui pose l'en-tête et un contrôleur pour Symfony.
- Les deux sont vérifiés par les mêmes cas (`tests/cases.json`) : même en-tête, même phrase, même statut.

## Installer

Dépendance git par étiquette de version, sans publication sur un registre.

```json
"dependencies": { "@kewinmarchand/csp": "github:kewinMarchand/csp#v0.1.0" }
```

```json
"repositories": [{ "type": "vcs", "url": "https://github.com/kewinMarchand/csp" }],
"require": { "kewinmarchand/csp": "^0.1" }
```

## Ce que fait le paquet

| Fonction (JS)                             | PHP                                          | Rôle                                                                                                                                      |
| ----------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `defaultDirectives({ apiOrigin, extra })` | `Csp::defaultDirectives($apiOrigin, $extra)` | Directives de départ, plus l'origine de l'API en `connect-src` et les origines ajoutées par directive                                     |
| `buildCsp(directives, { reportUri })`     | `Csp::build($directives, $reportUri)`        | Valeur de l'en-tête `Content-Security-Policy-Report-Only`                                                                                 |
| `cspReportRoute({ log })`                 | `CspReportController`                        | Route `POST /api/csp-report` : 413 au-delà de 10 000 caractères, 400 pour un JSON invalide, sinon 204 et une ligne sur la sortie standard |
| `handleCspReport(texte)`                  | `Csp::handleReport($texte)`                  | Le même traitement, sans HTTP : statut et ligne                                                                                           |
| `formatCspReport(rapport)`                | `Csp::formatReport($rapport)`                | La phrase seule                                                                                                                           |
| `startupLine(app, environnement)`         | `Csp::startupLine($app, $env)`               | `[app] serveur démarré (production)`, à écrire au démarrage                                                                               |

Directives par défaut :

```
default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self';
img-src 'self' data: https:; media-src 'self'; connect-src 'self' <origine de l'API>; frame-src 'self';
worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; report-uri /api/csp-report
```

La phrase ne contient jamais de query string : la page n'est que son chemin, la source son origine et son chemin, la ressource bloquée son origine (ou le mot-clé du navigateur, `inline`, `eval`). Les paramètres d'URL peuvent porter des données de visiteur.

## Brancher

### Next (App Router)

```ts
// next.config.ts
import { buildCsp, CSP_HEADER, CSP_REPORT_PATH, defaultDirectives } from '@kewinmarchand/csp'

const csp = buildCsp(defaultDirectives({ apiOrigin: process.env.API_URL }), {
  reportUri: CSP_REPORT_PATH,
})
const nextConfig = {
  headers: async () => [{ source: '/:path*', headers: [{ key: CSP_HEADER, value: csp }] }],
}
```

```ts
// src/app/api/csp-report/route.ts
import { cspReportRoute } from '@kewinmarchand/csp'

export const POST = cspReportRoute()
```

```ts
// src/instrumentation.ts
import { startupLine } from '@kewinmarchand/csp'

export const register = () => console.info(startupLine('mon-site', process.env.NODE_ENV))
```

### SvelteKit

```ts
// src/hooks.server.ts
import { buildCsp, CSP_HEADER, CSP_REPORT_PATH, defaultDirectives } from '@kewinmarchand/csp'

const csp = buildCsp(defaultDirectives({ apiOrigin: env.API_URL }), { reportUri: CSP_REPORT_PATH })
export const handle = async ({ event, resolve }) => {
  const response = await resolve(event)
  response.headers.set(CSP_HEADER, csp)
  return response
}
```

```ts
// src/routes/api/csp-report/+server.ts
import { cspReportRoute } from '@kewinmarchand/csp'

const route = cspReportRoute()
export const POST = ({ request }) => route(request)
```

### Nuxt

```ts
// server/api/csp-report.post.ts
import { cspReportRoute } from '@kewinmarchand/csp'

const route = cspReportRoute()
export default defineEventHandler((event) => route(toWebRequest(event)))
```

L'en-tête se pose dans `routeRules` de `nuxt.config.ts` (`'/**': { headers: { [CSP_HEADER]: csp } }`).

### Hono et Node

```ts
const route = cspReportRoute()
app.use(async (c, next) => {
  await next()
  c.header(CSP_HEADER, csp)
})
app.post(CSP_REPORT_PATH, (c) => route(c.req.raw))
```

### Symfony

```yaml
# config/services.yaml
Kewinmarchand\Csp\Symfony\CspResponseSubscriber:
  factory: ['Kewinmarchand\Csp\Symfony\CspResponseSubscriber', 'create']
  arguments: ['%env(API_URL)%']
  tags: ['kernel.event_subscriber']

Kewinmarchand\Csp\Symfony\CspReportController:
  tags: ['controller.service_arguments']
```

```yaml
# config/routes.yaml
csp_report:
  path: /api/csp-report
  controller: Kewinmarchand\Csp\Symfony\CspReportController
  methods: [POST]
```

### API (JSON seulement)

Une API ne sert pas de pages : l'en-tête minimal `default-src 'none'; frame-ancestors 'none'` suffit, sans route de rapport.

## Lire les logs

Une ligne par rapport, sur la sortie standard du serveur : `docker compose logs -f <service>` en local, la console de logs de l'hébergeur en production. La ligne `[app] serveur démarré (environnement)` permet de retrouver le bon fichier quand l'hébergeur en garde plusieurs.

## Autoriser une origine

Seules les origines que le site charge réellement sont autorisées. Quand un rapport signale une ressource légitime, l'ajouter à sa directive :

```ts
defaultDirectives({ apiOrigin, extra: { 'script-src': ['https://www.googletagmanager.com'] } })
```

Le nom de la directive est entre parenthèses dans la phrase du rapport.

## Pourquoi Report-Only, et pourquoi `'unsafe-inline'`

- **Report-Only** : rien n'est bloqué. On collecte d'abord ce que le site charge vraiment, on autorise ce qui est légitime, puis on peut passer à `Content-Security-Policy` sans casser une page.
- **`'unsafe-inline'`** en script et en style : l'hydratation des frameworks et le CSS-in-JS injectent du code en ligne. La seule alternative propre, un nonce par réponse, rend toutes les pages dynamiques et prive le site du rendu statique. C'est le compromis assumé de ce paquet.
- **Images `data:` et `https:`** : les images ne s'exécutent pas, et un site de contenu en tire de partout.

## Développer

Prérequis : Docker avec Compose, `make` et git.

| Commande       | Effet                                                |
| -------------- | ---------------------------------------------------- |
| `make install` | images Node et PHP, dépendances, hook git            |
| `make build`   | compile `src/` vers `dist/` (versionné)              |
| `make qa`      | lint, format, types, `dist/` à jour, tests JS et PHP |

## Licence

MIT, voir `LICENSE`.
