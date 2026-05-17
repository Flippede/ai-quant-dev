# AI Quant Watch

私有部署的 AI 量化盯盘平台，面向多用户自选池、策略配置、历史回测、实时策略信号和 AI 辅助解释。

## Features

- 多用户登录、管理员用户管理、私有数据隔离
- 自选池与真实行情展示
- 策略中心：内置策略模板、用户策略配置、参数 schema
- 回测中心：Mock 数据源与 AKShare 真实历史日线数据源
- 实时盯盘：AKShare 行情 Provider、交易时段调度、策略扫描、信号落库
- AI 能力：策略设计助手、策略配置解释、回测解读、实时信号解释、Dashboard 摘要
- 运维基础：生产 compose、scheduler 单独服务、日志、备份脚本、生产检查清单

## Repository

```text
backend/               FastAPI, SQLAlchemy 2.x, Alembic
frontend/              Next.js App Router, TypeScript, Tailwind CSS
docs/                  Architecture and operations docs
scripts/               Operational scripts
docker-compose.yml     Development compose
docker-compose.prod.yml Production compose
.env.example           Development env template
.env.production.example Production env template
```

## Development Startup

```bash
cp .env.example .env
docker compose up -d --build
docker compose exec backend alembic upgrade head
```

Default development ports:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

This server currently uses host ports `13000` and `18000` through local `.env` overrides.

## Production Startup

```bash
cp .env.production.example .env.production
# edit .env.production before launch
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.production exec backend alembic upgrade head
```

Production design:

- `backend` runs API only with `RUN_SCHEDULER_IN_API=false`.
- `scheduler` is the single monitoring worker.
- `frontend` builds and serves Next.js in production mode.
- PostgreSQL and Redis use named volumes and are not published to the host.
- Frontend and backend bind to `127.0.0.1` for Nginx reverse proxy.

## Required Production Configuration

At minimum, review and set:

- `APP_ENV=production`
- `PUBLIC_BASE_URL`
- `BACKEND_CORS_ORIGINS`
- `TRUSTED_HOSTS`
- `SESSION_COOKIE_SECURE=true`
- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `REDIS_URL`
- `MARKET_DATA_PROVIDER=akshare`
- `AI_PROVIDER=openai_compatible`
- `AI_BASE_URL`
- `AI_API_KEY`
- `AI_MODEL`

Never commit real passwords or API keys.

## Database Migration

```bash
docker compose exec backend alembic upgrade head
docker compose exec backend alembic current
```

Production:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec backend alembic upgrade head
```

## Administrator Bootstrap

Create the first administrator after migrations:

```bash
docker compose exec backend python -m app.scripts.create_admin --username admin
```

Non-interactive:

```bash
docker compose exec backend python -m app.scripts.create_admin --username admin --password '<strong-password>'
```

Change the bootstrap password before production exposure.

## AI Provider

Default development uses `MockAIProvider`. Production can use an OpenAI-compatible chat completions endpoint:

```env
AI_PROVIDER=openai_compatible
AI_BASE_URL=https://your-provider.example/v1
AI_API_KEY=your-key
AI_MODEL=your-model
AI_TIMEOUT_SECONDS=30
AI_MAX_OUTPUT_TOKENS=1200
```

The app calls `POST {AI_BASE_URL}/chat/completions`. API keys are not logged.

## GitHub Pull Deployment

```bash
cd /www/wwwroot/ai-quant-dev
git fetch origin
git checkout main
git pull --ff-only origin main
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.production exec backend alembic upgrade head
```

## Health Checks

```bash
curl http://127.0.0.1:18000/health
curl http://127.0.0.1:18000/health/db
```

Through production HTTPS:

```bash
curl https://quant.example.com/health
curl https://quant.example.com/health/db
```

## Common Operations

Logs:

```bash
docker compose logs --tail=200 backend
docker compose logs --tail=200 scheduler
docker compose logs -f backend
```

Backup:

```bash
BACKUP_DIR=/www/backups/ai-quant ./scripts/backup_postgres.sh
```

Build verification:

```bash
docker compose build
docker compose up -d
docker compose exec backend python -m compileall app
cd frontend && npm run build
```

See:

- [docs/operations.md](docs/operations.md)
- [docs/production-checklist.md](docs/production-checklist.md)
- [docs/architecture-constraints.md](docs/architecture-constraints.md)
