/**
 * CSP en mode « Report-Only » : l'en-tête, la phrase écrite pour chaque rapport et la route qui les reçoit.
 * Sans dépendance ni framework : tout site qui parle `Request` et `Response` (Next, SvelteKit, Nuxt, Hono…) branche la route
 * en une ligne. L'équivalent PHP vit dans `php/`, vérifié par les mêmes cas (`tests/cases.json`).
 */
export declare const CSP_HEADER = "Content-Security-Policy-Report-Only";
export declare const CSP_REPORT_PATH = "/api/csp-report";
/** Taille maximale d'un rapport, en caractères : au-delà, la route répond 413 sans le lire. */
export declare const MAX_REPORT_LENGTH = 10000;
export type Directive = 'default-src' | 'script-src' | 'style-src' | 'font-src' | 'img-src' | 'media-src' | 'connect-src' | 'frame-src' | 'worker-src' | 'object-src' | 'base-uri' | 'frame-ancestors';
export type Directives = Partial<Record<Directive, readonly string[]>>;
/** Libellé lisible de chaque directive, dans la phrase du rapport. */
export declare const DIRECTIVE_LABELS: Readonly<Record<string, string>>;
export interface DefaultDirectivesOptions {
    /** Adresse de l'API appelée par le navigateur : seule son origine est autorisée en `connect-src`. */
    apiOrigin?: string | undefined;
    /** Origines à ajouter, directive par directive, à celles par défaut. */
    extra?: Directives;
}
/**
 * Directives de départ : le site lui-même, et les seuls compromis assumés, `'unsafe-inline'` en script et en style (hydratation
 * des frameworks, CSS-in-JS : un nonce rendrait toutes les pages dynamiques) et les images `data:` et `https:`.
 * Tout le reste n'est autorisé qu'ajouté explicitement par `extra`.
 */
export declare const defaultDirectives: ({ apiOrigin, extra }?: DefaultDirectivesOptions) => Record<Directive, string[]>;
/** Valeur de l'en-tête : une directive par segment, sources dédoublonnées, `report-uri` en dernier. */
export declare const buildCsp: (directives: Directives, { reportUri }?: {
    reportUri?: string;
}) => string;
export interface CspReport {
    'blocked-uri'?: string;
    'effective-directive'?: string;
    'violated-directive'?: string;
    'document-uri'?: string;
    'source-file'?: string;
}
/**
 * Phrase écrite pour un rapport, comme si la ressource avait été bloquée :
 * `[csp-report] https://cdn.exemple.com a besoin d'une autorisation de type script (script-src) — bloqué sur /chemin, chargé par …`
 */
export declare const formatCspReport: (report: CspReport) => string;
export interface CspReportResult {
    status: 204 | 400 | 413;
    /** Ligne à écrire sur la sortie standard, pour un rapport valide seulement. */
    line?: string;
}
/** Corps reçu : 413 au-delà de `MAX_REPORT_LENGTH` caractères, 400 pour un JSON invalide ou sans `csp-report`, sinon 204. */
export declare const handleCspReport: (body: string) => CspReportResult;
export interface CspReportRouteOptions {
    /** Où écrire la ligne : `console.info` (sortie standard) par défaut. */
    log?: (line: string) => void;
}
/** Route `POST /api/csp-report` au format `Request` → `Response`, à brancher telle quelle dans le framework du site. */
export declare const cspReportRoute: ({ log }?: CspReportRouteOptions) => (request: Request) => Promise<Response>;
/** Ligne écrite au démarrage du serveur, pour retrouver le bon fichier de log chez l'hébergeur. */
export declare const startupLine: (app: string, environment: string) => string;
