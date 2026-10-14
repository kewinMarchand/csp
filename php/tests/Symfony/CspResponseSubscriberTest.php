<?php

declare(strict_types=1);

namespace Kewinmarchand\Csp\Tests\Symfony;

use Kewinmarchand\Csp\Csp;
use Kewinmarchand\Csp\Symfony\CspResponseSubscriber;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Event\ResponseEvent;
use Symfony\Component\HttpKernel\HttpKernelInterface;

final class CspResponseSubscriberTest extends TestCase
{
    private function dispatch(Response $response, int $type = HttpKernelInterface::MAIN_REQUEST): Response
    {
        $event = new ResponseEvent($this->createStub(HttpKernelInterface::class), new Request(), $type, $response);
        new CspResponseSubscriber("default-src 'self'")->onResponse($event);

        return $event->getResponse();
    }

    public function testPoseLEnTeteSurLaReponsePrincipale(): void
    {
        self::assertSame("default-src 'self'", $this->dispatch(new Response())->headers->get(Csp::HEADER));
    }

    public function testFabriqueAvecLesDirectivesParDefaut(): void
    {
        $event = new ResponseEvent($this->createStub(HttpKernelInterface::class), new Request(), HttpKernelInterface::MAIN_REQUEST, new Response());
        CspResponseSubscriber::create('https://api.exemple.com/v1')->onResponse($event);

        self::assertSame(
            Csp::build(Csp::defaultDirectives('https://api.exemple.com/v1'), Csp::REPORT_PATH),
            $event->getResponse()->headers->get(Csp::HEADER),
        );
    }

    public function testIgnoreLesSousRequetes(): void
    {
        self::assertFalse($this->dispatch(new Response(), HttpKernelInterface::SUB_REQUEST)->headers->has(Csp::HEADER));
    }

    public function testNEcrasePasUnEnTeteDejaPose(): void
    {
        $response = new Response(headers: [Csp::HEADER => "default-src 'none'"]);
        self::assertSame("default-src 'none'", $this->dispatch($response)->headers->get(Csp::HEADER));
    }
}
