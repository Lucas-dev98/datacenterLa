.PHONY: up down run run-mailpit send-test test seed tidy test-integration

up:
	docker compose up -d

down:
	docker compose down

run:
	go run ./cmd/server

# Dev: envia e-mails para o Mailpit (http://localhost:8025) em vez da caixa real
run-mailpit:
	SMTP_HOST=localhost SMTP_PORT=1025 SMTP_FROM=noreply@datacenterla.local SMTP_USER= SMTP_PASSWORD= go run ./cmd/server

send-test:
	go run ./cmd/send-test

seed:
	go run ./cmd/seed

seed-if-empty:
	go run ./cmd/seed -if-empty

test:
	go test ./... -count=1

test-integration:
	docker compose down -v
	docker compose up -d
	@sleep 3
	go run ./cmd/seed
	DATABASE_URL=postgres://datacenterla:datacenterla@localhost:5434/datacenterla?sslmode=disable \
		go test ./... -tags=integration -count=1

tidy:
	go mod tidy
