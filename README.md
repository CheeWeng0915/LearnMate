# LearnMate

LearnMate is a full-stack AI learning assistant that helps learners turn a broad goal into a practical day-by-day study plan. Users can create an account, generate a personalized learning plan with Gemini, save their active plan, track daily progress, write notes, and find relevant YouTube learning resources.

This project is being prepared for the Google Cloud Rapid Agent Hackathon.

## Hackathon Track

- Target track: MongoDB
- Core AI: Google Gemini
- Cloud target: Google Cloud Run for the FastAPI backend
- Database: MongoDB Atlas
- Web platform: Next.js

The current application already uses Gemini for learning plan generation and MongoDB for persistence. For the hackathon submission, the project should also clearly document and demonstrate the required Google Cloud Agent Builder and partner MCP server integration before final Devpost submission.

## Features

- Email/password registration and login
- HttpOnly cookie based access and refresh token handling
- Cloudflare Turnstile verification during registration
- AI-generated learning plans based on:
  - Learning goal
  - Current level
  - Daily study time
  - Preferred language
- Save and retrieve an active learning plan
- View the next daily task
- Mark tasks and resources complete
- Add and edit daily learning notes
- Search YouTube learning resources by topic
- Ask the Learning Progress Coach Agent for a personalized next step based on saved plan progress, tasks, notes, and resources

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript |
| Backend | FastAPI, Python |
| AI | Google Gemini via `google-genai` |
| Database | MongoDB |
| Resources | YouTube Data API |
| Auth | JWT access and refresh tokens |
| Bot protection | Cloudflare Turnstile |
| Agent path | Google ADK-ready MongoDB MCP agent definition |
| Deployment target | Vercel frontend, Google Cloud Run backend |

## Architecture

```text
User
  |
  v
Next.js Frontend
  |
  | /api/* proxy
  v
FastAPI Backend
  |--- Gemini API: generates structured learning plans
  |--- Coach Agent: summarizes progress and recommends next actions
  |--- MongoDB: stores users, plans, tasks, notes, and progress
  |--- YouTube Data API: finds learning resources
  |--- Turnstile: verifies registration requests
```

The app includes a production route at `POST /api/agent/coach`. It authenticates the current user, reads their saved learning context from MongoDB, and uses Gemini to return a structured coaching response. The repository also includes `backend/agent/agent.py`, an ADK-compatible agent entrypoint configured for the official MongoDB MCP server so the same coach concept can be demonstrated through the Google Agent Builder / ADK MCP path.

## Repository Structure

```text
LearnMate/
├── backend/                 # FastAPI API, services, schemas, Dockerfile
│   ├── main.py
│   ├── route/
│   ├── schema/
│   └── service/
├── frontend/                # Next.js web app, API proxy, UI components
│   ├── app/
│   ├── components/
│   ├── lib/
│   └── public/
├── .github/workflows/       # Deployment workflows
├── LICENSE
└── README.md
```

## Local Development

### Prerequisites

- Python 3.11+
- Node.js 20+
- MongoDB connection string
- Gemini API key
- YouTube Data API key
- Cloudflare Turnstile keys

### 1. Start the Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Fill in `backend/.env`:

```env
YOUTUBE_API_KEY=
GEMINI_API_KEY=
GEMINI_MODEL=gemini-1.5-flash
COACH_AGENT_MODEL=gemini-2.0-flash
MONGODB_URI=
MONGODB_DB_NAME=learnmate
MONGODB_SERVER_SELECTION_TIMEOUT_MS=5000
JWT_SECRET_KEY=
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
TURNSTILE_SECRET_KEY=
```

Run the API:

```bash
uvicorn main:app --reload --port 8080
```

Health check:

```bash
curl http://localhost:8080/api/health
```

### 2. Start the Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
```

Fill in `frontend/.env.local`:

```env
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
BACKEND_API_URL=http://localhost:8080
BACKEND_ID_TOKEN_AUDIENCE=http://localhost:8080
BACKEND_ID_TOKEN_DISABLED=true
```

Run the web app:

```bash
npm run dev
```

Open <http://localhost:3000>.

## API Overview

All backend routes are prefixed with `/api`.

| Area | Method | Route |
|---|---:|---|
| Health | GET | `/health` |
| Auth | POST | `/auth/register` |
| Auth | POST | `/auth/login` |
| Auth | POST | `/auth/refresh` |
| Auth | POST | `/auth/logout` |
| Auth | GET | `/auth/me` |
| Agent | POST | `/agent/coach` |
| Learning Plans | POST | `/learning-plans/generate` |
| Learning Plans | POST | `/learning-plans/save` |
| Learning Plans | GET | `/learning-plans/active` |
| Learning Plans | GET | `/learning-plans/{plan_id}/next` |
| Notes | GET | `/learning-plans/{plan_id}/days/{day}/note` |
| Notes | PUT | `/learning-plans/{plan_id}/days/{day}/note` |
| Progress | PATCH | `/learning-plans/{plan_id}/days/{day}/complete` |
| Tasks | PATCH | `/tasks/{task_id}/complete` |
| Resources | PATCH | `/resources/{resource_id}/complete` |
| YouTube | POST | `/youtube/search` |

The frontend calls `/api/*`; `frontend/app/api/[...path]/route.ts` forwards requests to the FastAPI backend.

## Docker

### Backend

```bash
docker build -t learnmate-backend ./backend
docker run --rm -p 8080:8080 --env-file ./backend/.env learnmate-backend
```

### Frontend

```bash
docker build \
  --build-arg NEXT_PUBLIC_TURNSTILE_SITE_KEY=your_turnstile_site_key \
  -t learnmate-frontend ./frontend

docker run --rm -p 3000:8080 \
  -e BACKEND_API_URL=http://host.docker.internal:8080 \
  -e BACKEND_ID_TOKEN_DISABLED=true \
  learnmate-frontend
```

## Deployment Notes

Recommended production setup:

- Deploy `backend/` to Google Cloud Run.
- Deploy `frontend/` to Vercel.
- Use MongoDB Atlas for the database.
- Store all secrets in the deployment platform's environment variable manager.
- Set `BACKEND_API_URL` in the frontend environment to the deployed Cloud Run backend URL.
- If Cloud Run requires authenticated requests, set `BACKEND_ID_TOKEN_AUDIENCE` to the backend audience URL and leave `BACKEND_ID_TOKEN_DISABLED` unset or `false`.

## Devpost Submission Checklist

- Hosted project URL
- Public GitHub repository URL
- Open source license file
- Demo video under 3 minutes, uploaded to YouTube or Vimeo
- English project description
- Clear explanation of:
  - What the project does
  - Which problem it solves
  - How Gemini is used
  - How MongoDB is used
  - How Google Cloud is used
  - How the required partner MCP server is integrated
  - What was learned while building the project

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE).
