# brainrip -- Student Lecture Portal

A web app for students to organize lecture audio, get automatic transcriptions, AI-generated summaries, and practice quizzes.

## What It Does

- **Google sign-in** via Clerk (users and admins)
- **Create classes** to organize lectures by course
- **Upload or record audio** directly in the browser
- **Automatic transcription** using faster-whisper (runs locally, no cloud API)
- **AI summaries** generated from transcripts via OpenRouter (DeepSeek V3.2), shown as formatted Markdown in the app
- **Quiz & flashcard generation** from lecture content
- **Downloads** on each lecture: original audio, transcript as `.txt`, summary as `.md`
- **Usage tracking** -- classes, lectures, and audio duration per user
- **Admin panel** -- manage users, roles, and moderate content

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS (+ Typography), react-markdown, remark-gfm, Clerk React SDK |
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
│   │   │   ├── MarkdownBody.tsx # Summary Markdown → prose-styled HTML
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
| `ALLOWED_ORIGINS` | CORS origins: **comma-separated** URLs (simplest in production), or a **JSON array** string, e.g. `["https://app.example.com"]` | `http://localhost:5173` |

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
- For **`ALLOWED_ORIGINS`**, prefer a **comma-separated** list (no JSON): `https://a.com,https://b.com` — avoids quoting issues with systemd. JSON arrays are still supported if every origin is a JSON string (e.g. `["https://a.com"]`).

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
ALLOWED_ORIGINS=https://your.domain
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

nginx sits in front of everything users hit in the browser:

- **Static files** — Serves the Vite build from **`/srv/brainrip/frontend/dist/`** (HTML, JS, CSS, assets).
- **API** — Proxies **`/api/...`** to **uvicorn** on **`127.0.0.1:8000`**, so the SPA and API share the **same origin** once you use HTTPS (e.g. `https://brainrip.app` and `https://brainrip.app/api/...`). That matches a typical production **`VITE_API_URL`** (empty string) and avoids extra CORS setup.

#### Recommended sequence (follow in order)

