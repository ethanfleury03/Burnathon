# Burnathon -- Student Lecture Portal

A web app for students to organize lecture audio, get automatic transcriptions, AI-generated summaries, and practice quizzes.

## What It Does

- **Google sign-in** via Clerk (users and admins)
- **Create classes** to organize lectures by course
- **Upload or record audio** directly in the browser
- **Automatic transcription** using faster-whisper (runs locally, no cloud API)
- **AI summaries** generated from transcripts via OpenRouter (DeepSeek V3.2)
- **Quiz & flashcard generation** from lecture content
- **Usage tracking** -- classes, lectures, and audio duration per user
- **Admin panel** -- manage users, roles, and moderate content

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, TypeScript, TailwindCSS, Clerk React SDK |
| Backend | Python 3.12, FastAPI, SQLAlchemy 2.0 (async), Alembic |
| Database | PostgreSQL 16 |
| Auth | Clerk (Google-only sign-in) |
| Transcription | faster-whisper (local CPU/GPU, no API key needed) |
| AI | OpenRouter API (DeepSeek V3.2 for summaries + quizzes) |
| Storage | Local filesystem (abstracted for future GCS migration) |

## Project Structure

```
Burnathon/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, CORS, /api/me, /api/health
│   │   ├── config.py            # Settings from .env
│   │   ├── models.py            # SQLAlchemy models (User, Class, Lecture)
│   │   ├── schemas.py           # Pydantic request/response models
│   │   ├── dependencies.py      # DB session, Clerk JWT auth
│   │   ├── processing.py        # Background pipeline (transcribe → summarize)
│   │   ├── routers/
│   │   │   ├── classes.py       # CRUD for classes
│   │   │   ├── lectures.py      # Upload, detail, delete, quiz trigger
│   │   │   └── admin.py         # User management, lecture moderation
│   │   └── services/
│   │       ├── transcription.py # Local faster-whisper integration
│   │       ├── ai.py            # OpenRouter summarization + quiz generation
│   │       └── storage.py       # File storage abstraction (local/GCS)
│   ├── alembic/                 # Database migrations
│   ├── tests/                   # 54 pytest tests (in-memory SQLite)
│   ├── uploads/                 # Audio file storage (gitignored)
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx              # Routing, nav, Clerk auth wrapper
│   │   ├── main.tsx             # React entry point with ClerkProvider
│   │   ├── api/
│   │   │   ├── client.ts        # Fetch wrapper with Clerk token injection
│   │   │   └── types.ts         # TypeScript interfaces
│   │   ├── components/
│   │   │   ├── AudioRecorder.tsx # MediaRecorder with timer
│   │   │   ├── ClassCard.tsx    # Class list card
│   │   │   ├── LectureCard.tsx  # Lecture list card with status badge
│   │   │   └── QuizView.tsx     # Interactive quiz + flashcard UI
│   │   └── pages/
│   │       ├── DashboardPage.tsx    # Stats, class list, create class
│   │       ├── ClassDetailPage.tsx  # Lecture list for a class
│   │       ├── LectureDetailPage.tsx # Transcript, summary, quiz, audio player
│   │       ├── NewLecturePage.tsx    # Record or upload audio
│   │       └── AdminPage.tsx        # User/lecture management
│   └── package.json
└── plan.md                      # Detailed project plan
```

## Prerequisites

- **Python 3.10+**
- **Node.js 20+**
- **PostgreSQL** running locally
- **Clerk account** with Google sign-in enabled
- **OpenRouter API key** (for AI summaries and quizzes)

## Installation

### 1. Clone and set up the database

```bash
git clone <repo-url> && cd Burnathon

# Create the PostgreSQL database
sudo -u postgres createdb burnathon
```

### 2. Backend setup

```bash
cd backend

# Create a virtual environment (or use conda)
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env from the example
cp .env.example .env
# Edit .env and fill in your real keys (see Environment Variables below)

# Run database migrations
alembic upgrade head
```

### 3. Frontend setup

```bash
cd frontend

# Install dependencies
npm install

# Create .env from the example
cp .env.example .env
# Edit .env and add your Clerk publishable key
```

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql+asyncpg://postgres:postgres@localhost:5432/burnathon` |
| `CLERK_SECRET_KEY` | Clerk backend secret key | (required) |
| `UPLOAD_DIR` | Directory for audio files | `./uploads` |
| `WHISPER_MODEL` | faster-whisper model size (`tiny`, `base`, `small`, `medium`, `large-v3`) | `base` |
| `WHISPER_DEVICE` | `cpu` or `cuda` (NVIDIA GPU) | `cpu` |
| `OPENROUTER_API_KEY` | OpenRouter API key | (required) |
| `OPENROUTER_BASE_URL` | OpenRouter API endpoint | `https://openrouter.ai/api/v1` |
| `OPENROUTER_MODEL` | Model for summaries/quizzes | `deepseek/deepseek-v3.2` |
| `STORAGE_BACKEND` | `local` or `gcs` | `local` |

### Frontend (`frontend/.env`)

| Variable | Description |
|----------|-------------|
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key (required) |
| `VITE_API_URL` | API base URL (leave empty for dev proxy) |

## Running the App

Start both services in separate terminals:

**Terminal 1 -- Backend (port 8000):**

```bash
cd backend
source .venv/bin/activate   # or: conda activate burnathon
uvicorn app.main:app --reload --port 8000
```

**Terminal 2 -- Frontend (port 5173):**

```bash
cd frontend
npm run dev
```

Open **http://localhost:5173** in your browser.

## Running Tests

Tests use an in-memory SQLite database and mock all external services. No PostgreSQL, Clerk, or API keys needed.

```bash
cd backend
python -m pytest -v
```

54 tests covering: class CRUD, lecture upload/delete, admin access control, processing pipeline, storage, user stats, and integration flows.

## How It Works

1. User signs in with Google via Clerk
2. User creates a **class** (e.g., "Biology 101")
3. User uploads or records audio for a lecture
4. Backend saves the audio and kicks off a **background task**:
   - **Transcription**: faster-whisper converts audio to text locally
   - **Summarization**: OpenRouter (DeepSeek V3.2) generates study notes
5. User can view the transcript, summary, and generate **quizzes/flashcards** on demand
6. Admins can manage users, change roles, and moderate all content
