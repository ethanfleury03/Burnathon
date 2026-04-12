# Student Lecture Portal -- V1 Plan

## Technology Stack

- **Server OS**: Ubuntu 24.04 LTS
- **Frontend**: React 18 + Vite + TypeScript, Clerk React SDK, TailwindCSS
- **Backend**: Python 3.12, FastAPI, SQLAlchemy 2.0 (async), Alembic (migrations)
- **Database**: PostgreSQL 16 (installed locally via `apt`)
- **Background Jobs**: FastAPI `BackgroundTasks` (no extra services needed in V1)
- **Auth**: Clerk (Google-only sign-in), verified server-side via `clerk-backend-api` Python SDK
- **Storage**: Local filesystem (`./uploads/`) in V1, abstracted behind a storage service for easy GCS migration
- **Transcription**: faster-whisper (local, runs on CPU or GPU -- no cloud API needed)
- **AI Services**: GPT-4o via OpenAI API (summarization + quiz/flashcard generation only)
- **Audio Recording**: MediaRecorder browser API

### Why faster-whisper for transcription

OpenWhispr is a desktop dictation app, not an embeddable library. faster-whisper (`pip install faster-whisper`) is a Python reimplementation of OpenAI Whisper using CTranslate2. It runs 4x faster than the original Whisper, works on CPU and NVIDIA GPU, and is called as a regular Python function -- no separate server, no API key, no cloud dependency. Audio never leaves the server.

Performance reference (faster-whisper `base` model on CPU):
- ~5 min audio: transcribes in ~30-60 seconds
- ~60 min lecture: transcribes in ~5-10 minutes

GPU (NVIDIA with CUDA 12) makes this near real-time. For V1 on CPU, transcription runs in a background thread via `asyncio.to_thread()` so it does not block the FastAPI event loop.

## Project Structure

```
Burnathon/
  plan.md
  README.md
  scripts/
    setup_local.sh             # Ubuntu 24.04: apt install, create DB, pip install, download whisper model, run migrations
  backend/
    requirements.txt
    alembic.ini
    alembic/                   # migration scripts
    uploads/                   # local audio file storage (gitignored)
    app/
      main.py                  # FastAPI app + CORS + static file serving for uploads
      config.py                # env-based settings (pydantic-settings)
      dependencies.py          # Clerk auth dependency, DB session
      models.py                # SQLAlchemy models: User, Class, Lecture + enums
      schemas.py               # Pydantic request/response schemas
      routers/
        classes.py             # CRUD for classes
        lectures.py            # Upload, list, detail, quiz generation
        admin.py               # Admin-only endpoints
      services/
        storage.py             # StorageBackend ABC -> LocalStorage (V1) / GCSStorage (cloud)
        transcription.py       # faster-whisper local transcription (model loading + transcribe)
        ai.py                  # OpenAI GPT calls: summarize, generate quiz (NOT transcription)
      processing.py            # Background pipeline: transcribe locally -> summarize via GPT -> update status
  frontend/
    package.json
    vite.config.ts
    .env                       # VITE_CLERK_PUBLISHABLE_KEY, VITE_API_URL
    src/
      main.tsx
      App.tsx                  # ClerkProvider + router
      api/                     # Axios/fetch wrapper with Clerk token
      pages/
        LoginPage.tsx
        DashboardPage.tsx      # List classes + usage stats
        ClassDetailPage.tsx    # List lectures in a class
        LectureDetailPage.tsx  # Transcript, summary, quiz, audio player
        NewLecturePage.tsx     # Combined: record audio OR upload file, with title + class picker
        AdminPage.tsx          # User/content management
      components/
        AudioRecorder.tsx      # MediaRecorder, timer, start/stop buttons
        LectureCard.tsx
        ClassCard.tsx
        QuizView.tsx           # Flashcard/quiz UI
```

## Database Schema (SQLAlchemy)

Adapted from the provided Prisma-style spec, translated to SQLAlchemy 2.0 models:

**Enums**: `UserRole('user', 'admin')`, `LectureStatus('uploaded', 'transcribing', 'summarizing', 'ready', 'failed')`

**users table**
- `id` UUID PK (server-default uuid4)
- `clerk_user_id` TEXT UNIQUE NOT NULL (indexed)
- `email` TEXT UNIQUE NOT NULL (indexed)
- `full_name` TEXT NULL
- `role` UserRole NOT NULL DEFAULT 'user'
- `created_at` TIMESTAMP NOT NULL DEFAULT now()
- `updated_at` TIMESTAMP NOT NULL (onupdate=now)

