# brainrip -- Student Lecture Portal

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
brainrip/
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
git clone <repo-url> && cd brainrip
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
sudo -u postgres createdb brainrip
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
conda create -n brainrip python=3.12 -y
conda activate brainrip
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
| `DATABASE_URL` | PostgreSQL connection string | `postgresql+asyncpg://postgres:postgres@localhost:5432/brainrip` |
| `CLERK_SECRET_KEY` | Clerk backend secret key | (required) |
| `UPLOAD_DIR` | Directory for audio files | `./uploads` |
| `WHISPER_MODEL` | faster-whisper model size (`tiny`, `base`, `small`, `medium`, `large-v3`) | `base` |
| `WHISPER_DEVICE` | `cpu` or `cuda` (NVIDIA GPU) | `cpu` |
| `OPENROUTER_API_KEY` | OpenRouter API key | (required) |
| `OPENROUTER_BASE_URL` | OpenRouter API endpoint | `https://openrouter.ai/api/v1` |
| `OPENROUTER_MODEL` | Model for summaries/quizzes | `deepseek/deepseek-v3.2` |
| `STORAGE_BACKEND` | `local` or `gcs` | `local` |
| `ALLOWED_ORIGINS` | CORS allowed origins (JSON array string, e.g. `["https://app.example.com"]`) | `["http://localhost:5173"]` |

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
source .venv/bin/activate   # or: conda activate brainrip
uvicorn app.main:app --reload --port 8000
```

**Terminal 2 -- Frontend (port 5173):**

```bash
cd frontend
npm run dev
```

Open **http://localhost:5173** in your browser.

## Production deployment (Linux server)

These steps assume **Ubuntu 22.04/24.04** (or similar). Adjust hostnames, passwords, and domain names. Keep the **git checkout**, **runtime secrets**, and **uploaded files** separate from what nginx serves as static files.

### Layout

| Concern | Location |
|---------|----------|
| Repository (code, `.git`, Alembic, etc.) | `/srv/brainrip` |
| Built SPA (only what nginx serves as static files) | `/srv/brainrip/frontend/dist/` |
| Secrets / env for the backend | `/etc/brainrip/backend.env` (not in the repo) |
| User uploads (audio) | `/var/lib/brainrip/uploads` |

### 1. Install system packages (as root or sudo)

Install PostgreSQL, nginx, Python for the venv, git, and build tools the Python stack may need:

```bash
sudo apt update
sudo apt install -y postgresql nginx git python3 python3-venv python3-pip build-essential
sudo systemctl enable --now postgresql nginx
```

Node.js is installed in **step 3** (after the `brainrip` user exists).

### 2. Create the `brainrip` Unix user

Use a dedicated non-root account for the API process and for owning `/srv/brainrip` if that matches your deploy model:

```bash
sudo adduser --disabled-password brainrip
```

Add an SSH key or set a password only if you need interactive login. The app itself does not require a password if systemd starts it.

### 3. Install Node.js 20+ for `brainrip`

The frontend build (`npm ci`, `npm run build`) requires **Node.js 20+**. Ubuntu’s default `nodejs` package is often too old, so use **nvm** in `brainrip`’s home (recommended) or install Node **20+** system-wide.

**Option A — nvm (recommended):** Node and npm live under **`~brainrip/.nvm`**; only the install script needs network access. Ensure `curl` exists (`sudo apt install -y curl` if needed).

```bash
sudo -iu brainrip
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
```

Open a **new** login shell as `brainrip` (or `source ~/.bashrc`), then:

```bash
nvm install 20
nvm alias default 20
node -v   # should print v20.x
npm -v
```

**Option B — NodeSource (system-wide):** makes `node` and `npm` available to every user (typically under `/usr/bin`). Run with `sudo` once:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
```

Use **Option A** if only `brainrip` runs frontend builds on this host; use **Option B** if several accounts need the same Node.

Confirm `brainrip` can run the toolchain:

```bash
sudo -iu brainrip
command -v node && node -v && command -v npm && npm -v
```

### 4. PostgreSQL database and role

