# Issues #1–#8 repair report

## Scope and isolation

An independent clone and branch `fix/issues-2-8` protected existing work. Main remained `7d1a9231813bf367018049b54855763b4f98a54d` during implementation and review. README was read; no AGENTS.md, .agents directory or repository SKILL.md was present. The user subsequently authorized PR creation, review, merge after passing checks, and deletion of the merged remote branch. [PR #9](https://github.com/mllt992/ai-test-dashboard/pull/9) records publication and its eventual merge outcome. Release and deployment remain excluded.

## Issue coverage

| Issue | Implemented | Verification and remaining acceptance |
| --- | --- | --- |
| #1 | Deployment/identity decisions documented; server authorization unchanged | Keep open. No provider, credential or persistent access policy invented; no auth-center connection. |
| #2 | Correct local import, composable seeded fixture, dual-entry check | Local tests and actual Deno/Vite proxy smoke passed; local-development acceptance complete. |
| #3 | Stateless initialize/initialized/ping, typed schemas and pre-write validation | Six MCP tests including official SDK Streamable HTTP handshake and two-case/screenshot batch passed. SDK transport is an in-process HTTP adapter. |
| #4 | Atomic latest-case state, immutable history, timestamp/UUID ordering and RLS-safe deletion | SQL and real multi-connection submissions/deletion passed. Keep open for logged-in browser refresh of cases, overview and dashboard. |
| #5 | Solution → fixed, retest → verified/reopened, reopened repair and illegal-transition rejection | REST/MCP/SQL and real competing transactions passed. Keep open for logged-in repair/retest browser acceptance. |
| #6 | Explicit lifecycle status and finished_at; metadata edits preserve completion time | SQL lifecycle and frontend DTO tests passed. Keep open for refreshed browser badges/counts/filters; historical completion times remain unknown rather than inferred from updated_at. |
| #7 | Exact Unicode log persistence/read/display, 65,536-code-point limit and failure-retained form | SQL and DTO round-trip/size/rejection tests passed. Keep open for logged-in browser detail/defect display and failed-save retention. |
| #8 | Project SQL summaries, scoped bounded history pages, exact result lookup, on-demand trace | Multi-project/full-count tests, 100/100/5 pages over 205 rows and byte comparison passed. Incremental UI/keyset paging remain follow-ups. |

## Verification

Toolchain: Node 22.22.0, Deno 2.7.9. Development dependencies added: PGlite, official MCP SDK and pg; existing locked dependency versions preserved.

- PASS: local npm test: 33 passed, 0 failed, 1 explicitly skipped real-PostgreSQL suite without a local opt-in service.
- PASS: [PR CI](https://github.com/mllt992/ai-test-dashboard/actions/runs/37301659782), head `7d0f4dfcfa5bbc7a20b9336393b6a9e4964ea85b`: installation, local tests, real PostgreSQL, Function checks, TypeScript/build and clean tracked files.
- PASS: PostgreSQL 17 applies both migrations to a disposable minimal contract schema. Twelve subtests (13 TAP passes including parent), 0 failures/0 skips. Three backend connections observe actual lock waits for six races, plus rollback, synthetic case/result RLS, Unicode logs, run completion, immutable history, project isolation and multi-page aggregates.
- PASS: local dual-entry Function check and build including pages/store TypeScript. Approximately 918 KB minified JS chunk warning remains non-blocking.
- PASS: actual Function/Vite loopback proxy health, project_list, project+plan case_list, run+case result_list and project dashboard_stats return 200.
- PASS: independent review/replay; fixture/schema drift, cascades/hidden parents, result-RLS deletion and lowercase ISO findings fixed and tested. Added-line secret-pattern scan: zero matches (limited pattern check).
- CONTROLLED COMPARISON: three projects/212 results. Overview previously made nine page-data requests including three identical full-history transfers; now three summary requests and zero history transfers. History bodies: 2,018,640 bytes before, approximately 8.5 KB summary bodies after. Project-list traffic/headers excluded; no production latency claim.
- BROWSER: local login page loaded. No existing authenticated local tab; protected-page interactions not executed. No demonstration password entered or new account created. Temporary servers/tab stopped.
- NOT EXECUTED: production gateway/auth, real deployment schema/RLS/trigger compatibility, migration rollout or deployment. PGlite alone does not prove concurrency; the separate PostgreSQL service provides the reported multi-connection evidence.

## Deployment prerequisites and limits

The repository has no production schema export. A database owner must review actual UUID/text/timestamp/JSON contracts, RLS permissions and existing triggers, validate a disposable copy/staging schema, then apply 001 and 002 in order with an approved rollout. No production database, paid model API, production setting or credential was used/changed. Migrations add no grants, RLS policies or SECURITY DEFINER authority. Missing RPCs return 503 without a sequential-write fallback.

Under active case RLS an absent and a hidden parent cannot be distinguished, so deletion rolls back, including some case/project cascades. Removing non-current history leaves the current case pointer unchanged. Removing the current result requires unfiltered history; active result RLS rejects/rolls back even a seemingly permissive policy. Runtime-role/cascade behavior and any maintenance authority require separate schema-owner review. See [migration requirements](../migrations/README.md).

Stable offset pages can shift under concurrent insertion/deletion. Compatibility getTestResults still walks all scoped pages, notably on the execution screen. Other entity lists retain their existing non-paged contracts; summaries do not depend on those lists or a first result page.

#1 requires deployment mode, approved identity-provider integration and authoritative membership/key revocation semantics; see [authentication decisions](authentication-decisions.md). Existing embedded demonstration login behavior is not a production credential. Its value is intentionally absent.