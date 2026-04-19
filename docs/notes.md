# Ops Notes

## Hosting on GCP Ubuntu 24.04 LTS Minimal

### IP forwarding -- **No**

You do **not** need to enable `net.ipv4.ip_forward` for this app.

Enable IP forwarding only if you're doing one of these:

- Running **Docker / Kubernetes / LXC** (Docker will flip `net.ipv4.ip_forward=1` itself; you don't have to).
- Acting as a **VPN endpoint** (WireGuard/OpenVPN server) or a **router/NAT box**.
- Setting up something like **Cloud NAT with a self-managed gateway**.

A web server that *terminates* connections (nginx in front, `uvicorn` behind, PostgreSQL locally) only needs to *receive* packets destined for it. `net.ipv4.ip_forward` is about forwarding packets from one interface to another -- a routing behavior, not a server behavior. Leaving it **off** is the more secure default and is what Ubuntu 24.04 ships with.

If you later run Docker for Postgres/Redis, don't set it manually -- Docker's `iptables` setup assumes it owns that sysctl. Just install Docker.

### CPU/RAM provisioning -- dominated by `faster-whisper`

For this specific app, the backend is mostly idle **except** when a lecture is being transcribed. Three things matter:

1. **faster-whisper model size** (`WHISPER_MODEL` in `backend/.env` -> `backend/app/services/transcription.py`).
2. **Concurrency** -- how many lectures transcribe simultaneously.
3. **CPU vs GPU** (`WHISPER_DEVICE`).

Rough footprint of `faster-whisper` with `compute_type=int8` on CPU (what the code defaults to for CPU in `backend/app/services/transcription.py`):


| Model            | RAM while transcribing | Transcribe speed on 2-4 vCPU     | Notes                             |
| ---------------- | ---------------------- | -------------------------------- | --------------------------------- |
| `tiny`           | ~0.5 GB                | ~10x realtime                    | Quality OK for clear audio.       |
| `base` (default) | ~0.7 GB                | ~5x realtime                     | Reasonable for lectures.          |
| `small`          | ~1.2 GB                | ~2x realtime                     | Noticeably better.                |
| `medium`         | ~2.5-3 GB              | ~0.5-1x realtime (CPU gets slow) | Practical only on 8+ vCPU or GPU. |
| `large-v3`       | ~5-6 GB                | **way under realtime on CPU**    | GPU recommended.                  |


Add the rest of the stack on top:

- **Postgres 16** idle: ~150-250 MB. Under normal app load: ~300-500 MB.
- `**uvicorn` + FastAPI** idle: ~100-150 MB per worker.
- **nginx / system**: ~100 MB.
- **Kernel / headroom**: leave 512 MB-1 GB free so the OOM killer doesn't come for you when Whisper loads its model.

### Concrete GCP instance picks

These assume Ubuntu 24.04 LTS Minimal, self-hosting everything (nginx, uvicorn, Postgres, uploads on SSD PD).

**Dev / demo / single user, `tiny` or `base`:**

- `**e2-small`** (2 vCPU, 2 GB RAM) -- works, but tight. Not recommended for more than smoke-testing.
- `**e2-medium**` (2 vCPU, 4 GB RAM) -- sweet spot for hobby/demo with `base` model. Roughly $25/mo on-demand, less with sustained-use discount.

**Small production, up to a handful of concurrent transcriptions, `base`/`small`:**

- `**e2-standard-2`** (2 vCPU, 8 GB RAM) -- comfortable for `small`. Solid default.
- `**n2-standard-2**` (2 vCPU, 8 GB RAM) -- same RAM, faster CPU (~20-30% faster on single-threaded Python) at a noticeable cost bump.

**"I want `medium` model quality without a GPU":**

- `**n2-standard-4`** or `**c2-standard-4**` (4 vCPU, 16 GB RAM). `c2-*` (Compute-Optimized) is ~2x the per-core throughput, which is exactly what Whisper benefits from.

**"I want `large-v3` / real-time-ish / many users":**

- CPU isn't the answer. Use `**n1-standard-4` + 1x NVIDIA T4** (or L4). Switch `WHISPER_DEVICE=cuda` and `compute_type=float16`. A T4 transcribes `large-v3` at roughly 5-10x realtime. Costs jump: ~$0.35/hr for the GPU on demand (T4), before the VM.

### Disk

- OS + backend + node_modules: ~5 GB.
- PostgreSQL: small to start, but plan for the database to hold transcripts + summaries + quizzes (text only, tiny).
- **Audio uploads**: the real consumer. Back-of-envelope: a 1-hour lecture as Opus/AAC is ~30-60 MB. 500 lectures ~ 15-30 GB.
- **Recommendation**: **50 GB Balanced Persistent Disk (pd-balanced)** on a dedicated volume mounted at `/var/lib/burn2/uploads`. Resize later; GCP PD supports online grow.

Avoid standard HDD PDs -- Whisper reads audio linearly at modest rates so it doesn't matter much, but Postgres does small random I/O, which is miserable on spinning disk.

### GCP-specific tips

- **Swap.** Ubuntu minimal ships with **no swap** on GCP. Add a ~2 GB swap file even with 8 GB RAM -- the occasional Whisper large-model load can spike, and a swap file is cheaper than OOM reboots.
- **Firewall.** Only expose **22, 80, 443** on the VPC firewall. Keep `8000` (uvicorn) and `5432` (Postgres) loopback-only. Put nginx in front; upstream it to `127.0.0.1:8000`.
- **Don't put Postgres data on the boot disk long-term.** Move `pg_data` to a dedicated `pd-balanced` disk so you can snapshot/restore/resize independently.
- **Consider Cloud SQL for Postgres** once this gets past hobby stage -- it moves backups, HA, and tuning off your plate for ~$7-15/mo minimum.
- **Cloud Run is not a great fit here** because transcription is a long-running background task (minutes to hours). A plain VM or a VM + Cloud Run Jobs for transcription works better.

### TL;DR

- **IP forwarding: off.** Not needed for this stack.
- **VM:** `e2-medium` (2 vCPU / 4 GB) for demo, `e2-standard-2` or `n2-standard-2` (2 vCPU / 8 GB) for small prod with the `base`/`small` Whisper model. Step up to 4 vCPU / 16 GB (`c2-standard-4`) for `medium`. Add a GPU only if you need `large-v3`.
- **Disk:** 50 GB `pd-balanced`, separate volume for uploads if you expect many lectures.
- **Swap:** add ~2 GB. **Firewall:** 22/80/443 only.
- **Tune `WHISPER_MODEL`** in `backend/.env` -- that one setting changes RAM/CPU requirements by 5-10x.

---

## Docker vs Kubernetes vs bare Ubuntu VM?

Short answer: **Docker (especially Docker Compose on a single VM) is a good upgrade over bare systemd; Kubernetes is usually overkill** for this app.

### What this app is

- One FastAPI backend (`uvicorn`).
- One PostgreSQL.
- One static SPA served by nginx.
- Heavy background work: faster-whisper (model cached in memory after first use).
- Typical scale: single developer, modest traffic.

That is a monolith with a database. Kubernetes solves problems monoliths often do not have.

### Option A -- Bare VM + systemd

**Pros**

- No container overhead. `uvicorn`, nginx, PostgreSQL run natively.
- GPU is straightforward: install NVIDIA driver once, set `WHISPER_DEVICE=cuda`.
- Easiest to debug: `journalctl`, `htop`, `pg_top`.
- Cheapest on CPU/RAM headroom.
- No extra daemon (`dockerd`) to maintain.

**Cons**

- Install steps are imperative; can drift from docs over time.
- Major upgrades (Python, Node, Postgres) are scarier on a live box.
- Dev vs prod drift (your laptop vs the server).
- Fewer guardrails (e.g. a bad upload filling `/tmp`).

**Best for:** one production box, you are comfortable with ops, no need to clone the environment everywhere.

### Option B -- Docker (Compose) on a single VM (recommended middle ground)

Run nginx, backend, and db as containers with one `docker-compose.yml`.

**Pros**

- **Reproducibility:** same image on WSL, CI, staging, prod.
- **Isolated runtimes:** backend gets its own Python 3.12 + deps; no conda/venv fights on the host.
- **Cleaner upgrades:** bump the base image in one place; roll back by tag.
- **Isolation:** backend cannot accidentally clobber Postgres data paths.
- **Backups:** named volumes for Postgres and uploads simplify backup/restore.
- **Onboarding:** `docker compose up` from the repo.

**Cons**

- Small performance overhead (usually a few percent).
- GPU needs [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html) and `--gpus all` in Compose.
- **faster-whisper model cache** should be a mounted volume (`~/.cache/huggingface` or similar) so you do not re-download multi-GB models on every container recreate.
- You manage `dockerd`.

**Best for:** most hobby-to-small-production web apps like this one.

### Option C -- Kubernetes (GKE, k3s, etc.)

**Pros**

- Rolling deploys, declarative desired state, HPA, self-healing pods.
- Multiple replicas behind a load balancer when you need them.
- Standard patterns for Ingress, TLS, metrics.

**Cons (for this app)**

- The monolith does not need multi-replica orchestration yet; systemd already restarts a crashed process.
- **Transcription is stateful:** Whisper keeps the model in memory; scaling replicas either duplicates heavy RAM use or needs shared/cache volumes (`ReadWriteMany` on GCP costs extra).
- **Postgres in-cluster** is its own specialty (StatefulSets, operators, backups). Many teams use **Cloud SQL** instead, so Kubernetes is only orchestrating the web tier -- heavy complexity for one service.
- **Cost floor:** managed GKE plus load balancer is often much more than a single VM with Compose.
- **Learning curve:** YAML, Helm, ingress, secrets, RBAC -- weeks to months to do well.
- **GPU on K8s** adds the GPU Operator, taints, tolerations.

**Best for:** many independent services, a platform team, multi-region HA, or regulatory requirements for managed K8s.

### "Do I need Kubernetes?" checklist

If you answer **no** to most of these, you probably do not need K8s yet:

- More than ~3 services deployed independently?
- Zero-downtime deploys many times per day?
- Multiple replicas of the same service behind a load balancer?
- A dedicated platform/DevOps owner for the cluster?
- Geo-distributed HA as a hard requirement?

### Cloud Run / serverless caveat

**Cloud Run** is awkward for this workload: request timeouts (default 5 min, max ~60 min) fight long transcriptions; cold starts reload the Whisper model. **Cloud Run Jobs** can run batch transcription but you pay model load per job unless you redesign caching. A VM (bare or Docker) fits the current architecture better.

### Practical recommendation


| Approach                   | Fit for this app                           | When to use                                                       |
| -------------------------- | ------------------------------------------ | ----------------------------------------------------------------- |
| **Bare VM + systemd**      | Good                                       | Ship quickly; single deploy target; you handle ops.               |
| **Docker Compose on a VM** | **Best for many small/medium deployments** | Reproducibility, dev/prod parity, clean upgrades without K8s tax. |
| **Kubernetes**             | Usually overkill                           | Many services, replicas, HA, or a team running the cluster.       |
| **Cloud Run (as-is)**      | Poor fit for long transcription            | Only after splitting work into jobs and rethinking caching.       |


Suggested path:

1. **Bare VM + systemd** if you need something running this week.
2. **Move to Docker Compose on the same VM** when you do a second deploy or tire of manual env setup.
3. **Kubernetes** only after you outgrow Compose (multiple services, real HA needs, or someone owns the cluster).

For Burnathon-style apps, **Docker Compose on something like an `e2-standard-2` VM** is a strong default: better isolation and reproducibility than raw systemd, without Kubernetes complexity.