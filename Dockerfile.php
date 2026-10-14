# Même image que le boilerplate Symfony, Composer copié depuis son image officielle
FROM dunglas/frankenphp:1-php8.4-bookworm

COPY --from=composer/composer:2-bin /composer /usr/bin/composer
RUN apt-get update && apt-get install -y --no-install-recommends git unzip && rm -rf /var/lib/apt/lists/*
WORKDIR /app
