# Penny

*Your AI money buddy.* Track expenses, plan monthly budgets, manage recurring payments, see
savings and analytics, and get AI budget suggestions (in ₹).

| Folder      | Stack                                                                        |
| ----------- | ---------------------------------------------------------------------------- |
| `backend/`  | FastAPI, SQLAlchemy 2, Alembic, PostgreSQL, Clerk JWT auth, Google Gemini     |
| `frontend/` | Next.js 16, TypeScript, Tailwind v4, shadcn/ui, TanStack Query, Recharts      |

The backend is a REST API under `/api/v1` (docs at `/docs`), ready for a future mobile app.

## Prerequisites

- Python 3.11+, Node.js 20+, PostgreSQL
- A [Clerk](https://dashboard.clerk.com) app (auth)
- Optional: a free [Gemini API key](https://aistudio.google.com/apikey). Without it, budget
  suggestions use the built-in rule-based planner.

## Setup

```bash
psql -U postgres -c "CREATE DATABASE expense_tracker;"
```

**Backend**

```bash
cd backend
python -m venv .venv
.venv/Scripts/pip install -r requirements-dev.txt      # macOS/Linux: .venv/bin/pip
cp .env.example .env                                    # fill in DATABASE_URL, CLERK_ISSUER, GEMINI_API_KEY
.venv/Scripts/alembic upgrade head
.venv/Scripts/uvicorn app.main:app --reload --port 8000
```

**Frontend** (in a second terminal)

```bash
cd frontend
npm install
cp .env.example .env.local                              # fill in the two Clerk keys
npm run dev                                             # http://localhost:3000
```

`CLERK_ISSUER` (backend) must be the Frontend API URL of the same Clerk app whose keys are in
`frontend/.env.local`.

## Tests

```bash
cd backend
.venv/Scripts/python -m pytest -q
```

Uses a temporary SQLite database by default. To run against PostgreSQL, set `TEST_DATABASE_URL`
in `backend/.env` to a **separate, disposable** database (its tables are dropped; the tests
refuse to run if it equals `DATABASE_URL`).

## Deploy

One reasonable setup: **Neon** (PostgreSQL), **Render** or **Railway** (backend), **Vercel**
(frontend), and a Clerk **production** instance.

1. **Database:** create a PostgreSQL database; use its URL as
   `DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST/DB?sslmode=require`.
2. **Backend** (root directory `backend`):
   - Build: `pip install -r requirements.txt`
   - Start: `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - Env: everything in `backend/.env.example`, with `CORS_ORIGINS` and
     `CLERK_AUTHORIZED_PARTIES` set to your frontend URL and `ENVIRONMENT=production`.
3. **Frontend** (root directory `frontend`): set the Clerk keys, `NEXT_PUBLIC_API_URL` (your
   backend URL), `NEXT_PUBLIC_CURRENCY` and `NEXT_PUBLIC_LOCALE`; deploy.
4. In Clerk, add the frontend domain, and set the backend's `CLERK_ISSUER` to the production
   instance's Frontend API URL.

## Troubleshooting

- **Port 8000 in use / `WinError 10013`:** another server is running. Stop it or use
  `--port 8001` and update `NEXT_PUBLIC_API_URL`.
- **Windows "Application Control policy has blocked this file" (SQLAlchemy):** reinstall
  SQLAlchemy without compiled extensions:
  `DISABLE_SQLALCHEMY_CEXT=1 .venv/Scripts/python -m pip install --force-reinstall --no-deps --no-binary sqlalchemy SQLAlchemy==2.1.5`
- **AI shows "Rule-based suggestion":** the key is missing, the free tier is rate-limited, or
  Gemini timed out. The reason is shown in the dialog. Restart the backend after editing `.env`.
