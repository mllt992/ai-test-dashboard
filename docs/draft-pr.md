# PR description

Actual PR: https://github.com/mllt992/ai-test-dashboard/pull/9
Base: main
Head: fix/issues-2-8

Fix local Function import/query fixtures and MCP initialization/input schemas. REST/MCP share transactional result, solution and retest persistence. Case state follows latest execution timestamp/UUID; defects follow repair/retest outcomes. Runs use explicit lifecycle/completion time. Multiline Unicode logs persist, display and remain in failed-save forms. Project pages use complete project aggregates; history is scoped/bounded and defect trace details load on demand.

33 local tests pass; PostgreSQL suite explicitly skips without opt-in. PR CI passes with 12 PostgreSQL 17 subtests, three connections/six observed lock competitions, synthetic RLS, rollback, pages, Unicode and lifecycle checks. Function checks, expanded TypeScript/build, proxy smoke and independent review pass. Non-blocking approximately 918 KB chunk warning remains. Controlled overview bytes: 2,018,640 repeated history → approximately 8.5 KB summaries; not production performance data.

#1 stays open for deployment/identity decisions. #4/#5/#7 code/contracts are repaired but protected browser refresh/form/detail acceptance is unexecuted; those Issues stay open. #2/#3/#6/#8 meet source/local-contract acceptance. Compatibility history callers traverse all scoped pages; concurrent writes move offset boundaries.

No production database, auth-center, paid model API, production settings, credentials, release or deployment were used. Migrations 001/002 are submitted but not applied to production; schema-owner review must verify actual schema/RLS/triggers. SECURITY INVOKER preserves existing authority. Active case RLS can block ambiguous cascades; active history RLS rejects current-result deletion atomically. See repair-report.md, authentication-decisions.md and ../migrations/README.md.