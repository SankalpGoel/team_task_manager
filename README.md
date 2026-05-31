<div align="center">

# Team Task Manager

**A multi-tenant, role-based task-management SaaS — Kanban boards, real-time collaboration, AI assistance, and analytics in one fast workspace.**

[![Live Demo](https://img.shields.io/badge/▶_Live_Demo-Open_App-22c55e?style=for-the-badge)](https://team-task-manager-ten-opal.vercel.app)

![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React_18-20232A?logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?logo=redis&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-06B6D4?logo=tailwindcss&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue)

**🔗 [team-task-manager-ten-opal.vercel.app](https://team-task-manager-ten-opal.vercel.app)**

</div>

---

Team Task Manager is a full-stack SaaS application where teams organize work on drag-and-drop Kanban
boards, collaborate in real time, and lean on AI to draft tasks and summarize projects. Every team
gets an isolated workspace with role-based permissions, and the whole thing is built on an async
FastAPI backend and a modern React + TypeScript frontend.

## ✨ Features

**Boards & tasks**
- Drag-and-drop Kanban board with optimistic updates and fractional ordering
- Rich task drawer: status, priority, assignee, due date, subtask checklist, and labels
- Threaded comments with `@mention` autocomplete
- Color-coded labels and a global search command palette (`Ctrl/Cmd + K`)

**Collaboration & real time**
- Live updates over WebSockets (Redis pub/sub) — teammates see changes without refreshing
- In-app notification bell + email notifications for mentions and invites
- Activity feed of everything happening in the workspace

**Teams & access control**
- Multi-tenant, fully isolated workspaces
- Three roles — **admin / manager / member** — scoped per workspace
- Invite teammates by email **or** shareable link; invited users get an in-app notification

**AI assistance** _(Google Gemini → Groq fallback, Redis-cached, rate-limited)_
- Draft a full task description and acceptance criteria from a title
- Break a task into suggested subtasks
- Generate an executive summary of a project

**Analytics & polish**
- Dashboard with status distribution, overdue / due-soon lists, per-project progress, workload,
  and a 14-day completion trend (Recharts)
- Light / dark / system themes, keyboard shortcuts, responsive layout with mobile nav
- An animated marketing landing page with a one-click live demo

## 🛠️ Tech Stack

| Layer        | Technologies |
| ------------ | ------------ |
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, shadcn-style UI, TanStack Query, Zustand, React Router 6, React Hook Form + Zod, dnd-kit, Recharts, cmdk |
| **Backend**  | FastAPI (async), SQLAlchemy 2.0 (asyncpg), Alembic, Pydantic v2, python-jose (JWT), passlib + bcrypt |
| **Data & infra** | PostgreSQL, Redis (cache · rate limiting · WebSocket pub/sub), Resend (email), Google Gemini + Groq (AI) |

## 🚀 Demo

**▶ Live app: [team-task-manager-ten-opal.vercel.app](https://team-task-manager-ten-opal.vercel.app)**

The landing page has a one-click **"Try the live demo"** button, or sign in with a seeded account:

| Email                | Role    | Password      |
| -------------------- | ------- | ------------- |
| `admin@acme.test`    | admin   | `Password123` |
| `manager@acme.test`  | manager | `Password123` |
| `member@acme.test`   | member  | `Password123` |

All three belong to the demo workspace **"Acme Inc"** created by the seed script.

> Hosted on free tiers — the API sleeps after ~15 min idle, so the first request may take ~50s to
> wake up, then it's fast.

## 🏗️ Architecture

```
┌──────────────┐    HTTP / JSON    ┌──────────────┐    asyncpg     ┌──────────────┐
│  React + TS  │ ────────────────▶ │   FastAPI    │ ─────────────▶ │  PostgreSQL  │
│  Vite, TQ    │ ◀── WebSocket ──  │   (async)    │ ─── redis ───▶ │    Redis     │
└──────────────┘                   └──────────────┘                └──────────────┘
```

- A marketing **landing page** lives at `/`; the authenticated app runs under `/app/*`.
- The backend exposes **60 REST routes** plus a WebSocket endpoint, all under `/api/v1`.
- Workspace isolation is enforced on every request via a membership lookup; cross-tenant access
  returns `404` so workspace existence never leaks.

## 📦 Getting Started

**Prerequisites:** Python 3.11+, Node 20+, and either Docker or a reachable Postgres + Redis.

### Option A — Docker

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
docker compose up --build          # backend :8000, postgres :5432, redis :6379

# in another terminal
cd frontend && npm install && npm run dev   # :5173
```

### Option B — Manual (cloud Postgres + Redis)

```bash
# 1. Backend
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
cp .env.example .env                                 # then fill in the values below
alembic upgrade head
python seed.py                                       # creates the demo workspace
uvicorn app.main:app --reload --port 8000

# 2. Frontend
cd ../frontend
npm install
cp .env.example .env
npm run dev
```

Open <http://localhost:5173>.

### Environment variables

| Variable | Description |
| -------- | ----------- |
| `DATABASE_URL` | `postgresql+asyncpg://user:pw@host/db?sslmode=require` |
| `REDIS_URL` | `rediss://default:pw@host:port` (`rediss://` = TLS) |
| `JWT_SECRET` | 32+ random characters |
| `FRONTEND_URL`, `CORS_ORIGINS` | frontend origin(s) |
| `GEMINI_API_KEY`, `GROQ_API_KEY` | AI providers _(optional — features degrade gracefully)_ |
| `RESEND_API_KEY`, `EMAIL_FROM` | transactional email _(optional)_ |
| `VITE_API_URL`, `VITE_WS_URL` | backend URLs for the frontend |

## 📁 Project Structure

```
backend/
├── app/
│   ├── core/        config, database, security, exceptions
│   ├── models/      SQLAlchemy 2.0 models (13 tables)
│   ├── schemas/     Pydantic v2 request/response models
│   ├── services/    ai_service, email_service, ws_manager, notifications, activity, ratelimit
│   ├── api/routes/  auth, workspaces, invitations, projects, tasks, subtasks, comments,
│   │                labels, search, dashboard, activity, notifications, ai, ws
│   └── utils/       slug, pagination, tokens, position
├── alembic/         single migration covering all tables
├── seed.py          demo workspace + accounts
└── tests/           unit (runnable) + integration (DB-gated)

frontend/src/
├── pages/           Landing, Login, Signup, AcceptInvite, Dashboard, Projects, Board,
│                    Members, Labels, Settings, Activity
├── components/      ui/, layout/, auth/, kanban/, task/, notifications/, CommandPalette, …
├── features/        per-domain API clients (auth, workspace, projects, tasks, ai, …)
├── hooks/           useWebSocket, useKeyboardShortcuts
├── store/           authStore, uiStore (Zustand)
└── lib/             axios client with token refresh, query client, utils
```

## 📡 API Overview

Interactive docs at <http://localhost:8000/docs>. Highlights:

```
POST /auth/signup | login | refresh | change-password        GET/PATCH /auth/me
POST/GET /workspaces        GET/PATCH/DELETE /workspaces/{id}
POST/GET /workspaces/{id}/invitations    POST /invitations/{token}/accept
POST /projects/{id}/tasks   PATCH /tasks/{id}/move   PATCH /tasks/{id}/assign
POST/GET /tasks/{id}/comments            POST/DELETE /tasks/{id}/labels/{label_id}
GET  /workspaces/{id}/dashboard | search | activity
POST /ai/project-summary | task-draft | subtask-breakdown | standup
WS   /ws?token=<access>&workspace_id=<id>
```

## 🧪 Testing

```bash
cd backend
pytest                       # 26 unit tests; integration tests skip without a DB

# run integration tests too (uses a throwaway DB — drops/creates tables)
TEST_DATABASE_URL="postgresql+asyncpg://…" pytest

cd ../frontend
npx tsc --noEmit             # type-check
npm run build                # production build
```

Tests cover fractional positioning, password hashing + JWT, the auth & RBAC flows, task
move/ordering, invitations, dashboard math, and rate limiting.

## ☁️ Deployment

Designed for free-tier hosting with the app and database co-located for low latency:

1. **Neon** — Postgres (use the connection string as `DATABASE_URL`).
2. **Upstash** — Redis (use the `rediss://…` URL as `REDIS_URL`).
3. **Render** — deploy `backend/` as a Docker web service; the container runs migrations then
   uvicorn. Set the environment variables above and run `python seed.py` once.
4. **Vercel** — deploy `frontend/` (framework: Vite). Set `VITE_API_URL` / `VITE_WS_URL` to the
   backend URL, and point Render's `CORS_ORIGINS` / `FRONTEND_URL` at the Vercel domain.

## 📝 License

Released under the MIT License.
