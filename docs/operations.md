# Operations Guide

## Compose Modes

Development:

```bash
cp .env.example .env
docker compose up -d --build
docker compose exec backend alembic upgrade head
```

Production:

```bash
cp .env.production.example .env.production
# edit .env.production before starting
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.production exec backend alembic upgrade head
```

In production, PostgreSQL and Redis are not published to the host. Frontend and backend bind to `127.0.0.1` for Nginx reverse proxying. The API container does not run the scheduler; the `scheduler` service is the single monitoring worker.

## Logs

```bash
docker compose logs --tail=200 backend
docker compose logs --tail=200 frontend
docker compose logs --tail=200 scheduler
docker compose logs -f backend
```

Production logs avoid passwords, session tokens, and AI API keys. Backend responses include `X-Request-ID`; use it to correlate user reports with logs.

## Scheduler Status

Check from an authenticated browser or API client:

```bash
curl -b cookies.txt https://quant.example.com/api/system/monitoring-status
```

The response includes provider name, scheduler running flag, last quote refresh, last strategy scan, latest error, and whether the server thinks it is in the China A-share trading session.

Manual refresh endpoints are admin-only. In production they are disabled by default with `ENABLE_ADMIN_MONITORING_ACTIONS=false`. Temporarily enable them only for controlled smoke tests.

## Provider Troubleshooting

Market provider failures are logged by service and symbol context, while the app keeps the last successful market snapshot where available. For AKShare outages:

1. Check `docker compose logs --tail=200 backend`.
2. Confirm outbound network access from the backend container.
3. Switch to `MARKET_DATA_PROVIDER=mock` only for controlled development fallback, not for production signal claims.

## AI Provider

Set these in `.env.production`:

```env
AI_PROVIDER=openai_compatible
AI_BASE_URL=https://your-provider.example/v1
AI_API_KEY=...
AI_MODEL=...
AI_TIMEOUT_SECONDS=30
AI_MAX_OUTPUT_TOKENS=1200
```

The provider calls `POST {AI_BASE_URL}/chat/completions`. API keys are read from environment variables and are not logged.

Smoke test after configuration:

1. Open `/ai/strategy-advisor` and generate a strategy suggestion.
2. Open an existing `/backtests/[id]` and run AI interpretation.
3. Open `/signals` and run AI explanation for a signal.
4. Confirm `GET /api/ai/conversations` returns the new conversations for that user only.

## Backup

Run a local PostgreSQL backup:

```bash
BACKUP_DIR=/www/backups/ai-quant ./scripts/backup_postgres.sh
```

If your shell user cannot access Docker, prefix the command with `sudo env BACKUP_DIR=...`.

The script creates timestamped custom-format dumps and never overwrites an existing file.

Suggested cron:

```cron
15 2 * * * cd /www/wwwroot/ai-quant-dev && BACKUP_DIR=/www/backups/ai-quant ./scripts/backup_postgres.sh >> /var/log/ai-quant-backup.log 2>&1
```

Retain at least 14 daily backups locally. For production, copy backups to object storage or another server.

## Restore

1. Stop application services that write data:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production stop backend scheduler frontend
```

2. Restore into PostgreSQL:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec -T postgres \
  pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists < /path/to/backup.dump
```

3. Run migrations and restart:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec backend alembic upgrade head
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

## Data Retention

Recommended retention policy:

- `auth_sessions`: delete expired or revoked rows older than 30 days.
- `strategy_signals`: keep 180 days online, archive older rows if needed.
- `notifications`: keep 180 days online.
- `ai_conversations` / `ai_messages`: keep indefinitely for now, add user export/delete before broad rollout.
- `market_snapshots`: latest snapshot table, no growth concern.
- Redis provider caches and rate-limit keys expire automatically.

Implement scheduled cleanup once data volume is known; for now, monitor table sizes monthly.

## Nginx And HTTPS

Recommended single-domain layout:

- `https://quant.example.com/` -> frontend on `127.0.0.1:13000`
- `https://quant.example.com/api/` -> backend on `127.0.0.1:18000`
- `https://quant.example.com/ws/` -> backend WebSocket path when added

Nginx draft:

```nginx
server {
    listen 443 ssl http2;
    server_name quant.example.com;

    ssl_certificate /www/server/panel/vhost/cert/quant.example.com/fullchain.pem;
    ssl_certificate_key /www/server/panel/vhost/cert/quant.example.com/privkey.pem;

    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Request-ID $request_id;

    location /api/ {
        proxy_pass http://127.0.0.1:18000/api/;
        proxy_http_version 1.1;
        proxy_buffering off;
    }

    location = /health {
        proxy_pass http://127.0.0.1:18000/health;
        proxy_http_version 1.1;
    }

    location = /health/db {
        proxy_pass http://127.0.0.1:18000/health/db;
        proxy_http_version 1.1;
    }

    location /ws/ {
        proxy_pass http://127.0.0.1:18000/ws/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600s;
    }

    location / {
        proxy_pass http://127.0.0.1:13000/;
        proxy_http_version 1.1;
    }
}

server {
    listen 80;
    server_name quant.example.com;
    return 301 https://$host$request_uri;
}
```

Do not cache `/api/` responses at Nginx. Static Next.js assets may use normal browser caching. With HTTPS enabled, keep `SESSION_COOKIE_SECURE=true` and SameSite=Lax.

## Domain Checklist

1. DNS A record points to the server.
2. `.env.production` uses the final domain in CORS and trusted hosts.
3. Nginx HTTPS certificate is valid.
4. `/health` and `/health/db` pass through Nginx.
5. Login sets Secure HttpOnly cookie.
6. AI provider smoke test completed.
