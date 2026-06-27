# Proxy Payroll Runbook

## URL Contract

- Frontend proxy entry: `/upah`
- Frontend assets: `/upah/assets/*` and `/upah/images/*`
- Backend API through gateway: `/backend/upah/*`
- Payroll API through gateway: `/backend/upah/payroll/*`
- Local development API remains relative: `/payroll/*`

`frontend/src/utils/apiBase.js` is the canonical URL resolver. Explicit backend env values win. Proxy mode is selected when `VITE_PROXY_MODE=true`, browser path starts with `/upah`, or gateway port is `3001`.

## Env Rules

- For gateway/proxy deployment, do not set `VITE_BACKEND_URL` unless the frontend must bypass the proxy intentionally.
- Use `VITE_PROXY_MODE=true` for local proxy-mode smoke tests.
- Existing production build base remains `/upah/`.
- `VITE_BACKEND_URL`, `VITE_API_URL`, `VITE_API_BASE_URL`, and `VITE_BACKEND_BASE` are treated as explicit overrides and have trailing slashes trimmed.

## Smoke Checklist

1. Open `GET /upah` and confirm HTML loads.
2. Open one generated JS/CSS asset under `/upah/assets/*`; expect `200` and JS/CSS content type.
3. Open `GET /backend/upah/health`; expect `200` and `{ "status": "ok" }`.
4. Open `GET /backend/upah/payroll/locked/verify` without auth; expect `401`.
5. Open `GET /backend/upah/payroll/locked/verify` with gateway bearer token; expect `200` and `valid: true`.
6. Open `GET /backend/upah/payroll/premium-definitions` with auth; expect `200` and `success: true`.
7. Open `GET /backend/upah/payroll/report/division-raw-tree/stream?division_code=<DIV>&month=<M>&year=<Y>` with auth; expect SSE events, not HTML.

## Failure Signs

- API call returns `index.html`: frontend is using wrong base URL or proxy did not route `/backend/upah`.
- `/backend/upah/payroll/locked/verify` returns `404`: backend is stale or route group not mounted.
- Payroll screen loads forever for more than 45 seconds: stream idle watchdog should show retry/fallback; check browser Network for stalled SSE.
- Repeated redirect to login: gateway token is expired or not shared to frontend localStorage/cookie as expected.
- Server logs `Slow stream` or `Timeout boundary reached`: query/extractor path exceeded expected latency; inspect DB gateway and selected division/month.

## Rollback Notes

- Revert `apiBase` usage first if proxy URL resolution causes unexpected local behavior.
- Remove `/backend/upah` group only after proxy gateway no longer depends on that prefix.
- Keep `/payroll/locked/verify`; AuthContext uses it to avoid zombie sessions and endless loading.