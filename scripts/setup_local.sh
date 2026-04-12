#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DB_NAME="burnathon"
DB_USER="postgres"
WHISPER_MODEL="${WHISPER_MODEL:-base}"

echo "=== Student Lecture Portal - Local Setup (Ubuntu 24.04 LTS) ==="

# ── Check system prerequisites ──────────────────────────────────────

check_cmd() {
  if ! command -v "$1" &>/dev/null; then
    echo "ERROR: $1 is not installed."
    echo "Run: sudo apt update && sudo apt install -y $2"
    exit 1
  fi
}

check_cmd python3 "python3.12 python3.12-venv"
check_cmd node "nodejs npm"
check_cmd psql "postgresql postgresql-contrib"

PYTHON_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
echo "Python: $PYTHON_VERSION"
echo "Node:   $(node --version)"
echo "psql:   $(psql --version | head -1)"

# ── Ensure PostgreSQL is running ────────────────────────────────────

if systemctl is-active --quiet postgresql; then
  echo "PostgreSQL service is running."
else
  echo "Starting PostgreSQL..."
  sudo systemctl start postgresql
  sudo systemctl enable postgresql
fi

# ── Create database if it doesn't exist ─────────────────────────────

if sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
  echo "Database '$DB_NAME' already exists."
else
  echo "Creating database '$DB_NAME'..."
  sudo -u postgres createdb "$DB_NAME"
  echo "Database created."
fi

# ── Backend setup ───────────────────────────────────────────────────

echo ""
echo "=== Setting up backend ==="
cd "$PROJECT_ROOT/backend"

if [ ! -d ".venv" ]; then
  echo "Creating Python virtual environment..."
  python3 -m venv .venv
fi

source .venv/bin/activate
echo "Installing Python dependencies..."
pip install --upgrade pip -q
pip install -r requirements.txt -q

echo "Downloading faster-whisper '$WHISPER_MODEL' model (first run only)..."
python3 -c "
from faster_whisper import WhisperModel
print('Loading model...')
model = WhisperModel('$WHISPER_MODEL', device='cpu', compute_type='int8')
print('Model ready.')
"

echo "Running database migrations..."
alembic upgrade head

# ── Frontend setup ──────────────────────────────────────────────────

echo ""
echo "=== Setting up frontend ==="
cd "$PROJECT_ROOT/frontend"

echo "Installing Node dependencies..."
npm install

# ── Done ────────────────────────────────────────────────────────────

echo ""
echo "=== Setup complete ==="
echo ""
echo "To run the app:"
echo "  Terminal 1: cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000"
echo "  Terminal 2: cd frontend && npm run dev"
echo ""
echo "Frontend: http://localhost:5173"
echo "API:      http://localhost:8000"
echo "API docs: http://localhost:8000/docs"
