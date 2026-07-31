# Acme Links — the boot recipe the tutorial (and certification) runs against.

.PHONY: install db-up db-push dev build start journeys

install:
	npm install

## Local dev Postgres on 5433 (isolated from any system Postgres on 5432)
db-up:
	docker run -d --name acme-postgres \
	  -e POSTGRES_USER=acme -e POSTGRES_PASSWORD=acme -e POSTGRES_DB=acme \
	  -p 5433:5432 postgres:16

db-push:
	npm run db:push

dev:
	npm run dev

build:
	npm run build

start:
	npm run start

## The contract journeys — drive the running app at the seams the contracts name
journeys:
	npm run journeys