**classes table**
- `id` UUID PK
- `owner_user_id` UUID FK -> users.id NOT NULL (indexed)
- `title` TEXT NOT NULL
- `created_at` TIMESTAMP NOT NULL DEFAULT now()
- `updated_at` TIMESTAMP NOT NULL
- `archived_at` TIMESTAMP NULL

**lectures table**
- `id` UUID PK
- `class_id` UUID FK -> classes.id NOT NULL (indexed)
- `owner_user_id` UUID FK -> users.id NOT NULL (indexed)
- `title` TEXT NOT NULL
- `audio_storage_key` TEXT NOT NULL (relative path on local disk in V1, GCS object key in cloud)
- `audio_original_filename` TEXT NOT NULL
- `audio_mime_type` TEXT NOT NULL
- `audio_size_bytes` BIGINT NOT NULL
- `duration_seconds` INT NULL
- `notes_text` TEXT NULL
- `transcript_text` TEXT NULL
- `summary_text` TEXT NULL
- `quiz_data` JSONB NULL (stores generated quiz/flashcard JSON)
- `status` LectureStatus NOT NULL DEFAULT 'uploaded' (indexed)
- `processing_error` TEXT NULL
- `uploaded_at` TIMESTAMP NOT NULL DEFAULT now()
- `updated_at` TIMESTAMP NOT NULL
- `deleted_at` TIMESTAMP NULL (soft-delete)
- Composite index: `(class_id, uploaded_at DESC)`

## Authentication Flow

```mermaid
sequenceDiagram
    participant Browser
    participant Clerk
    participant Frontend
    participant FastAPI
    participant DB

    Browser->>Clerk: Google OAuth sign-in
    Clerk->>Frontend: Session token (JWT)
    Frontend->>FastAPI: API request + Bearer token
    FastAPI->>Clerk: Verify JWT (clerk-backend-api)
    FastAPI->>DB: Lookup user by clerk_user_id
    alt First login
        FastAPI->>DB: INSERT user row (role=user)
    end
    FastAPI->>Frontend: Response with user context
```

- User sync happens on first authenticated API request (no webhook needed -- local server has no public URL).
- FastAPI dependency `get_current_user()` verifies Clerk JWT, resolves/creates DB user, attaches to request.
- Admin role is set manually in DB or via the admin endpoint (no self-promotion).

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/me` | user | Current user profile + usage stats |
| POST | `/api/classes` | user | Create a class (title required) |
| GET | `/api/classes` | user | List own classes (admin: all) |
| GET | `/api/classes/:id` | owner/admin | Class detail with lecture list |
| PATCH | `/api/classes/:id` | owner/admin | Update title, archive |
| POST | `/api/classes/:id/lectures` | owner | Multipart upload: title + audio file + optional notes |
| GET | `/api/lectures/:id` | owner/admin | Lecture detail (transcript, summary, quiz) |
| DELETE | `/api/lectures/:id` | owner/admin | Soft-delete |
| POST | `/api/lectures/:id/generate-quiz` | owner | Trigger quiz/flashcard generation |
| GET | `/api/admin/users` | admin | List all users |
| PATCH | `/api/admin/users/:id` | admin | Change role |
| GET | `/api/admin/lectures` | admin | List all lectures (moderation) |

## New Lecture Page (Record or Upload)

`NewLecturePage.tsx` combines recording and file upload into one page with two tabs:

**Record tab** (uses `AudioRecorder.tsx` component):
- **Start button**: Requests microphone permission, starts MediaRecorder, begins a visible timer (mm:ss)
- **Stop button**: Stops recording, assembles Blob from chunks, shows preview player

**Upload tab**:
- Standard file picker for existing audio files

**Both tabs share**:
- Title field (required), class selector (required), optional notes textarea
- Submit button uploads the audio (recorded blob or selected file) via `POST /api/classes/:id/lectures`
- Audio formats accepted: WebM/Opus (browser native), mp3, m4a, wav

## Processing Pipeline

```mermaid
flowchart LR
    Upload["Upload Audio"] --> StatusUploaded["status: uploaded"]
    StatusUploaded --> BgTask["BackgroundTask: process_lecture"]
    BgTask --> Transcribe["faster-whisper (local)"]
    Transcribe --> Summarize["GPT-4o API: summarize"]
    Summarize --> StatusReady["status: ready"]
    Transcribe -- error --> StatusFailed["status: failed"]
    Summarize -- error --> StatusFailed
