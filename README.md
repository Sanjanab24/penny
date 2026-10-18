# AI Expense Tracker

Monorepo for a personal-finance web app. The backend is a versioned REST API (`/api/v1`) so an
Android client can be added later.

| Folder      | Stack                                                                                 |
| ----------- | ------------------------------------------------------------------------------------- |
| `backend/`  | FastAPI, Pydantic v2, SQLAlchemy 2.x, Alembic, PostgreSQL, Clerk JWT verification      |
| `frontend/` | Next.js 16 (App Router), TypeScript, Tailwind v4, shadcn/ui, TanStack Query, Clerk     |

> Full setup and deploy docs come in Phase 7. These are the Phase 1 dev instructions.

## Prerequisites

- Python 3.11+ and Node.js 20+
- PostgreSQL running locally
- A Clerk application (free): https://dashboard.clerk.com

## 1. Database

```bash
psql -U postgres -c "CREATE DATABASE expense_tracker;"
psql -U postgres -c "CREATE DATABASE expense_tracker_test;"   # optional, for pytest
```

## 2. Backend

```bash
cd backend
python -m venv .venv
.venv/Scripts/pip install -r requirements-dev.txt     # macOS/Linux: .venv/bin/pip
cp .env.example .env                                   # then fill in DATABASE_URL and CLERK_ISSUER
.venv/Scripts/alembic upgrade head                     # creates tables + seeds default categories
.venv/Scripts/uvicorn app.main:app --reload --port 8000
```

- API docs: http://localhost:8000/docs
- Health: `GET /api/v1/health` (public)
- Protected test endpoint: `GET /api/v1/me` (needs `Authorization: Bearer <Clerk token>`)

`CLERK_ISSUER` is the **Frontend API URL** in Clerk Dashboard -> API Keys
(e.g. `https://your-app.clerk.accounts.dev`). The JWKS URL is derived from it.

### Tests

```bash
cd backend
.venv/Scripts/pytest                 # uses a temp SQLite DB
TEST_DATABASE_URL=postgresql+psycopg://postgres:PASSWORD@localhost:5432/expense_tracker_test .venv/Scripts/pytest
```

The Postgres test run drops and re-creates the schema in that database, so never point it at
real data.

## 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local           # then paste the Clerk publishable + secret keys
npm run dev                          # http://localhost:3000
```

Sign in, then open `/dashboard`: it calls `/health` and the protected `/me` endpoint through
FastAPI, which proves Clerk -> Next.js -> FastAPI -> Postgres is wired end to end.
