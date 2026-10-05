# Draft PR proposal

Repository: https://github.com/mllt992/ai-test-dashboard
Base: main
Head: fix/issues-2-8 (local only; not pushed)
Title: fix: repair dashboard state, MCP contracts and project history
Draft: true

## Description

Fixes the broken local Function entry and query fixture, implements stateless MCP initialization and typed tool arguments, and restores shared REST/MCP result and defect persistence. PostgreSQL invoker RPCs and triggers atomically synchronize current case state and defect repair/retest states; a missing migration returns a safe failure. Runs use explicit lifecycle state and a dedicated completion time. Multiline Unicode error logs are persisted, displayed and retained in the form when saving fails.

Project pages now use full SQL aggregate summaries; result history supports bounded, project/run/case/result filters and stable ordering with next-offset metadata. Defect traceability loads the single related result on expansion. The local Function fixture and documented commands use no real database or credentials. Type checks now include pages and store.

Addresses #2, #3, #4, #5, #6, #7 and #8 at the code/local-verification level. #1 remains open pending deployment/identity-provider/project-permission/revocation decisions in docs/authentication-decisions.md.

## Validation

- 31 local automated tests pass: frontend DTO contracts, actual PGlite migration/business rollback/ordering/state behavior, official MCP SDK handshake, scoped multi-page aggregates and fixture smoke.
- npm run check:function passes for deployment and local entries.
- npm run build passes including TypeScript pages/store; Vite reports the existing large-chunk warning.
- Deno local service and Vite proxy return 200 for health, project_list, combined case/result filters and project dashboard_stats.
- Controlled 3-project/212-result comparison: repeated full-history response bodies total 2,018,640 bytes before, approximately 8.5 KB summary bodies after. Excludes unchanged project-list traffic and headers; no production performance claim.
- Independent review findings about schema drift, missing fixture summaries and cascade/RLS deletion were fixed and regression-tested.

## Rollout constraints

No production database, paid model API, production settings, credentials or persistent access were used/changed. No branch has been published and no PR, merge, release or deployment has happened. Review migrations/README.md against the actual schema, RLS and existing triggers, then apply 001 and 002 in order in an approved rollout. No grants or RLS policies are introduced by these migrations. Under active RLS, ambiguous missing-parent deletion fails and rolls back; case/project cascading deletion for a limited runtime role requires schema-owner review. Do not deploy this anonymous adapter as a protected multi-user service before #1 is resolved.

PGlite serializes concurrent submissions; true multi-connection PostgreSQL contention and deployed gateway/RLS behavior are not verified. Browser interactive flows have not been exercised. Offset page boundaries can shift under concurrent inserts; compatibility getTestResults still follows all pages within its scope. Incremental UI history/keyset pagination remain possible follow-up work.