```

All processing runs in `processing.py` via FastAPI `BackgroundTasks`:

1. **Upload**: Audio file saved to `backend/uploads/{lecture_id}/{filename}`, lecture row created with `status=uploaded`, background task kicked off
2. **process_lecture()**: Runs in a background thread via `asyncio.to_thread()` so CPU-bound transcription does not block the event loop. Sets `status=transcribing`, calls faster-whisper locally, saves `transcript_text`, sets `status=summarizing`, calls GPT-4o, saves `summary_text`, sets `status=ready`
3. **Quiz generation**: On-demand -- user clicks "Generate Quiz", a background task calls GPT-4o and saves `quiz_data`
4. **Failure**: Any error sets `status=failed` and stores `processing_error`. User can retry from the lecture detail page.

### Transcription details (`services/transcription.py`)

- Loads the faster-whisper model once at app startup (singleton). Default model: `base` (140 MB, good balance of speed/accuracy). Configurable via `WHISPER_MODEL` env var (options: `tiny`, `base`, `small`, `medium`, `large-v3`).
- `transcribe(file_path: str) -> str` reads the audio file from local disk, runs faster-whisper, returns the full transcript text.
- Runs on CPU by default. If NVIDIA GPU + CUDA 12 is available, set `WHISPER_DEVICE=cuda` for near real-time transcription.
- No internet connection required for transcription.

## Accounting / Usage Tracking

- Track per-user: total lectures uploaded, total audio duration, total classes created
- Derived from DB queries on lectures table (no separate counters table)
- Returned as part of the `/api/me` response so the dashboard can display a usage summary card without a separate API call

## Admin Capabilities

- View all users, classes, lectures
- Change user roles
- Access soft-deleted lectures for moderation/recovery
- View global usage stats

## Local Server Setup (V1) -- Ubuntu 24.04 LTS

V1 runs entirely on a single Ubuntu machine. Only two system services: Python and PostgreSQL. No Redis, no Docker, no message queues.

**System prerequisites (Ubuntu 24.04 LTS):**

```bash
# System packages
sudo apt update && sudo apt install -y python3.12 python3.12-venv python3-pip \
    postgresql postgresql-contrib nodejs npm

# (Optional) NVIDIA GPU support for faster transcription
# Install CUDA 12 toolkit + cuDNN 9 per NVIDIA docs if GPU available
```

- Python 3.12+ (ships with Ubuntu 24.04)
- Node.js 20+ (via `apt` or NodeSource)
- PostgreSQL 16 (via `apt`, runs as systemd service)
- ~500 MB disk for the whisper `base` model (downloaded automatically on first run)

**How to run:**
1. Run `scripts/setup_local.sh` to verify prerequisites, create the `burnathon` database, install Python/Node dependencies, download the whisper model, and run Alembic migrations
2. Start backend: `cd backend && uvicorn app.main:app --reload --port 8000`
3. Start frontend: `cd frontend && npm run dev`
4. Frontend runs on `http://localhost:5173`, API on `http://localhost:8000`

Two terminal windows total. Transcription + summarization happen in-process via BackgroundTasks.

**Local networking:**
- FastAPI serves the API and also serves uploaded audio files via a `/files/` static route for playback
- Vite dev server proxies `/api` requests to FastAPI at port 8000
- CORS configured to allow `localhost:5173`

## Build Order

Since the repo is empty, every file is new. Build in this order (each step unblocks the next):

1. `scripts/setup_local.sh` -- Ubuntu 24.04 setup: apt packages, DB creation, venv, pip install, whisper model download, Alembic migration
2. `backend/app/models.py` + Alembic migration -- Database schema
3. `backend/app/dependencies.py` -- Clerk JWT verification + DB session
4. `backend/app/routers/classes.py` -- Class CRUD (first working endpoint)
5. `backend/app/services/transcription.py` + `services/ai.py` + `services/storage.py` + `processing.py` -- Local whisper + GPT pipeline
6. `backend/app/routers/lectures.py` -- Upload + processing trigger
7. `frontend/` scaffold + `NewLecturePage.tsx` -- Recording and upload UI
8. `frontend/src/pages/DashboardPage.tsx` + `LectureDetailPage.tsx` -- Core user views
9. `backend/app/routers/admin.py` + `frontend/src/pages/AdminPage.tsx` -- Admin (last, lowest priority)

## Environment Variables Required

