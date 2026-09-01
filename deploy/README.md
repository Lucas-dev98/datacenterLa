# Staging deploy

Stack Docker Compose para ambiente de homologação/staging local ou VM.

## Pré-requisitos

- Docker + Docker Compose v2
- Copiar `.env.staging.example` → `.env.staging` e ajustar segredos

## Subir staging

```bash
docker compose -f docker-compose.yml -f docker-compose.staging.yml --env-file .env.staging up -d --build
```

## Health checks

| Endpoint | Uso |
|----------|-----|
| `GET /health/live` | Liveness — processo responde |
| `GET /health/ready` | Readiness — Postgres acessível |
| `GET /health` | Alias de readiness (compatível com compose atual) |

```bash
curl -sf http://localhost:8080/health/ready | jq .
curl -sf http://localhost:8080/health/live | jq .
```

## Seed (primeira vez)

```bash
docker compose -f docker-compose.yml -f docker-compose.staging.yml run --rm seed
```

## Parar

```bash
docker compose -f docker-compose.yml -f docker-compose.staging.yml down
```