Create a database and a **non-superuser** role with a strong password (replace names and secrets). Example:

```bash
sudo -u postgres psql <<'SQL'
CREATE USER brainrip_app WITH PASSWORD 'REPLACE_WITH_STRONG_PASSWORD';
CREATE DATABASE brainrip OWNER brainrip_app;
SQL
```

Your **`DATABASE_URL`** will look like:

```bash
postgresql+asyncpg://brainrip_app:REPLACE_WITH_STRONG_PASSWORD@127.0.0.1:5432/brainrip
```

Ensure PostgreSQL is listening on `127.0.0.1:5432` (default on Ubuntu).

### 5. Directories and permissions

```bash
sudo mkdir -p /srv/brainrip /etc/brainrip /var/lib/brainrip/uploads
sudo chown brainrip:brainrip /srv/brainrip /var/lib/brainrip/uploads
sudo chmod 755 /srv/brainrip /etc/brainrip
```

### 6. Clone the repository into `/srv/brainrip`

The checkout should live **directly** under `/srv/brainrip` (no extra `repo-name/` folder). As `brainrip` (or your deploy user, then `chown` to `brainrip`):

```bash
sudo -iu brainrip
mkdir -p /srv/brainrip
cd /srv/brainrip
git clone <your-repo-url> .
```

If `/srv/brainrip` already exists empty, `git clone <url> .` is correct. If you prefer a one-liner from root:

```bash
sudo git clone <your-repo-url> /srv/brainrip
sudo chown -R brainrip:brainrip /srv/brainrip
```

### 7. Python virtualenv and backend dependencies

As **`brainrip`**:

```bash
sudo -iu brainrip
cd /srv/brainrip/backend
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate
```

Use the interpreter at **`/srv/brainrip/backend/.venv/bin/python`** in `ExecStart` below.

### 8. Create and edit `/etc/brainrip/backend.env`