**Backend** (`.env`):
- `DATABASE_URL` -- default: `postgresql+asyncpg://postgres:postgres@localhost:5432/burnathon`
- `CLERK_SECRET_KEY` -- Clerk backend secret
- `UPLOAD_DIR` -- default: `./uploads`
- `WHISPER_MODEL` -- default: `base` (options: `tiny`, `base`, `small`, `medium`, `large-v3`)
- `WHISPER_DEVICE` -- default: `cpu` (set to `cuda` if NVIDIA GPU available)
- `OPENAI_API_KEY` -- For GPT summarization + quiz generation (NOT used for transcription)
- `STORAGE_BACKEND` -- `local` (V1) or `gcs` (cloud)
- `GCS_BUCKET` -- only needed when `STORAGE_BACKEND=gcs`

**Frontend** (`.env`):
- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_API_URL` -- default `http://localhost:8000`

---

## Google Cloud Scaling Roadmap

This section describes how to migrate from the local server to Google Cloud when ready to scale.

### Target Architecture

```mermaid
flowchart TB
    subgraph clientLayer [Client Layer]
        Browser["Browser (React SPA)"]
    end

    subgraph gcpHosting [GCP Hosting]
        Firebase["Firebase Hosting (static frontend)"]
        CloudRun["Cloud Run (FastAPI + BackgroundTasks)"]
    end

    subgraph gcpData [GCP Data]
        CloudSQL["Cloud SQL (PostgreSQL)"]
        GCS["Cloud Storage (audio files)"]
    end

    subgraph external [External Services]
        Clerk["Clerk Auth"]
        OpenAI["OpenAI API (GPT only)"]
    end

    Browser --> Firebase
    Browser --> CloudRun
    CloudRun --> CloudSQL
    CloudRun --> GCS
    CloudRun --> OpenAI
    Browser --> Clerk
    CloudRun --> Clerk
```

### Migration Steps (Local to GCP)

**Phase 1 -- Provision and migrate data**
- Create a GCP project, enable Cloud Run + Cloud SQL + Cloud Storage APIs
- Provision Cloud SQL PostgreSQL (`db-f1-micro` to start), create a GCS bucket
- `pg_dump` local DB, `pg_restore` into Cloud SQL
- `gsutil rsync` local uploads to GCS bucket
- Switch env vars: `DATABASE_URL` to Cloud SQL, `STORAGE_BACKEND=gcs`, `GCS_BUCKET` set

**Phase 2 -- Containerize and deploy**
- Add `Dockerfile` for backend (Python + uvicorn + faster-whisper model baked into image)
- Deploy to Cloud Run with GPU (NVIDIA T4/L4) for fast transcription, or CPU-only for lower cost
- Note: Cloud Run containers with faster-whisper need sufficient memory (2-4 GB for `base` model)
- Build React frontend (`npm run build`), host static files on Firebase Hosting or Cloud Storage + Cloud CDN
- BackgroundTasks still work in Cloud Run for processing; if scale demands it later, swap to Cloud Tasks triggering a separate worker Cloud Run service
- Move secrets from `.env` to GCP Secret Manager

**Phase 3 -- Production hardening (when needed)**
- Cloud Monitoring + uptime checks + alerting
- Cloud Armor for DDoS protection
- Automated Cloud SQL backups
- Custom domain via Cloud Load Balancer

### Cost Estimates (Small Scale)

- **Cloud Run** (CPU, 2 GB RAM): ~$5-15/month at low traffic (free tier covers idle)
- **Cloud Run with GPU** (for faster transcription): ~$0.50/hr when active, $0 when scaled to zero
- **Cloud SQL** (db-f1-micro): ~$10/month
- **Cloud Storage**: ~$0.02/GB/month for audio
- **Firebase Hosting**: free tier covers most small apps
- **OpenAI API** (GPT for summaries/quizzes): ~$0.01-0.05 per lecture (transcription is free/local)
- Total for a small CPU-only deployment: approximately $20-40/month

### What Changes in Code

The app is designed so cloud migration requires **zero application logic changes**:

- `STORAGE_BACKEND` env var switches `LocalStorage` to `GCSStorage`
- `DATABASE_URL` points to Cloud SQL instead of localhost
- `WHISPER_DEVICE` set to `cuda` if deploying with GPU, or `cpu` otherwise
- Add `Dockerfile` (new file, not a modification to existing code)
- Transcription still runs locally inside the container (faster-whisper) -- no cloud transcription API needed
- Everything else is infrastructure configuration
