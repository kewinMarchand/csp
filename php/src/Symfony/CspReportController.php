<?php

declare(strict_types=1);

namespace Kewinmarchand\Csp\Symfony;

use Kewinmarchand\Csp\Csp;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Route POST /api/csp-report : 413 sur un corps trop long (dès l'en-tête Content-Length annoncé), 400 sur un rapport invalide,
 * sinon 204 et une ligne sur la sortie standard. La route est déclarée par l'application (voir le README).
 */
final readonly class CspReportController
{
    /** @var \Closure(string): void */
    private \Closure $log;

    /** @param (callable(string): void)|null $log où écrire la ligne : la sortie standard par défaut */
    public function __construct(?callable $log = null)
    {
        $this->log = null !== $log
            ? $log(...)
            : static function (string $line): void { file_put_contents('php://stdout', $line.\PHP_EOL); };
    }

    public function __invoke(Request $request): Response
    {
        // Un caractère UTF-8 fait au plus 4 octets : au-delà, inutile de lire le corps
        if ((int) $request->headers->get('Content-Length', '0') > Csp::MAX_REPORT_LENGTH * 4) {
            return new Response(null, Response::HTTP_REQUEST_ENTITY_TOO_LARGE);
        }
        $result = Csp::handleReport($request->getContent());
        if (null !== $result['line']) {
            ($this->log)($result['line']);
        }

        return new Response(null, $result['status']);
    }
}
