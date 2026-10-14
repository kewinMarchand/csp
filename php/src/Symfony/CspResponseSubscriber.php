<?php

declare(strict_types=1);

namespace Kewinmarchand\Csp\Symfony;

use Kewinmarchand\Csp\Csp;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\HttpKernel\Event\ResponseEvent;
use Symfony\Component\HttpKernel\KernelEvents;

/**
 * Pose l'en-tête Content-Security-Policy-Report-Only sur chaque réponse principale, sans écraser un en-tête déjà posé.
 * La valeur est construite une fois par Csp::build(), passée au constructeur.
 */
final readonly class CspResponseSubscriber implements EventSubscriberInterface
{
    public function __construct(private string $policy)
    {
    }

    /**
     * Fabrique pour la configuration des services (« factory ») : directives par défaut, origine de l'API, origines ajoutées
     * et route de rapport.
     *
     * @param array<string, list<string>> $extra
     */
    public static function create(?string $apiOrigin = null, array $extra = [], ?string $reportUri = Csp::REPORT_PATH): self
    {
        return new self(Csp::build(Csp::defaultDirectives($apiOrigin, $extra), $reportUri));
    }

    public static function getSubscribedEvents(): array
    {
        return [KernelEvents::RESPONSE => 'onResponse'];
    }

    public function onResponse(ResponseEvent $event): void
    {
        if (!$event->isMainRequest() || $event->getResponse()->headers->has(Csp::HEADER)) {
            return;
        }
        $event->getResponse()->headers->set(Csp::HEADER, $this->policy);
    }
}
