# TracePilot

> **Developer-Focused AI Agent & RAG Observability Platform**

TracePilot provides end-to-end observability, execution tracing, token cost attribution, and evaluation for AI agents and Retrieval-Augmented Generation (RAG) pipelines.

---

## Architecture Overview

TracePilot is engineered around four core layers:
1. **Python SDK (`tracepilot`)**: Sub-millisecond context propagation (`contextvars`) and lock-free in-memory ring buffering with background daemon batch flushing.
2. **High-Throughput Ingestion Gateway**: FastAPI async endpoints backed by Redis Stream/Queue buffer for low-latency batch acceptance (`<10ms`).
3. **Data & Analytics Engine**: PostgreSQL 16 schema with composite indexing and JSONB payloads, paired with a dynamic model pricing matrix.
4. **Developer Dashboard**: High-density, dark navy developer console built with Next.js 14, Tailwind CSS, shadcn/ui, and Recharts.

---

## Development Roadmap & Status

- [x] **Architecture & Design Blueprint** (Approved)
- [x] **Phase 1: Foundation, Multi-Tenancy & API Keys** (Completed & Tested)
  - [x] Docker Compose setup (Postgres 16, Redis 7).
  - [x] Modular FastAPI backend & Alembic async migrations.
  - [x] User auth (JWT + bcrypt), Organizations, Projects, and RBAC memberships.
  - [x] Cryptographic API key management (SHA-256 with prefix indexing & Redis caching).
  - [x] Automated tenant isolation test suite passing (81% test coverage).
- [ ] **Phase 2: Ingestion Pipeline & Python SDK**
- [ ] **Phase 3: Dashboard & Trace Explorer**
- [ ] **Phase 4: LLM Analytics & RAG Observability**
- [ ] **Phase 5: Evaluation Engine & Datasets**
- [ ] **Phase 6: Hardening, Performance Testing & Deployment**

---

## Quickstart (Local Development)

### Prerequisites
- Python 3.11+
- uv (or pip)
- Docker & Docker Compose (optional for local SQLite mode)

### 1. Environment Setup
```bash
cp .env.example .env
```

### 2. Run Backend
```bash
cd backend
uv venv
uv pip install -e ".[dev]"
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --port 8000
```