This file holds the same **keys** as the **Backend** table under [Environment Variables](#environment-variables), but lives **outside** the repo. systemd will inject it into the process environment; Pydantic reads those variables (see [backend/app/config.py](backend/app/config.py)).

Create an empty file with safe permissions, then edit it with `sudo`:

```bash
sudo install -d -m 755 /etc/brainrip
sudo install -m 640 -o root -g brainrip /dev/null /etc/brainrip/backend.env
sudo nano /etc/brainrip/backend.env
```

**Why `640` and group `brainrip`:** `root` can always read the file for administration, and **`brainrip` can read it** so you can run **`alembic upgrade head`** as `brainrip` after sourcing the file (below). Other users cannot read `640`. If you prefer **`600` `root:root`**, only root can read the file — use `sudo` to run migrations or temporarily relax permissions.

**Syntax (systemd `EnvironmentFile` format):**

- One variable per line: `NAME=value`
- No `export`
- Lines starting with `#` are comments
- Do not wrap values in quotes unless the quotes are part of the value
- For JSON in **`ALLOWED_ORIGINS`**, use a **single line** (double quotes inside the JSON are fine)

**Example** — replace secrets, domain, and DB credentials:

```bash
# Required: PostgreSQL (async driver in URL)
DATABASE_URL=postgresql+asyncpg://brainrip_app:REPLACE_WITH_STRONG_PASSWORD@127.0.0.1:5432/brainrip

# Required: Clerk (backend secret from Clerk dashboard)
CLERK_SECRET_KEY=sk_live_xxxxx

# Optional: override Clerk JWKS URL if needed
# CLERK_JWKS_URL=https://YOUR_INSTANCE.clerk.accounts.dev/.well-known/jwks.json

# Required in production: audio uploads (must be writable by brainrip)
UPLOAD_DIR=/var/lib/brainrip/uploads

# Optional: faster-whisper
WHISPER_MODEL=base
WHISPER_DEVICE=cpu

# Required: OpenRouter (summaries / quizzes)
OPENROUTER_API_KEY=sk-or-v1-xxxxx
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=deepseek/deepseek-v3.2

# Optional: storage backend
STORAGE_BACKEND=local
# GCS_BUCKET=your-bucket

# Required in production: browser origin(s) hitting the API (HTTPS)
ALLOWED_ORIGINS=["https://your.domain"]
```

After saving, tighten ownership if you used `nano` as root:

```bash
sudo chown root:brainrip /etc/brainrip/backend.env
sudo chmod 640 /etc/brainrip/backend.env
```

### 9. Run database migrations

As **`brainrip`**, load the env file and run Alembic from the backend directory:

```bash
sudo -iu brainrip
cd /srv/brainrip/backend
set -a
source /etc/brainrip/backend.env
set +a
source .venv/bin/activate
alembic upgrade head
deactivate
```

Repeat **`alembic upgrade head`** after each deploy that adds migrations.

### 10. Frontend production build

The SPA needs **Vite env vars at build time**. As **`brainrip`** (with Node 20+ on `PATH`):

```bash
cd /srv/brainrip/frontend
cp .env.example .env
nano .env   # set VITE_CLERK_PUBLISHABLE_KEY; see below for VITE_API_URL
npm ci
npm run build
```

- **`VITE_CLERK_PUBLISHABLE_KEY`** — production publishable key from Clerk (starts with `pk_live_` in production).
- **`VITE_API_URL`** — If nginx serves the SPA and proxies `/api/` to the backend on the **same origin**, you can leave **`VITE_API_URL` empty** so the browser uses relative `/api/...` URLs. If the browser must call another host, set the full API base URL (for example `https://your.domain`).

Confirm output exists: **`/srv/brainrip/frontend/dist/index.html`**.

### 11. systemd unit for uvicorn

Create **`/etc/systemd/system/brainrip-backend.service`**:

```ini
[Unit]
Description=brainrip FastAPI (uvicorn)
After=network-online.target postgresql.service
Wants=network-online.target

[Service]
Type=simple
User=brainrip
Group=brainrip
WorkingDirectory=/srv/brainrip/backend
EnvironmentFile=/etc/brainrip/backend.env
ExecStart=/srv/brainrip/backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Reload systemd, enable, and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now brainrip-backend.service
sudo systemctl status brainrip-backend.service
```

Check logs:

```bash
sudo journalctl -u brainrip-backend.service -f
```

Quick local check (on the server):

```bash
curl -sS http://127.0.0.1:8000/api/health
```

After editing **`/etc/brainrip/backend.env`**, restart the service:

```bash
sudo systemctl restart brainrip-backend.service
```

### 12. nginx

Point **`root`** only at the built assets. Do **not** use the repo root as the document root (that could expose `.git`, source, etc.).

Example snippet inside your **`server { ... }`** for HTTPS (adjust `server_name` and certificate paths):

```nginx
root /srv/brainrip/frontend/dist;
index index.html;

location /api/ {
    proxy_pass http://127.0.0.1:8000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location / {
    try_files $uri $uri/ /index.html;
}
```

Enable the site (if using `sites-available` / `sites-enabled`), test, and reload:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

Obtain TLS certificates (for example with [Certbot](https://certbot.eff.org/)) so browsers talk to **`https://your.domain`**; only expose **80** and **443** publicly.

### 13. Deploy checklist (each release)

1. Pull or deploy new code to `/srv/brainrip` as your git workflow allows.
2. **`brainrip`:** `cd /srv/brainrip/backend && source .venv/bin/activate && pip install -r requirements.txt` (if dependencies changed).
3. **`brainrip`:** `set -a && source /etc/brainrip/backend.env && set +a && alembic upgrade head`
4. **`brainrip`:** `cd /srv/brainrip/frontend && npm ci && npm run build` (if the frontend changed; update `frontend/.env` if Vite vars changed).
5. **`sudo systemctl restart brainrip-backend.service`**
6. **`sudo nginx -t && sudo systemctl reload nginx`** (if nginx config changed)

This matches [backend/app/config.py](backend/app/config.py): settings are loaded from the process environment (from **`EnvironmentFile`**) and optionally from **`backend/.env`** when present for local development.

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
