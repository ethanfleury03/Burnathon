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

- **git**
- **Python 3.10+** (3.12 recommended) -- via system Python, `pyenv`, or Miniconda
- **Node.js 20+**
- **PostgreSQL 16**
- **Clerk account** with Google sign-in enabled
- **OpenRouter API key** (for AI summaries and quizzes)

If you do not have `git` yet:

```bash
# Ubuntu / WSL
sudo apt update && sudo apt install -y git

# macOS (Homebrew)
brew install git
```

## Installation

### 1. Clone and set up the database

```bash
git clone <repo-url> && cd Burnathon
```

#### Install PostgreSQL (skip if already installed)

**Ubuntu / WSL (Debian-based):**

```bash
sudo apt update
sudo apt install -y postgresql

# Start the service (WSL does not use systemd by default)
sudo service postgresql start

# Optional: verify it is listening on 127.0.0.1:5432
pg_isready -h 127.0.0.1 -p 5432
```

**macOS (Homebrew):**

```bash
brew install postgresql@16
brew services start postgresql@16
```

By default PostgreSQL creates a `postgres` superuser. The `DATABASE_URL` below
assumes a password of `postgres`; set one with:

```bash
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'postgres';"
```

#### Create the database

```bash
sudo -u postgres createdb burnathon
```

### 2. Backend setup

Pick one of the two Python environment options. **venv** is the lightweight
default; **Miniconda** is a good choice if you already use conda or want a
project-specific Python version without touching the system install.

#### Option A -- venv (uses whatever `python3` is on your system)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
```

#### Option B -- Miniconda (skip if you already have conda/anaconda)

Install Miniconda:

```bash
# Ubuntu / WSL
mkdir -p ~/miniconda3
curl -fsSL https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh -o ~/miniconda3/miniconda.sh
bash ~/miniconda3/miniconda.sh -b -u -p ~/miniconda3
rm ~/miniconda3/miniconda.sh
~/miniconda3/bin/conda init bash
# Open a new shell so `conda` is on PATH

# macOS (Homebrew)
brew install --cask miniconda
conda init "$(basename "$SHELL")"
```

Create and activate the project env:

```bash
cd backend
conda create -n burnathon python=3.12 -y
conda activate burnathon
```

#### Install Python dependencies and run migrations

Regardless of which option you picked above, from the activated environment:

```bash
# Install dependencies
pip install -r requirements.txt

# Create .env from the example
cp .env.example .env
# Edit .env and fill in your real keys (see Environment Variables below)

# Run database migrations
alembic upgrade head
```

### 3. Frontend setup

#### Install Node.js 20 (skip if already installed)

The frontend requires **Node.js 20+** (Clerk, Vite 6, and react-router 7 will
fail to install on older versions). Ubuntu's default `apt install nodejs`
ships Node 12, which is too old, so use `nvm` or the NodeSource apt repo.

**Option A -- nvm (recommended, no sudo needed):**

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# Open a new shell, then:
nvm install 20
nvm use 20
node -v   # should print v20.x
```

**Option B -- NodeSource apt repo (Ubuntu/WSL):**

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
```

**macOS (Homebrew):**

```bash
brew install node@20
brew link --overwrite --force node@20
```

#### Install dependencies

```bash
cd frontend

# If you previously ran `npm install` on an older Node, clear the broken tree first:
# rm -rf node_modules package-lock.json

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
