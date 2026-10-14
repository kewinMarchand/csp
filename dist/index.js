/**
 * CSP en mode « Report-Only » : l'en-tête, la phrase écrite pour chaque rapport et la route qui les reçoit.
 * Sans dépendance ni framework : tout site qui parle `Request` et `Response` (Next, SvelteKit, Nuxt, Hono…) branche la route
 * en une ligne. L'équivalent PHP vit dans `php/`, vérifié par les mêmes cas (`tests/cases.json`).
 */
export const CSP_HEADER = 'Content-Security-Policy-Report-Only';
export const CSP_REPORT_PATH = '/api/csp-report';
/** Taille maximale d'un rapport, en caractères : au-delà, la route répond 413 sans le lire. */
export const MAX_REPORT_LENGTH = 10_000;
/** Libellé lisible de chaque directive, dans la phrase du rapport. */
export const DIRECTIVE_LABELS = {
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
};
const originOf = (address) => {
    try {
        const { origin } = new URL(address);
        return origin === 'null' ? address : origin;
    }
    catch {
        return address;
    }
};
/**
 * Directives de départ : le site lui-même, et les seuls compromis assumés, `'unsafe-inline'` en script et en style (hydratation
 * des frameworks, CSS-in-JS : un nonce rendrait toutes les pages dynamiques) et les images `data:` et `https:`.
 * Tout le reste n'est autorisé qu'ajouté explicitement par `extra`.
 */
export const defaultDirectives = ({ apiOrigin, extra = {} } = {}) => {
    const directives = {
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
    };
    for (const [name, sources] of Object.entries(extra)) {
        // Une source ajoutée remplace « 'none' », qui ne se combine avec rien
        const current = directives[name].filter((source) => source !== "'none'");
        directives[name] = [...new Set([...current, ...sources])];
    }
    return directives;
};
/** Valeur de l'en-tête : une directive par segment, sources dédoublonnées, `report-uri` en dernier. */
export const buildCsp = (directives, { reportUri } = {}) => [
    ...Object.entries(directives)
        .filter(([, sources]) => sources && sources.length > 0)
        .map(([name, sources]) => `${name} ${[...new Set(sources)].join(' ')}`),
    ...(reportUri ? [`report-uri ${reportUri}`] : []),
].join('; ');
const pathOf = (address) => {
    if (!address)
        return '';
    try {
        return new URL(address).pathname;
    }
    catch {
        return '';
    }
};
// Origine et chemin seulement : la query string peut porter des données de visiteur
const sourceOf = (address) => {
    if (!address)
        return '';
    try {
        const { origin, pathname } = new URL(address);
        return origin === 'null' ? '' : `${origin}${pathname}`;
    }
    catch {
        return '';
    }
};
/**
 * Phrase écrite pour un rapport, comme si la ressource avait été bloquée :
 * `[csp-report] https://cdn.exemple.com a besoin d'une autorisation de type script (script-src) — bloqué sur /chemin, chargé par …`
 */
export const formatCspReport = (report) => {
    const blocked = report['blocked-uri'] ? originOf(report['blocked-uri']) : 'une ressource';
    const directive = (report['effective-directive'] ??
        report['violated-directive']?.split(' ')[0] ??
        '').replace(/-(elem|attr)$/, '');
    const label = DIRECTIVE_LABELS[directive] ?? directive;
    const page = pathOf(report['document-uri']);
    const source = sourceOf(report['source-file']);
    return [
        `[csp-report] ${blocked} a besoin d'une autorisation de type ${label} (${directive})`,
        page ? ` — bloqué sur ${page}` : '',
        source ? `, chargé par ${source}` : '',
    ].join('');
};
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
/** Corps reçu : 413 au-delà de `MAX_REPORT_LENGTH` caractères, 400 pour un JSON invalide ou sans `csp-report`, sinon 204. */
export const handleCspReport = (body) => {
    if (body.length > MAX_REPORT_LENGTH)
        return { status: 413 };
    let parsed;
    try {
        parsed = JSON.parse(body);
    }
    catch {
        return { status: 400 };
    }
    const report = isRecord(parsed) ? parsed['csp-report'] : undefined;
    if (!isRecord(report))
        return { status: 400 };
    return { status: 204, line: formatCspReport(report) };
};
// Un caractère UTF-8 fait au plus 4 octets : au-delà de ce volume, le corps est trop long quel que soit son contenu
const MAX_REPORT_BYTES = MAX_REPORT_LENGTH * 4;
// Lecture bornée, même sans Content-Length (envoi par morceaux). Au-delà de la limite, le corps est lu sans être gardé :
// annuler le flux ferait couper la connexion par le serveur avant la réponse 413. Il n'est annulé qu'au-delà de
// MAX_REPORT_BYTES, pour un client qui enverrait sans fin.
const readBounded = async (request) => {
    if (Number(request.headers.get('content-length') ?? 0) > MAX_REPORT_BYTES)
        return null;
    if (!request.body)
        return '';
    const reader = request.body.getReader();
    const decoder = new TextDecoder();
    let text = '';
    let bytes = 0;
    let tooLong = false;
    for (;;) {
        const { done, value } = await reader.read();
        if (done)
            return tooLong ? null : text + decoder.decode();
        bytes += value.byteLength;
        if (bytes > MAX_REPORT_BYTES) {
            await reader.cancel();
            return null;
        }
        if (tooLong)
            continue;
        text += decoder.decode(value, { stream: true });
        if (text.length > MAX_REPORT_LENGTH) {
            tooLong = true;
            text = '';
        }
    }
};
/** Route `POST /api/csp-report` au format `Request` → `Response`, à brancher telle quelle dans le framework du site. */
export const cspReportRoute = ({ log = (line) => console.info(line) } = {}) => async (request) => {
    const body = await readBounded(request);
    const result = body === null ? { status: 413 } : handleCspReport(body);
    if (result.line)
        log(result.line);
    return new Response(null, { status: result.status });
};
/** Ligne écrite au démarrage du serveur, pour retrouver le bon fichier de log chez l'hébergeur. */
export const startupLine = (app, environment) => `[${app}] serveur démarré (${environment})`;
