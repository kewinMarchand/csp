<?php

declare(strict_types=1);

namespace Kewinmarchand\Csp\Tests\Symfony;

use Kewinmarchand\Csp\Csp;
use Kewinmarchand\Csp\Symfony\CspReportController;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpFoundation\Request;

final class CspReportControllerTest extends TestCase
{
    /** @var list<string> */
    private array $lines = [];

    private function post(string $body, array $server = []): int
    {
        $controller = new CspReportController(function (string $line): void { $this->lines[] = $line; });

        return $controller(Request::create(Csp::REPORT_PATH, 'POST', server: $server, content: $body))->getStatusCode();
    }

    public function testRepond204EtEcritLaLigne(): void
    {
        $body = '{"csp-report":{"blocked-uri":"eval","effective-directive":"script-src","document-uri":"https://site.exemple.fr/"}}';

        self::assertSame(204, $this->post($body));
        self::assertSame(["[csp-report] eval a besoin d'une autorisation de type script (script-src) — bloqué sur /"], $this->lines);
    }

    public function testRepond400SansRienEcrire(): void
    {
        self::assertSame(400, $this->post('pas du JSON'));
        self::assertSame([], $this->lines);
    }

    public function testRepond413SurUnCorpsTropLong(): void
    {
        self::assertSame(413, $this->post(str_repeat('a', Csp::MAX_REPORT_LENGTH + 1)));
    }

    public function testRepond413SurUnContentLengthAnnonceTropGrand(): void
    {
        self::assertSame(413, $this->post('{}', ['CONTENT_LENGTH' => (string) (Csp::MAX_REPORT_LENGTH * 10)]));
        self::assertSame([], $this->lines);
    }
}
