.PHONY: up down build migrate seed logs test

up:
	docker compose up --build

down:
	docker compose down

build:
	docker compose build

migrate:
	docker compose exec backend alembic upgrade head

seed:
	docker compose exec backend python -m app.scripts.seed_admin

logs:
	docker compose logs -f

test:
	docker compose exec backend pytest -v
