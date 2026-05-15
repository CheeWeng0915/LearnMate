# LearnMate

LearnMate is a full-stack AI learning assistant:
- Frontend: Next.js 16 (React 19)
- Backend: FastAPI
- Database: MongoDB
- AI: Google Gemini (learning plan generation)
- Resources: YouTube Data API (video search)

## Features

- User registration / login / token refresh / logout
- Cloudflare Turnstile bot verification (during registration)
- AI-generated learning plans based on goal, level, and daily study time
- Save and retrieve active learning plans
- Track daily next tasks, notes, and completion progress
- Search YouTube learning resources by topic

## Project Structure

```text
LearnMate/
├── frontend/   # Next.js web app + /api proxy layer
└── backend/    # FastAPI API + MongoDB + Gemini/YouTube services
```

---

## Quick Start (Local Development)

### 1) Start Backend (FastAPI)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Edit `backend/.env` and fill at least:

```env
MONGODB_URI=
JWT_SECRET_KEY=
GEMINI_API_KEY=
YOUTUBE_API_KEY=
TURNSTILE_SECRET_KEY=
```

Run backend:

```bash
uvicorn main:app --reload --port 8080
```

Health check:

```bash
curl http://localhost:8080/api/health
```

### 2) Start Frontend (Next.js)

```bash
cd frontend
npm install
```

Create `frontend/.env.local` (if it does not exist):

```env
# Public Turnstile site key (frontend)
NEXT_PUBLIC_TURNSTILE_SITE_KEY=

# Optional: defaults to http://localhost:8080
BACKEND_API_URL=http://localhost:8080

# Optional: Cloud Run identity token audience
# If empty, it falls back to BACKEND_API_URL
BACKEND_ID_TOKEN_AUDIENCE=

# Optional: set true in local to disable Cloud Run ID token fetch
BACKEND_ID_TOKEN_DISABLED=true
```

Run frontend:

```bash
npm run dev
```

Open: <http://localhost:3000>

---

## Backend API Overview

All routes are prefixed with `/api`:

| Module | Method | Route |
|---|---|---|
| Health | GET | `/health` |
| Auth | POST | `/auth/register` |
| Auth | POST | `/auth/login` |
| Auth | POST | `/auth/refresh` |
| Auth | POST | `/auth/logout` |
| Auth | GET | `/auth/me` |
| Learning Plans | POST | `/learning-plans/generate` |
| Learning Plans | POST | `/learning-plans/save` |
| Learning Plans | GET | `/learning-plans/active` |
| Learning Plans | GET | `/learning-plans/{plan_id}/next` |
| Learning Plans | GET | `/learning-plans/{plan_id}/days/{day}/note` |
| Learning Plans | PUT | `/learning-plans/{plan_id}/days/{day}/note` |
| Learning Plans | PATCH | `/learning-plans/{plan_id}/days/{day}/complete` |
| Tasks | PATCH | `/tasks/{task_id}/complete` |
| Resources | PATCH | `/resources/{resource_id}/complete` |
| YouTube | POST | `/youtube/search` |

---

## Frontend Auth + Proxy Notes

- Frontend API requests go through `frontend/app/api/[...path]/route.ts`
- Client calls `/api/*`; proxy forwards to backend `/api/*`
- Access/refresh tokens are stored in HttpOnly cookies
- Access token refresh is handled automatically when possible

---

## Docker (Optional)

### Backend

```bash
docker build -t learnmate-backend ./backend
docker run --rm -p 8080:8080 --env-file ./backend/.env learnmate-backend
```

### Frontend

```bash
docker build \
  --build-arg NEXT_PUBLIC_TURNSTILE_SITE_KEY=your_site_key \
  -t learnmate-frontend ./frontend

docker run --rm -p 3000:8080 \
  -e BACKEND_API_URL=http://host.docker.internal:8080 \
  -e BACKEND_ID_TOKEN_DISABLED=true \
  learnmate-frontend
```

---

## FAQ

### `400 INVALID_ARGUMENT ... API key expired`

This means Google rejected the current Gemini key (`API_KEY_INVALID`), not a frontend issue.
Update `GEMINI_API_KEY` in `backend/.env`, then restart the FastAPI service.
