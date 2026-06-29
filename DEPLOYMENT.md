# Deployment — Daftar Upah Refactor Production

> Branch: `server-dev-merger-1`. Live: `ptrjestate.rebinmas.com:3001` (proxy → backend :8002).

## Environments

| Env | Backend | Frontend | DB | SQL Gateway |
|---|---|---|---|---|
| **Local dev** | `bun run dev` :8002 | `npm run dev` :5173 | MSSQL via gateway | :8001 (start separately) |
| **Proxy/dev** | :8002 | `npm run dev:proxy` :5175 (simulates `/upah`) | gateway | :8001 |
| **Live** | :8002 (on live server) | `dist/` served by backend at `/upah` | MSSQL | :8001 (on live server) |

## Prerequisites (live server)

1. Bun installed on live server.
2. `.env` in `backend/` with: DB profiles (SERVER_PROFILE_1/2/3 hosts+creds), `API_KEY_BYPASS`, `DB_API_KEY`, `RUN_MODE=prod`, `ABSENSI_API_KEY`. Copy from `backend/.env.example` if present.
3. SQL Gateway running on :8001 (separate service, NOT in this repo).
4. MSSQL reachable from gateway for all 3 profiles.

## Local dev setup

```bash
# backend
cd backend
bun install
bun run dev          # :8002, watch mode

# frontend (separate terminal)
cd frontend
bun install
npm run dev          # :5173, HMR
```

Point frontend at local backend: `npm run dev` (Vite proxy → :8002). For LAN: `npm run dev:lan VITE_BACKEND_HOST=<server-ip>`.

## Build & deploy to live

```bash
# 1. Build frontend (produces dist/)
cd frontend
bun install          # ensure lockfile current
npm run build        # → frontend/dist/

# 2. Backend serves dist/ at /upah (no separate frontend deploy needed)
cd ../backend
bun install
bun run start        # :8002

# 3. Restart proxy gateway (ptrjestate.rebinmas.com:3001) if config changed
```

Backend reads `../frontend/dist/` relative to `backend/` — keep dir structure intact.

## Deploy via git (live server)

```bash
# on live server
cd <repo>
git fetch origin
git checkout server-dev-merger-1
git pull
cd frontend && bun install && npm run build
cd ../backend && bun install
# restart backend service (systemd/pm2/screen — whatever runs `bun run start`)
```

## Post-deploy verification

```bash
# health
curl http://localhost:8002/health
# → {"status":"ok","database":"db_ptrj","profile":"SERVER_PROFILE_2"}

# auth (live proxy)
T=$(curl -s -X POST http://ptrjestate.rebinmas.com:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin","password":"admin123"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# KPI parity local vs live (must match)
curl -s -H "Authorization: Bearer $T" \
  "http://ptrjestate.rebinmas.com:3001/upah/payroll/dashboard/executive-summary?month=6&year=2026" \
  | grep -o '"curr_wage":[0-9.]*'

# division filter (live should now reflect per-division after deploy)
curl -s -H "Authorization: Bearer $T" \
  "http://ptrjestate.rebinmas.com:3001/upah/payroll/dashboard/executive-summary?month=6&year=2026&division_code=PG1A" \
  | grep -o '"curr_wage":[0-9.]*'
# PG1A should differ from ALL (877M vs 9.7B). If live still shows 9.7B → deploy didn't take.
```

## Hard refresh (browser)

Production dist is cached by browser. After deploy, users must **Ctrl+Shift+R** (hard refresh) once to load new bundle. Backend serves hashed assets with immutable cache + precompressed br/gz.

## Rollback

```bash
# revert to previous commit
git log --oneline -10
git revert <bad-commit>
# or reset to known-good:
git reset --hard <known-good-sha>
cd frontend && npm run build
cd ../backend && # restart service
```

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Payroll endpoints 500 + `Invalid object name 'HR_GANG'` | Query on wrong DB profile (extend instead of db_ptrj) | See audit F23/F25; ensure query uses PROFILE_2 for HR_* tables |
| Payroll endpoints timeout 30s, light endpoints OK | SQL Gateway (:8001) down | Start gateway service on live server |
| Frontend shows old numbers after deploy | Browser cache OR dist not rebuilt | Hard refresh; verify `frontend/dist/index.html` mtime |
| `useCache is not defined` at runtime | Dead cache block leftover from merge | Remove `if (useCache...)` block (audit, fixed in recent commits) |
| KPI same across all divisions on live | Live backend pre-division-filter version | Deploy `server-dev-merger-1` (commits `d3653c8b`+) |
| TypeScript errors on `bun run start` but runs anyway | Bun ignores TS types; `bunx tsc --noEmit` to see | Fix type errors; Bun runtime still works |

## SQL Gateway dependency

Payroll extraction (PR_*/HR_* queries) routes Backend → SQL Gateway (:8001) → MSSQL. Gateway is a **separate service** not in this repo. If down:
- `/health`, `/payroll/current-period` (cached), `/payroll/divisions` still work
- `/payroll/report/*`, `/payroll/dashboard/executive-summary` (trend) timeout/fail

Start gateway before testing payroll endpoints locally.
