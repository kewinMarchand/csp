<?php

declare(strict_types=1);

namespace Kewinmarchand\Csp\Tests;

use Kewinmarchand\Csp\Csp;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/** Mêmes cas que les tests JavaScript : les deux implémentations écrivent exactement les mêmes en-têtes et les mêmes phrases. */
final class CspTest extends TestCase
{
    /** @return array<string, mixed> */
    private static function cases(): array
    {
        return json_decode((string) file_get_contents(__DIR__.'/../../tests/cases.json'), true, 512, \JSON_THROW_ON_ERROR);
    }

    /** @return iterable<string, array{?string, array<string, list<string>>, ?string, string}> */
    public static function headerCases(): iterable
    {
        foreach (self::cases()['header'] as $case) {
            yield $case['name'] => [$case['apiOrigin'], $case['extra'], $case['reportUri'], $case['expected']];
        }
    }

    /** @return iterable<string, array{string, int, ?string}> */
    public static function reportCases(): iterable
    {
        foreach (self::cases()['reports'] as $case) {
            yield $case['name'] => [$case['body'], $case['status'], $case['line']];
        }
    }

    /** @param array<string, list<string>> $extra */
    #[DataProvider('headerCases')]
    public function testHeader(?string $apiOrigin, array $extra, ?string $reportUri, string $expected): void
    {
        self::assertSame($expected, Csp::build(Csp::defaultDirectives($apiOrigin, $extra), $reportUri));
    }

    #[DataProvider('reportCases')]
    public function testReport(string $body, int $status, ?string $line): void
    {
        self::assertSame(['status' => $status, 'line' => $line], Csp::handleReport($body));
    }

    public function testLimiteDeTaille(): void
    {
        $shell = '{"csp-report":{"blocked-uri":""}}';
        $body = static fn (int $length): string => str_replace('""', '"'.str_repeat('a', $length - \strlen($shell)).'"', $shell);

        self::assertSame(204, Csp::handleReport($body(Csp::MAX_REPORT_LENGTH))['status']);
        self::assertSame(['status' => 413, 'line' => null], Csp::handleReport($body(Csp::MAX_REPORT_LENGTH + 1)));
    }

    public function testLigneDeDemarrage(): void
    {
        self::assertSame('[boutique] serveur démarré (production)', Csp::startupLine('boutique', 'production'));
    }
}
