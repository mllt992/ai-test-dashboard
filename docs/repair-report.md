# Issues #1–#8 repair report

## Isolation and baseline

Repository: mllt992/ai-test-dashboard. An independent clone and local branch `fix/issues-2-8` were used; no pre-existing checkout or uncommitted changes were touched. The start and pre-delivery remote main checks both resolved to `7d1a9231813bf367018049b54855763b4f98a54d`; only remote main was present, and no open PR was found at the initial check. README was read; no AGENTS.md, .agents directory or repository SKILL.md was present.

## Coverage

| Issue | Outcome in this repair | Evidence / rollout requirement |
| --- | --- | --- |
| #1 | Blocked on deployment and identity decisions; responsibility boundaries documented | docs/authentication-decisions.md; no provider/credential/access policy invented |
| #2 | Local import fixed; awaitable seeded query fixture; local entry included in check script | local.test.mjs and actual Deno/Vite proxy smoke |
| #3 | Stateless MCP initialize/initialized/ping, schemas and pre-write validation; shared REST business dispatch | 6 MCP tests, including official SDK handshake and two-case/screenshot batch |
| #4 | Atomic current case status, immutable history, latest timestamp/UUID tie breaker, older arrivals preserved | business tests, migration001, rollback/order/delete/cascade and synthetic RLS regression; true multi-session contention not tested |
| #5 | Solution -> fixed, retest -> verified/reopened, reopened repair path, illegal bypass rejected | shared REST/MCP and SQL state-machine tests plus frontend contract test |
| #6 | Explicit running/completed state, independent finished_at, metadata updates preserve timestamp | SQL lifecycle and DTO tests; existing completion history not guessed |
| #7 | Full error log write/read/display, exact multiline Unicode preservation, explicit 65,536-code-point rejection, save failure retains form | SQL and DTO round-trip/size/failure tests; browser interaction not exercised |
| #8 | Project SQL aggregates, no repeated global result downloads, bounded scoped history API and result lookup, on-demand defect trace | multi-project/205+7-result test, 100/100/5 pages, tie ordering, empty project, exact result lookup |

## Verification

Local toolchain: Node 22.22.0, Deno 2.7.9; temporary runtimes outside the checkout. `npm ci` used the lockfile; only PGlite and official MCP SDK development dependencies were added, with no existing locked package version changed.

- PASS: npm test, 31 tests, 0 failures/0 skipped. Includes actual PostgreSQL SQL semantics through disposable PGlite; tests do not contact a real database or paid model service.
- PASS: npm run check:function, both functions/index.ts and dev/function-local.ts.
- PASS: npm run build including expanded TypeScript pages/store checks. Vite warns of a ~918 KB minified JS chunk; this is non-fatal and not addressed in this issue batch.
- PASS: npm run dev:function starts at 127.0.0.1:8000; Vite proxy at 127.0.0.1:5173 returns 200 for health (42 bytes), project_list (116), project+plan case_list (264), run+case result_list (55), project dashboard_stats (793).
- PASS: git diff --check and independent targeted review. Review uncovered schema drift, missing local aggregate fixture, cascade deletion and hidden-parent/RLS deletion edge cases; fixes have regression coverage.
- CONTROLLED COMPARISON: 3 projects, 212 result records. Previous overview topology: 9 page-data requests including 3 identical full-history transfers. New topology: 3 summary requests, 0 full-history transfers. Full-history body bytes alone: 2,018,640 before, approximately 8.5 KB total summary bodies after. Project-list traffic and HTTP headers excluded; not a production latency benchmark.
- NOT EXECUTED: interactive browser form flows, production gateway/auth/RLS, real database schema compatibility and multi-connection PostgreSQL lock contention. PGlite queues concurrent JS calls on one connection.

## Remaining work and limits

Issue #1 requires the deployment mode, identity provider, authoritative roles/project membership, key persistence/revocation semantics and demo/data isolation decisions. An embedded demonstration login remains existing source behavior; it must not be used as a production credential. Its value is not recorded in this report.

Migrations are source deliverables only. A database owner must review actual UUID/text/timestamp/JSON column contracts, RLS permissions and existing triggers, test a disposable copy/staging schema, then apply 001 and 002 in order with an approved rollout. No grants/RLS/credentials/production settings were changed. Under active RLS, absent and hidden parent cases cannot be distinguished: deletion fails and rolls back, including some case/project cascades. The database owner must approve and validate any separate maintenance authority; none is granted here. Missing migration RPCs return 503; the code does not silently downgrade to unsafe sequential writes. See migrations/README.md.

History uses stable sort with offset paging; concurrent insert/delete operations can shift page boundaries. Compatibility `getTestResults` still walks all pages inside its scope (notably the execution screen), so incremental history UI and snapshot/keyset paging remain scalability follow-ups. Lists for projects/plans/cases/defects/solutions/retests retain their pre-existing non-paged contract; aggregate summaries do not depend on those lists or the first result page.

No branch push, PR creation, issue closure, merge, release or deployment was performed. The exact publication proposal is a draft PR from `mllt992/ai-test-dashboard:fix/issues-2-8` to `mllt992/ai-test-dashboard:main`; docs/draft-pr.md contains the proposed title and body. Publication authorization is left to the coordinating task.
