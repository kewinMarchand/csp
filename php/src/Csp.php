<?php

declare(strict_types=1);

namespace Kewinmarchand\Csp;

/**
 * CSP en mode « Report-Only » : l'en-tête, la phrase écrite pour chaque rapport et le traitement du corps reçu.
 * Traduction exacte du cœur JavaScript (src/index.ts), vérifiée par les mêmes cas (tests/cases.json).
 */
final class Csp
{
    public const string HEADER = 'Content-Security-Policy-Report-Only';
    public const string REPORT_PATH = '/api/csp-report';
    /** Taille maximale d'un rapport, en caractères : au-delà, la route répond 413. */
    public const int MAX_REPORT_LENGTH = 10000;

    /** Libellé lisible de chaque directive, dans la phrase du rapport. */
    public const array LABELS = [
        'script-src' => 'script',
        'style-src' => 'feuille de style',
        'connect-src' => 'appel réseau',
        'frame-src' => 'iframe',
        'img-src' => 'image',
        'font-src' => 'police',
        'media-src' => 'média',
        'worker-src' => 'worker',
        'object-src' => 'objet embarqué',
        'frame-ancestors' => 'affichage du site en iframe',
        'base-uri' => 'balise base',
    ];

    private const array DEFAULT_PORTS = ['http' => 80, 'https' => 443];

    /**
     * Directives de départ : le site lui-même, et les seuls compromis assumés, 'unsafe-inline' en script et en style et les
     * images data: et https:. Tout le reste n'est autorisé qu'ajouté explicitement par $extra.
     *
     * @param array<string, list<string>> $extra origines à ajouter, directive par directive
     *
     * @return array<string, list<string>>
     */
    public static function defaultDirectives(?string $apiOrigin = null, array $extra = []): array
    {
        $directives = [
            'default-src' => ["'self'"],
            'script-src' => ["'self'", "'unsafe-inline'"],
            'style-src' => ["'self'", "'unsafe-inline'"],
            'font-src' => ["'self'"],
            'img-src' => ["'self'", 'data:', 'https:'],
            'media-src' => ["'self'"],
            'connect-src' => null !== $apiOrigin ? ["'self'", self::originOf($apiOrigin)] : ["'self'"],
            'frame-src' => ["'self'"],
            'worker-src' => ["'self'", 'blob:'],
            'object-src' => ["'none'"],
            'base-uri' => ["'self'"],
            'frame-ancestors' => ["'self'"],
        ];
        foreach ($extra as $name => $sources) {
            // Une source ajoutée remplace « 'none' », qui ne se combine avec rien
            $current = array_values(array_filter($directives[$name] ?? [], static fn (string $source): bool => "'none'" !== $source));
            $directives[$name] = array_values(array_unique([...$current, ...$sources]));
        }

        return $directives;
    }

    /**
     * Valeur de l'en-tête : une directive par segment, sources dédoublonnées, report-uri en dernier.
     *
     * @param array<string, list<string>> $directives
     */
    public static function build(array $directives, ?string $reportUri = null): string
    {
        $segments = [];
        foreach ($directives as $name => $sources) {
            if ([] !== $sources) {
                $segments[] = $name.' '.implode(' ', array_unique($sources));
            }
        }
        if (null !== $reportUri) {
            $segments[] = 'report-uri '.$reportUri;
        }

        return implode('; ', $segments);
    }

    /**
     * Phrase écrite pour un rapport, comme si la ressource avait été bloquée.
     *
     * @param array<string, mixed> $report contenu de « csp-report »
     */
    public static function formatReport(array $report): string
    {
        $blockedUri = self::text($report['blocked-uri'] ?? null);
        $blocked = '' !== $blockedUri ? self::originOf($blockedUri) : 'une ressource';
        $violated = self::text($report['violated-directive'] ?? null);
        // Comme « ?? » en JavaScript : violated-directive seulement si effective-directive est absente ou nulle
        $directive = isset($report['effective-directive'])
            ? self::text($report['effective-directive'])
            : explode(' ', $violated)[0];
        $directive = (string) preg_replace('/-(elem|attr)$/', '', $directive);
        $label = self::LABELS[$directive] ?? $directive;
        $page = self::url(self::text($report['document-uri'] ?? null));
        $source = self::url(self::text($report['source-file'] ?? null));

        return "[csp-report] {$blocked} a besoin d'une autorisation de type {$label} ({$directive})"
            .(null !== $page ? ' — bloqué sur '.$page['path'] : '')
            .(null !== $source ? ', chargé par '.$source['origin'].$source['path'] : '');
    }

    /**
     * Corps reçu : 413 au-delà de MAX_REPORT_LENGTH caractères, 400 pour un JSON invalide ou sans « csp-report », sinon 204 et
     * la ligne à écrire.
     *
     * @return array{status: 204|400|413, line: ?string}
     */
    public static function handleReport(string $body): array
    {
        if (mb_strlen($body, 'UTF-8') > self::MAX_REPORT_LENGTH) {
            return ['status' => 413, 'line' => null];
        }
        try {
            // En objets : décodé en tableaux, « {} » deviendrait « [] » et ne se distinguerait plus d'une liste
            $parsed = json_decode($body, false, 512, \JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            return ['status' => 400, 'line' => null];
        }
        $report = $parsed instanceof \stdClass ? ($parsed->{'csp-report'} ?? null) : null;
        if (!$report instanceof \stdClass) {
            return ['status' => 400, 'line' => null];
        }

        return ['status' => 204, 'line' => self::formatReport((array) $report)];
    }

    /** Ligne écrite au démarrage du serveur, pour retrouver le bon fichier de log chez l'hébergeur. */
    public static function startupLine(string $app, string $environment): string
    {
        return "[{$app}] serveur démarré ({$environment})";
    }

    private static function text(mixed $value): string
    {
        return \is_string($value) ? $value : '';
    }

    /**
     * Origine et chemin d'une adresse absolue (comme URL.origin et URL.pathname en JavaScript), jamais la query string,
     * qui peut porter des données de visiteur. Null pour ce qui n'est pas une adresse avec un hôte.
     *
     * @return array{origin: string, path: string}|null
     */
    private static function url(string $address): ?array
    {
        $parts = '' !== $address ? parse_url($address) : false;
        if (false === $parts || !isset($parts['scheme'], $parts['host'])) {
            return null;
        }
        $scheme = strtolower($parts['scheme']);
        $port = isset($parts['port']) && $parts['port'] !== (self::DEFAULT_PORTS[$scheme] ?? null) ? ':'.$parts['port'] : '';

        return ['origin' => $scheme.'://'.strtolower($parts['host']).$port, 'path' => $parts['path'] ?? '/'];
    }

    private static function originOf(string $address): string
    {
        return self::url($address)['origin'] ?? $address;
    }
}
