/**
 * CSP en mode « Report-Only » : l'en-tête, la phrase écrite pour chaque rapport et la route qui les reçoit.
 * Sans dépendance ni framework : tout site qui parle `Request` et `Response` (Next, SvelteKit, Nuxt, Hono…) branche la route
 * en une ligne. L'équivalent PHP vit dans `php/`, vérifié par les mêmes cas (`tests/cases.json`).
 */

export const CSP_HEADER = 'Content-Security-Policy-Report-Only'
export const CSP_REPORT_PATH = '/api/csp-report'
/** Taille maximale d'un rapport, en caractères : au-delà, la route répond 413 sans le lire. */
export const MAX_REPORT_LENGTH = 10_000

export type Directive =
  | 'default-src'
  | 'script-src'
  | 'style-src'
  | 'font-src'
  | 'img-src'
  | 'media-src'
  | 'connect-src'
  | 'frame-src'
  | 'worker-src'
  | 'object-src'
  | 'base-uri'
  | 'frame-ancestors'

export type Directives = Partial<Record<Directive, readonly string[]>>

/** Libellé lisible de chaque directive, dans la phrase du rapport. */
export const DIRECTIVE_LABELS: Readonly<Record<string, string>> = {
  'script-src': 'script',
  'style-src': 'feuille de style',
  'connect-src': 'appel réseau',
  'frame-src': 'iframe',
  'img-src': 'image',
  'font-src': 'police',
  'media-src': 'média',
  'worker-src': 'worker',
  'object-src': 'objet embarqué',
  'frame-ancestors': 'affichage du site en iframe',
  'base-uri': 'balise base',
}

export interface DefaultDirectivesOptions {
  /** Adresse de l'API appelée par le navigateur : seule son origine est autorisée en `connect-src`. */
  apiOrigin?: string | undefined
  /** Origines à ajouter, directive par directive, à celles par défaut. */
  extra?: Directives
}

const originOf = (address: string) => {
  try {
    const { origin } = new URL(address)
    return origin === 'null' ? address : origin
  } catch {
    return address
  }
}

/**
 * Directives de départ : le site lui-même, et les seuls compromis assumés, `'unsafe-inline'` en script et en style (hydratation
 * des frameworks, CSS-in-JS : un nonce rendrait toutes les pages dynamiques) et les images `data:` et `https:`.
 * Tout le reste n'est autorisé qu'ajouté explicitement par `extra`.
 */
export const defaultDirectives = ({ apiOrigin, extra = {} }: DefaultDirectivesOptions = {}) => {
  const directives: Record<Directive, string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'"],
    'style-src': ["'self'", "'unsafe-inline'"],
    'font-src': ["'self'"],
    'img-src': ["'self'", 'data:', 'https:'],
    'media-src': ["'self'"],
    'connect-src': apiOrigin ? ["'self'", originOf(apiOrigin)] : ["'self'"],
    'frame-src': ["'self'"],
    'worker-src': ["'self'", 'blob:'],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'frame-ancestors': ["'self'"],
  }
  for (const [name, sources] of Object.entries(extra) as [Directive, readonly string[]][]) {
    // Une source ajoutée remplace « 'none' », qui ne se combine avec rien
    const current = directives[name].filter((source) => source !== "'none'")
    directives[name] = [...new Set([...current, ...sources])]
  }
  return directives
}

/** Valeur de l'en-tête : une directive par segment, sources dédoublonnées, `report-uri` en dernier. */
export const buildCsp = (directives: Directives, { reportUri }: { reportUri?: string } = {}) =>
  [
    ...Object.entries(directives)
      .filter(([, sources]) => sources && sources.length > 0)
      .map(([name, sources]) => `${name} ${[...new Set(sources)].join(' ')}`),
    ...(reportUri ? [`report-uri ${reportUri}`] : []),
  ].join('; ')

export interface CspReport {
  'blocked-uri'?: string
  'effective-directive'?: string
  'violated-directive'?: string
  'document-uri'?: string
  'source-file'?: string
}

const pathOf = (address: string | undefined) => {
  if (!address) return ''
  try {
    return new URL(address).pathname
  } catch {
    return ''
  }
}

// Origine et chemin seulement : la query string peut porter des données de visiteur
const sourceOf = (address: string | undefined) => {
  if (!address) return ''
  try {
    const { origin, pathname } = new URL(address)
    return origin === 'null' ? '' : `${origin}${pathname}`
  } catch {
    return ''
  }
}

/**
 * Phrase écrite pour un rapport, comme si la ressource avait été bloquée :
 * `[csp-report] https://cdn.exemple.com a besoin d'une autorisation de type script (script-src) — bloqué sur /chemin, chargé par …`
 */
export const formatCspReport = (report: CspReport) => {
  const blocked = report['blocked-uri'] ? originOf(report['blocked-uri']) : 'une ressource'
  const directive = (
    report['effective-directive'] ??
    report['violated-directive']?.split(' ')[0] ??
    ''
  ).replace(/-(elem|attr)$/, '')
  const label = DIRECTIVE_LABELS[directive] ?? directive
  const page = pathOf(report['document-uri'])
  const source = sourceOf(report['source-file'])
  return [
    `[csp-report] ${blocked} a besoin d'une autorisation de type ${label} (${directive})`,
    page ? ` — bloqué sur ${page}` : '',
    source ? `, chargé par ${source}` : '',
  ].join('')
}

export interface CspReportResult {
  status: 204 | 400 | 413
  /** Ligne à écrire sur la sortie standard, pour un rapport valide seulement. */
  line?: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Corps reçu : 413 au-delà de `MAX_REPORT_LENGTH` caractères, 400 pour un JSON invalide ou sans `csp-report`, sinon 204. */
export const handleCspReport = (body: string): CspReportResult => {
  if (body.length > MAX_REPORT_LENGTH) return { status: 413 }
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return { status: 400 }
  }
  const report = isRecord(parsed) ? parsed['csp-report'] : undefined
  if (!isRecord(report)) return { status: 400 }
  return { status: 204, line: formatCspReport(report as CspReport) }
}

// Lecture bornée : on s'arrête dès que la limite est dépassée, même sans Content-Length (envoi par morceaux)
const readBounded = async (request: Request) => {
  if (Number(request.headers.get('content-length') ?? 0) > MAX_REPORT_LENGTH * 4) return null
  if (!request.body) return ''
  const reader = request.body.getReader()
  const decoder = new TextDecoder()
  let text = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) return text + decoder.decode()
    text += decoder.decode(value, { stream: true })
    if (text.length > MAX_REPORT_LENGTH) {
      await reader.cancel()
      return null
    }
  }
}

export interface CspReportRouteOptions {
  /** Où écrire la ligne : `console.info` (sortie standard) par défaut. */
  log?: (line: string) => void
}

/** Route `POST /api/csp-report` au format `Request` → `Response`, à brancher telle quelle dans le framework du site. */
export const cspReportRoute =
  ({ log = (line) => console.info(line) }: CspReportRouteOptions = {}) =>
  async (request: Request) => {
    const body = await readBounded(request)
    const result: CspReportResult = body === null ? { status: 413 } : handleCspReport(body)
    if (result.line) log(result.line)
    return new Response(null, { status: result.status })
  }

/** Ligne écrite au démarrage du serveur, pour retrouver le bon fichier de log chez l'hébergeur. */
export const startupLine = (app: string, environment: string) =>
  `[${app}] serveur démarré (${environment})`