1. **DNS** — Point your domain at this server’s public IP (see prerequisites in **[Certbot and Let’s Encrypt](#13-certbot-and-lets-encrypt)**).
2. **HTTP-only nginx (this section)** — Configure **`listen 80;`** only. **Do not** reference **`/etc/letsencrypt/...`** yet — those files do not exist until Certbot creates them, and **`nginx -t` will fail** if `ssl_certificate` points at missing paths.
3. **Certbot (§13)** — Run **`certbot --nginx`**. It obtains certificates and **edits** nginx to add **`listen 443 ssl`**, certificate paths, and usually **HTTP → HTTPS** redirect.
4. **Done** — Users visit **`https://your.domain`**. Open port **443** on the firewall after HTTPS works.

**Do not** create fake PEM files under **`/etc/letsencrypt/`** to satisfy nginx. Use HTTP first, then Let’s Encrypt.

#### Why `root` must be only `dist/`

Point **`root`** at **`frontend/dist/`** only. Do **not** use **`/srv/brainrip`** (the repo) as the document root: that could expose **`.git`**, Python source, **`backend/`**, env examples, etc.

#### What each block does

| Directive / block | Purpose |
|-------------------|--------|
| **`root`** | Directory nginx searches for files to serve for this `server`. Only the built SPA should live here. |
| **`index index.html`** | Default file when a path is a directory. |
| **`location /api/`** | Requests whose path starts with **`/api/`** go to the FastAPI app. **`proxy_pass http://127.0.0.1:8000;`** forwards to uvicorn **without** stripping the path, so `/api/health` becomes `http://127.0.0.1:8000/api/health`. |
| **`location /files/`** | Uploaded lecture audio is served by FastAPI at **`/files/...`** (**`StaticFiles`**). You must proxy this the same way as **`/api/`**. If you omit it, **`location /`** **`try_files`** does not find a file and serves **`index.html`** for **`/files/...`**, so the **`<audio>`** player breaks (works locally because Vite proxies **`/files`** — see **`frontend/vite.config.ts`**). |
| **`proxy_set_header Host`** | Sends the browser’s hostname to the backend (useful for logs and any host-aware logic). |
| **`X-Forwarded-For`** | Client IP chain when nginx is the reverse proxy. |
| **`X-Forwarded-Proto`** | After TLS (post-Certbot), tells the app the original scheme was **`https`**. |
| **`client_max_body_size`** | Default is often **1m**; lecture audio uploads exceed that and nginx returns **413 Payload Too Large** before the request reaches FastAPI. Set in **`server { }`** (e.g. **`100m`**) so **`/api/...`** uploads are allowed. |
| **`location /`** | Everything else is treated as the SPA. **`try_files $uri $uri/ /index.html;`** serves real files if they exist (e.g. **`/assets/...`**) and otherwise falls back to **`index.html`** so client-side routing (React Router) works on refresh and deep links. |

#### Step A — Example `server { ... }` (HTTP only, port 80)

Use this **first**. Replace **`server_name`** with your real domain(s). There are **no** `ssl_*` directives.

```nginx
server {
    listen 80;
    server_name brainrip.app www.brainrip.app;

    # Lecture audio uploads; nginx default (~1m) causes 413 without this.
    client_max_body_size 100m;

    root /srv/brainrip/frontend/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /files/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

#### Step B — Install the site on Ubuntu (Debian-style layout)

The filename is arbitrary. Common choices:

| Filename | Full path example |
|----------|-------------------|
| **`brainrip`** (no extension) | `/etc/nginx/sites-available/brainrip` |
| **`brainrip.conf`** | `/etc/nginx/sites-available/brainrip.conf` |

Both work the same; use **the same name** in **`sites-enabled`** when you create the symlink.

1. Create the file, e.g.:

   ```bash
   sudo nano /etc/nginx/sites-available/brainrip.conf
   ```

   Paste the **HTTP-only** block from **Step A** (adjust **`server_name`** and paths if needed).

2. Enable it by symlinking into **`sites-enabled`** (target and link name must match your file):

   ```bash
   sudo ln -sf /etc/nginx/sites-available/brainrip.conf /etc/nginx/sites-enabled/brainrip.conf
   ```

   If you used **`brainrip`** without **`.conf`**:

   ```bash
   sudo ln -sf /etc/nginx/sites-available/brainrip /etc/nginx/sites-enabled/brainrip
   ```

3. Confirm nginx will load it — the main config should **`include`** sites-enabled (default on Ubuntu):

   ```bash
   grep -R include /etc/nginx/nginx.conf /etc/nginx/conf.d/ 2>/dev/null
   ```

   You should see something like **`include /etc/nginx/sites-enabled/*;`**.

4. Remove or disable the default site if it still owns port **80** (otherwise your **`server_name`** may never match):

   ```bash
   sudo rm /etc/nginx/sites-enabled/default
   ```

5. Test and reload:

   ```bash
   sudo nginx -t && sudo systemctl reload nginx
   ```

If your distro uses **`/etc/nginx/conf.d/*.conf`** only (no **`sites-available`**), put **`brainrip.conf`** in **`/etc/nginx/conf.d/`** instead — same **`server { }`** content; no symlink step.

#### If the browser shows nothing / times out but `nginx -t` is OK

Syntax is valid; the problem is usually **routing**, **firewall**, or **which `server` handles the request**.

| Check | Command or action |
|-------|-------------------|
| **Site enabled?** | `ls -la /etc/nginx/sites-enabled/` — you should see **`brainrip.conf`** (or your name) → **`../sites-available/...`**. |
| **nginx listening on 80?** | Run **`sudo ss -tlnp`** and look for **`:80`** — expect **`0.0.0.0:80`** or **`[::]:80`**, not only **`127.0.0.1:80`**. |
| **Local test** | On the server: `curl -sSI http://127.0.0.1/ -H 'Host: your.domain'` — expect **200** or **301/302**, not **connection refused**. |
| **Host header** | **`server_name`** in the file must match how you open the site (**`http://brainrip.app`**, not only the raw IP, unless you add a **`default_server`** or a **`server_name _;`** catch‑all for testing). |
| **Ubuntu firewall** | `sudo ufw status` — if active, **`sudo ufw allow 'Nginx Full'`** or **`sudo ufw allow 80/tcp`**. |
| **Cloud firewall** | GCP / AWS / etc. security group must allow **inbound TCP 80** (and **443** after HTTPS) to the VM’s **public** IP. |
| **Built frontend exists?** | `ls /srv/brainrip/frontend/dist/index.html` — **`root`** must point at **`dist/`** after **`npm run build`**. |

After changing firewall or site files: **`sudo nginx -t && sudo systemctl reload nginx`**.

#### Step C — Verify HTTP before Certbot

With nginx and **`brainrip-backend`** running, and **DNS** already pointing at this host:

```bash
curl -sS http://127.0.0.1:8000/api/health
curl -sSI http://127.0.0.1/ -H 'Host: brainrip.app'
```

From your **laptop**, open **`http://brainrip.app`** (or your domain) and confirm the SPA and API work over plain HTTP.

**Firewall:** For the default Let’s Encrypt **`http-01`** challenge, **TCP 80** must reach this host from the internet. You can add **TCP 443** once HTTPS is configured in §13.

**Next:** **[Certbot and Let’s Encrypt](#13-certbot-and-lets-encrypt)** — obtain certificates and upgrade the same `server` to HTTPS (do not hand-edit **`ssl_certificate`** paths until Certbot has created the files).

### 13. Certbot and Let’s Encrypt

Run this **after** **[§12 nginx](#12-nginx)** — you should already have **HTTP-only** nginx working and have checked **`http://your.domain`** in a browser.

[Let’s Encrypt](https://letsencrypt.org/) issues free TLS certificates. [Certbot](https://certbot.eff.org/) is the usual client on Ubuntu; the **nginx** plugin obtains certs and **edits** your nginx config (you normally **do not** paste `ssl_certificate` paths by hand).

#### Before you run Certbot

1. **DNS** — **`A`** (and **`AAAA`** if you use IPv6) records for your hostname(s) must resolve to this server’s public IP (same as §12).
2. **HTTP site works** — **`sudo nginx -t`** passes and **`http://your.domain`** loads the SPA from **`/srv/brainrip/frontend/dist`** and **`/api/...`** proxies to uvicorn.
3. **Firewall** — Inbound **TCP 80** must be allowed for the default **`http-01`** validation. Open **TCP 443** as well once HTTPS is live (or open **443** before running Certbot if you prefer; Certbot still needs **80** for the initial `http-01` flow unless you use DNS validation).

#### Install Certbot (Ubuntu)

```bash
sudo apt update
sudo apt install -y certbot python3-certbot-nginx
```

#### Obtain a certificate (nginx plugin)

This **creates** files under **`/etc/letsencrypt/live/<domain>/`** and **updates** your nginx **`server`** blocks: adds **`listen 443 ssl`**, **`ssl_certificate`** / **`ssl_certificate_key`**, and usually redirects **port 80 → HTTPS**. Replace the domain(s) with yours:

```bash
sudo certbot --nginx -d brainrip.app -d www.brainrip.app
```

Follow the prompts: agree to terms, optionally share an email for expiry notices, choose whether to redirect HTTP to HTTPS (recommended: **Yes**).

Certificates and keys are stored under **`/etc/letsencrypt/live/brainrip.app/`**:

| File | Role |
|------|------|
| **`fullchain.pem`** | Full certificate chain — Certbot sets **`ssl_certificate`** to this path |
| **`privkey.pem`** | Private key — Certbot sets **`ssl_certificate_key`** to this path |

**After Certbot**, your site file may look like the following (Certbot may split **`server`** blocks; exact layout can vary). You only need to **hand-edit** this if you change **`root`** or **`proxy_pass`** later — certificate paths are maintained by **`certbot renew`**.

```nginx
server {
    listen 443 ssl http2;
    server_name brainrip.app www.brainrip.app;

    ssl_certificate     /etc/letsencrypt/live/brainrip.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/brainrip.app/privkey.pem;

    client_max_body_size 100m;

    root /srv/brainrip/frontend/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /files/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Verify in a browser: **`https://brainrip.app`**. Use devtools → Network to confirm API calls go to **`https://.../api/...`**.

#### Renewal

On Ubuntu, **systemd** usually enables **`certbot.timer`** so certificates renew automatically before expiry:

```bash
sudo systemctl status certbot.timer
```

Test renewal without touching live certs:

```bash
sudo certbot renew --dry-run
```

If renewal fails, fix DNS/firewall/nginx first; Let’s Encrypt certs are short-lived (~90 days), so a working timer matters.

#### Obtain a certificate without letting Certbot edit nginx (optional)

If you prefer to keep full control of **`server { }`** blocks:

```bash
sudo certbot certonly --webroot -w /srv/brainrip/frontend/dist -d brainrip.app -d www.brainrip.app
```

You must serve **`/.well-known/acme-challenge/`** from that webroot (or use another challenge type). Most teams use **`sudo certbot --nginx`** instead.

#### Staging (testing only)

Let’s Encrypt has a **staging** CA with higher rate limits for experiments; certificates are **not** trusted by browsers. Use **`--test-cert`** or Certbot’s staging flags while learning—then repeat without staging for real certs.

### 14. Deploy checklist (each release)

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
