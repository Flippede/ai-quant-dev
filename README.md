# AI Quant Watch

私有部署的 AI 量化盯盘平台。当前仓库处于 Phase 1：项目骨架、基础服务、数据库迁移框架、最小前端页面和健康检查。

## Current Structure

```text
.
├── backend/              # FastAPI, SQLAlchemy 2.x, Alembic
├── frontend/             # Next.js App Router, TypeScript, Tailwind CSS
├── docs/                 # Architecture notes and project constraints
├── infra/                # Reserved for deployment and ops files
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env.example
└── .gitignore
```

## Phase 1 Scope

已完成的基础边界：

- Docker Compose services: `frontend`, `backend`, `postgres`, `redis`
- FastAPI app with `/health` and `/health/db`
- SQLAlchemy 2.x database setup
- Alembic migration structure
- Initial model baseline with key unique constraints and indexes
- Next.js minimal responsive shell page
- Mock-only market data provider boundary
- `Asia/Shanghai` market-time helper
- Git ignore rules and repository initialization support

Phase 1 不包含登录系统、用户管理接口、策略 CRUD、回测执行、实时盯盘任务。

## Environment

Prerequisites:

- Docker Compose for the recommended server/dev startup path
- Node.js 22+ for local frontend development
- Python 3.12 for local backend development

Create local environment file:

```bash
cp .env.example .env
```

Important defaults:

- Backend: `http://localhost:8000`
- Frontend: `http://localhost:3000`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- Market timezone: `Asia/Shanghai`

## Start With Docker Compose

```bash
docker compose up --build
```

Open:

- Frontend: `http://localhost:3000`
- Backend health: `http://localhost:8000/health`
- Backend DB health: `http://localhost:8000/health/db`

Run Alembic migrations from the backend container:

```bash
docker compose exec backend alembic upgrade head
```

## Local Backend Development

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Use a reachable PostgreSQL database and set `DATABASE_URL` in `.env`.

## Local Frontend Development

```bash
cd frontend
npm install
npm run dev
```

## Phase 1 Verification

1. Copy `.env.example` to `.env`.
2. Run `docker compose up --build`.
3. Visit `http://localhost:3000`.
4. Visit `http://localhost:8000/health`.
5. Run `docker compose exec backend alembic upgrade head`.
6. Visit `http://localhost:8000/health/db`.

Expected `/health` response includes:

- `status: ok`
- `market_timezone: Asia/Shanghai`
- UTC and market-time timestamps

## Git

This project is initialized as a local Git repository in Phase 1.

Suggested phase workflow:

```bash
git status
git add .
git commit -m "Phase 1: initialize project skeleton"
```

To bind a GitHub remote later:

```bash
git remote add origin git@github.com:<your-org-or-user>/<your-repo>.git
git branch -M main
git push -u origin main
```

Each phase should produce a focused commit, for example:

```bash
git commit -m "Phase 2: add session authentication"
```

## Notes

- `market_snapshots` is designed as a latest-snapshot table, not an unlimited append-only tick store.
- `intraday_bars` is for aggregated minute-level bars.
- QuantStats is intentionally not introduced before Phase 5.
- Real Tushare / AkShare providers are reserved for later phases; Phase 1 uses `MockMarketDataProvider` only.
