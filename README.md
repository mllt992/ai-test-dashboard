# AI Test Dashboard

React/TypeScript/Vite dashboard with a Deno Function for REST and stateless MCP.

## Local development and verification

Use Node 22.12+ in the 22.x series and Deno 2.7+. From this directory:

```sh
npm ci
npm test
npm run check:function
npm run build
```

The type check includes `pages/` and `store/` as well as the frontend entry point. Tests run offline with an in-memory fixture and a disposable PGlite PostgreSQL database. The official MCP SDK is a development-only test dependency. No model API, real database, credentials or production configuration is needed. Initial dependency installation and Deno cache population require public package-registry access.

In separate terminals:

```sh
npm run dev:function
npm run dev
```

The Function binds `127.0.0.1:8000`. Vite serves its printed loopback port and proxies `/functions/v1/app`, including `/mcp`. The fixture in `dev/` contains a sample project, plan, case and running batch. It is ephemeral, uses no credentials and is excluded from the deployment directory. It is a development approximation; actual transaction semantics are tested against the SQL migrations.

Proxy smoke requests (use Vite's printed port):

```sh
curl --fail 'http://127.0.0.1:5173/functions/v1/app?action=health'
curl --fail 'http://127.0.0.1:5173/functions/v1/app?action=project_list'
curl --fail 'http://127.0.0.1:5173/functions/v1/app?action=case_list&projectId=00000000-0000-4000-8000-000000000001&planId=00000000-0000-4000-8000-000000000002'
curl --fail 'http://127.0.0.1:5173/functions/v1/app?action=result_list&runId=00000000-0000-4000-8000-000000000004&caseId=00000000-0000-4000-8000-000000000003'
```

## Database contract and rollout

Read [migration prerequisites](migrations/README.md). The repository does not contain a production schema export. `001_business_consistency.sql` and `002_dashboard.sql` must be reviewed against the actual schema, RLS and existing triggers, validated in a disposable copy/staging environment, then applied in order by the database owner. This repair does not apply them or deploy any changes. Missing RPCs fail safely with 503; there is no unsafe sequential-write fallback.

Current case state uses latest execution time, then result UUID descending as a deterministic tie breaker. Historical results remain immutable except screenshots. Saving a solution sets fixed; a passed retest sets verified, a failed retest sets reopened. New runs are running; explicit completion stamps `finished_at`; metadata edits preserve it. Error logs preserve multiline Unicode and allow 65,536 Unicode code points; oversize requests return 413.

`dashboard_stats` provides complete project summaries independently of history page size. `result_list` accepts `projectId`, `runId`, `caseId`, `resultId`, `offset` (default 0), `pageSize` (default 100, max 200), and returns `items`, `total`, `nextOffset`, `pageSize`. Results sort by `created_at DESC, id DESC`. Offset pages provide complete stable ordering for an unchanged dataset; concurrent inserts can shift page boundaries. Existing `getTestResults` follows all pages for compatibility; `getTestResultsPage` allows incremental callers. Project dashboards consume aggregate summaries and defect traceability loads only when expanded.

MCP supports initialize -> notifications/initialized -> tools/list -> tools/call using JSON over stateless Streamable HTTP. Supported protocol versions are 2025-11-25, 2025-06-18 and 2025-03-26. Notifications return empty 202; optional SSE GET returns 405. Tool schemas drive argument validation before writes and accept typed screenshot objects or legacy string references.

## Identity and deployment

Current browser-local login, roles and API keys are demonstration state, not server authorization. The anonymous adapter has no application identity or revocation chain. Read [the unresolved deployment/identity decisions](docs/authentication-decisions.md) before any real-data or multi-user deployment. Do not use local keys as evidence of server authentication or reuse the embedded demonstration login as a production credential.

Production artifacts are `dist/` and, where approved, `functions/`. Do not publish the project root, `dev/`, `tests/` or `node_modules/`. A successful local build does not verify deployed gateway policies, RLS or production migrations. No merge, release or deployment is part of this repair.

See `PROVENANCE.md` and `vendor/` for source attribution and preserved licenses.
