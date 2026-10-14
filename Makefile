.DEFAULT_GOAL := help
UID := $(shell id -u)
GID := $(shell id -g)
export UID GID
RUN := docker compose run --rm node
PHP := docker compose run --rm php

help: ## Affiche cette aide
	@grep -hE '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

install: ## Construit les images (Node, PHP), installe les dépendances et branche le hook git
	docker compose build
	$(RUN) yarn install --frozen-lockfile
	$(PHP) composer install --no-interaction
	git config core.hooksPath .githooks

build: ## Compile src/ vers dist/ (JavaScript et déclarations de types, versionnés)
	$(RUN) yarn build

qa: lint format-check typecheck build-check test test-php ## QA : lint, format, types, dist à jour, tests JS et PHP

lint: ## ESLint
	$(RUN) yarn lint

lint-fix: ## ESLint avec correction automatique
	$(RUN) yarn lint:fix

format: ## Prettier (écriture)
	$(RUN) yarn format

format-check: ## Prettier (vérification)
	$(RUN) yarn format:check

typecheck: ## Vérification des types
	$(RUN) yarn typecheck

build-check: ## Échoue si dist/ ne correspond plus à src/
	$(RUN) yarn -s build:check

test: ## Tests du cœur JavaScript (Vitest), sur les cas partagés de tests/cases.json
	$(RUN) yarn test

test-php: ## Tests du paquet PHP (PHPUnit), sur les mêmes cas partagés
	$(PHP) vendor/bin/phpunit

lint-staged: ## Vérifie les fichiers indexés (appelé par le hook pre-commit)
	$(RUN) yarn lint-staged

down: ## Arrête les conteneurs
	docker compose down --remove-orphans

.PHONY: help install build qa lint lint-fix format format-check typecheck build-check test test-php lint-staged down
