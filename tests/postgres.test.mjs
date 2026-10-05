import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { baselineSchema } from "./support/db.mjs";

// Never discover a deployment connection or fall back to a Supabase/PG env var.
// A dedicated service, exact loopback URL, explicit opt-in and empty database
// are all required before this suite can create its disposable contract schema.
function isolatedConfiguration() {
  const raw = process.env.PG_TEST_URL;
  if (!raw && process.env.DASHBOARD_TEST_DATABASE !== "1") return null;
  if (!raw || process.env.DASHBOARD_TEST_DATABASE !== "1") {
    throw new Error("PostgreSQL tests require both PG_TEST_URL and DASHBOARD_TEST_DATABASE=1");
  }
  let url;
  try { url = new URL(raw); } catch { throw new Error("Invalid isolated PostgreSQL test URL"); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)
    || url.hostname !== "127.0.0.1" || url.port !== "54329"
    || url.pathname !== "/dashboard_test" || url.search || url.hash
    || url.username !== "postgres" || url.password) {
    throw new Error("Refusing PostgreSQL tests: expected credential-free postgres on 127.0.0.1:54329/dashboard_test");
  }
  return { connectionString: raw, connectionTimeoutMillis: 5000 };
}

const configuration = isolatedConfiguration();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const projectId = id(1), caseId = id(2), runId = id(3), defectId = id(4);
const resultInput = (n, status, time) => ({
  id: id(n), run_id: runId, case_id: caseId, status, error_log: "",
  screenshots: [], created_at: time,
});

test("real isolated PostgreSQL: migrations, row locks, concurrency, rollback and synthetic RLS", {
  skip: configuration ? false : "PG_TEST_URL absent: real multi-connection PostgreSQL checks not executed",
  timeout: 120000,
}, async t => {
  // pg is loaded only after opt-in, so offline local tests remain self-contained.
  const { Client } = await import("pg");
  const admin = new Client(configuration);
  const first = new Client(configuration);
  const second = new Client(configuration);
  const clients = [admin, first, second];
  t.after(async () => {
    await Promise.allSettled(clients.map(async client => {
      await client.query("ROLLBACK").catch(() => {});
      await client.end();
    }));
  });
  try { await Promise.all(clients.map(client => client.connect())); }
  catch { throw new Error("Unable to connect to the dedicated loopback PostgreSQL test service"); }
  await Promise.all(clients.map(client => client.query("SET statement_timeout='15s'; SET lock_timeout='10s'")));
  assert.equal((await admin.query("SELECT current_database() AS name")).rows[0].name, "dashboard_test");
  const existing = (await admin.query("SELECT count(*) FROM pg_tables WHERE schemaname='public'")).rows[0].count;
  assert.equal(Number(existing), 0, "Refusing to overwrite a nonempty test database; recreate the disposable service");
  await admin.query(baselineSchema);
  // Seed a pre-migration result: verify 001's real backfill and 002's functions.
  await admin.query("INSERT INTO test_cases(id,project_id,status) VALUES($1,$2,'pending')", [caseId, projectId]);
  await admin.query("INSERT INTO test_runs(id,project_id,status) VALUES($1,$2,'running')", [runId, projectId]);
  await admin.query("INSERT INTO test_results(id,run_id,case_id,status,created_at) VALUES($1,$2,$3,'failed','2026-10-05T10:00:00Z')", [id(10), runId, caseId]);
  await admin.query(await readFile(new URL("../migrations/001_business_consistency.sql", import.meta.url), "utf8"));
  await admin.query(await readFile(new URL("../migrations/002_dashboard.sql", import.meta.url), "utf8"));

  const rpc = (client, name, input) => client.query(`SELECT public.${name}($1::jsonb) AS item`, [JSON.stringify(input)]);
  const state = async () => (await admin.query("SELECT status,latest_result_id FROM test_cases WHERE id=$1", [caseId])).rows[0];
  const defect = async () => (await admin.query("SELECT status FROM defects WHERE id=$1", [defectId])).rows[0].status;
  const count = async table => Number((await admin.query(`SELECT count(*) FROM public.${table}`)).rows[0].count);
  const reset = async () => {
    await admin.query("TRUNCATE retests,solutions,defects,test_results,test_cases,test_runs,test_plans,projects");
    await admin.query("INSERT INTO test_cases(id,project_id,status) VALUES($1,$2,'pending')", [caseId, projectId]);
    await admin.query("INSERT INTO test_runs(id,project_id,status) VALUES($1,$2,'running')", [runId, projectId]);
    await admin.query("INSERT INTO defects(id,project_id,status) VALUES($1,$2,'open')", [defectId, projectId]);
  };
  // Observe PostgreSQL's lock wait rather than assuming a Promise implies two
  // transactions overlapped. No sleeps longer than 20 ms, bounded by 5 seconds.
  const waitForLock = async client => {
    const started = Date.now();
    while (Date.now() - started < 5000) {
      const { rows } = await admin.query("SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1", [client.processID]);
      if (rows[0]?.wait_event_type === "Lock") return;
      await delay(20);
    }
    assert.fail("Second PostgreSQL connection never reached an observed row-lock wait");
  };
  // Keep rejection handled immediately, before inspecting the blocking session.
  const outcome = promise => promise.then(value => ({ ok: true, value }), error => ({ ok: false, code: error.code }));
  const race = async (firstWork, secondWork) => {
    await first.query("BEGIN");
    let pending;
    try {
      await firstWork(first);
      pending = outcome(secondWork(second));
      await waitForLock(second);
      await first.query("COMMIT");
      return await pending;
    } finally {
      await first.query("ROLLBACK");
      if (pending) await pending;
    }
  };

  await t.test("actual migrations backfill state and install invoker aggregate/page RPCs", async () => {
    assert.deepEqual(await state(), { status: "failed", latest_result_id: id(10) });
    const stats = (await admin.query("SELECT dashboard_stats($1) AS item", [projectId])).rows[0].item;
    assert.equal(stats.caseCount, 1);
    assert.equal(stats.failed, 1);
    const page = (await admin.query("SELECT dashboard_result_page($1,NULL,NULL,0,1,NULL) AS item", [projectId])).rows[0].item;
    assert.equal(page.total, 1);
    assert.equal(page.items[0].id, id(10));
    const funcs = (await admin.query("SELECT proname,prosecdef FROM pg_proc WHERE proname IN ('dashboard_submit_result','dashboard_add_solution','dashboard_create_retest','dashboard_stats','dashboard_result_page')")).rows;
    assert.equal(funcs.length, 5);
    assert.ok(funcs.every(row => row.prosecdef === false));
  });

  await t.test("real aggregate summaries and bounded pages cover all rows and isolate projects", async () => {
    await reset();
    await admin.query(`INSERT INTO test_results(id,run_id,case_id,status,duration_ms,created_at,error_log)
      SELECT ('00000000-0000-4000-8000-'||lpad((1000+i)::text,12,'0'))::uuid,$1,$2,
      CASE WHEN i%2=1 THEN 'failed' ELSE 'passed' END,1000,
      '2026-10-05T10:00:00Z'::timestamptz + i*interval '1 second',''
      FROM generate_series(1,205) i`, [runId, caseId]);
    await admin.query("INSERT INTO test_cases(id,project_id,status) VALUES($1,$2,'pending')", [id(5), id(6)]);
    await admin.query("INSERT INTO test_runs(id,project_id,status) VALUES($1,$2,'running')", [id(7), id(6)]);
    await rpc(admin, "dashboard_submit_result", { ...resultInput(1206, "passed", "2026-10-05T11:00:00Z"), run_id: id(7), case_id: id(5), duration_ms: 900 });
    const stats = (await admin.query("SELECT dashboard_stats($1) AS item", [projectId])).rows[0].item;
    assert.equal(stats.caseCount, 1);
    assert.equal(stats.failed, 1);
    assert.equal(stats.totalDuration, 205000);
    assert.equal(stats.recentResults.length, 20);
    const history = [];
    let offset = 0;
    do {
      const page = (await admin.query("SELECT dashboard_result_page($1,NULL,NULL,$2,100,NULL) AS item", [projectId, offset])).rows[0].item;
      assert.equal(page.total, 205);
      assert.ok(page.items.length <= 100);
      history.push(...page.items);
      offset = page.nextOffset;
    } while (offset !== null);
    assert.equal(history.length, 205);
    assert.equal(new Set(history.map(row => row.id)).size, 205);
    assert.equal(history[0].id, id(1205));
    const other = (await admin.query("SELECT dashboard_stats($1) AS item", [id(6)])).rows[0].item;
    assert.equal(other.totalDuration, 900);
    assert.equal(other.passed, 1);
    await assert.rejects(admin.query("SELECT dashboard_result_page(NULL,NULL,NULL,0,201,NULL)"), error => error.code === "22023");
  });

  await t.test("two connections serialize a waiting older result without replacing current state", async () => {
    await reset();
    const result = await race(
      client => rpc(client, "dashboard_submit_result", resultInput(20, "failed", "2026-10-05T12:00:00Z")),
      client => rpc(client, "dashboard_submit_result", resultInput(21, "passed", "2026-10-05T11:00:00Z")),
    );
    assert.equal(result.ok, true);
    assert.deepEqual(await state(), { status: "failed", latest_result_id: id(20) });
    assert.equal(await count("test_results"), 2);
  });

  await t.test("waiting newer result and equal-time UUID tie breaker see committed state", async () => {
    await reset();
    const result = await race(
      client => rpc(client, "dashboard_submit_result", resultInput(30, "failed", "2026-10-05T12:00:00Z")),
      client => rpc(client, "dashboard_submit_result", resultInput(31, "passed", "2026-10-05T13:00:00Z")),
    );
    assert.equal(result.ok, true);
    assert.deepEqual(await state(), { status: "passed", latest_result_id: id(31) });
    await rpc(admin, "dashboard_submit_result", resultInput(32, "blocked", "2026-10-05T13:00:00Z"));
    assert.deepEqual(await state(), { status: "blocked", latest_result_id: id(32) });
    assert.equal(await count("test_results"), 3);
  });

  await t.test("concurrent deletion recomputes the pointer after both row-lock holders commit", async () => {
    await reset();
    for (const n of [40, 41, 42]) await rpc(admin, "dashboard_submit_result", resultInput(n, n === 40 ? "passed" : "failed", `2026-10-05T${n - 30}:00:00Z`));
    const result = await race(
      client => client.query("DELETE FROM test_results WHERE id=$1", [id(42)]),
      client => client.query("DELETE FROM test_results WHERE id=$1", [id(41)]),
    );
    assert.equal(result.ok, true);
    assert.deepEqual(await state(), { status: "passed", latest_result_id: id(40) });
    assert.equal(await count("test_results"), 1);
  });

  await t.test("DELETE waiting on a case lock sees the INSERT committed after its statement began", async () => {
    await reset();
    await rpc(admin, "dashboard_submit_result", resultInput(43, "failed", "2026-10-05T10:00:00Z"));
    const result = await race(
      client => rpc(client, "dashboard_submit_result", resultInput(44, "passed", "2026-10-05T11:00:00Z")),
      client => client.query("DELETE FROM test_results WHERE id=$1", [id(43)]),
    );
    assert.equal(result.ok, true);
    assert.deepEqual(await state(), { status: "passed", latest_result_id: id(44) });
    assert.equal(await count("test_results"), 1);
  });

  await t.test("competing solution inserts commit exactly one record and one fixed transition", async () => {
    await reset();
    const input = n => ({ id: id(n), defect_id: defectId, title: "Fix" });
    const result = await race(
      client => rpc(client, "dashboard_add_solution", input(50)),
      client => rpc(client, "dashboard_add_solution", input(51)),
    );
    assert.deepEqual(result, { ok: false, code: "23514" });
    assert.equal(await defect(), "fixed");
    assert.equal(await count("solutions"), 1);
  });

  await t.test("competing passed/failed retests commit only one record and legal transition", async () => {
    await reset();
    await rpc(admin, "dashboard_add_solution", { id: id(60), defect_id: defectId, title: "Fix" });
    const result = await race(
      client => rpc(client, "dashboard_create_retest", { id: id(61), defect_id: defectId, status: "passed" }),
      client => rpc(client, "dashboard_create_retest", { id: id(62), defect_id: defectId, status: "failed" }),
    );
    assert.deepEqual(result, { ok: false, code: "23514" });
    assert.equal(await defect(), "verified");
    assert.equal(await count("retests"), 1);
  });

  await t.test("record constraints roll back trigger state changes and preserve exact Unicode logs", async () => {
    await reset();
    await admin.query("ALTER TABLE test_cases ADD CONSTRAINT pg_test_reject_failed CHECK(status <> 'failed')");
    try {
      await assert.rejects(rpc(admin, "dashboard_submit_result", resultInput(70, "failed", "2026-10-05T10:00:00Z")), error => error.code === "23514");
      assert.deepEqual(await state(), { status: "pending", latest_result_id: null });
      assert.equal(await count("test_results"), 0);
    } finally { await admin.query("ALTER TABLE test_cases DROP CONSTRAINT pg_test_reject_failed"); }
    await assert.rejects(rpc(admin, "dashboard_add_solution", { id: id(71), defect_id: defectId, title: null }), error => error.code === "23502");
    assert.equal(await defect(), "open");
    assert.equal(await count("solutions"), 0);
    await rpc(admin, "dashboard_add_solution", { id: id(72), defect_id: defectId, title: "Fix" });
    await admin.query("ALTER TABLE retests ADD CONSTRAINT pg_test_reject_notes CHECK(notes <> 'reject')");
    try {
      await assert.rejects(rpc(admin, "dashboard_create_retest", { id: id(73), defect_id: defectId, status: "passed", notes: "reject" }), error => error.code === "23514");
      assert.equal(await defect(), "fixed");
      assert.equal(await count("retests"), 0);
    } finally { await admin.query("ALTER TABLE retests DROP CONSTRAINT pg_test_reject_notes"); }
    const log = "第一行\n错误：断言失败 🧪\r\nlast\tline";
    await rpc(admin, "dashboard_submit_result", { ...resultInput(74, "failed", "2026-10-05T11:00:00Z"), error_log: log });
    assert.equal((await admin.query("SELECT error_log FROM test_results WHERE id=$1", [id(74)])).rows[0].error_log, log);
    await assert.rejects(rpc(admin, "dashboard_submit_result", { ...resultInput(75, "passed", "2026-10-05T12:00:00Z"), error_log: "🧪".repeat(65537) }), error => error.code === "23514");
    assert.equal(await count("test_results"), 1);
    assert.deepEqual(await state(), { status: "failed", latest_result_id: id(74) });
  });

  await t.test("run completion, immutable history and forbidden direct state edits enforce SQL contract", async () => {
    await reset();
    await rpc(admin, "dashboard_submit_result", resultInput(80, "passed", "2026-10-05T10:00:00Z"));
    await assert.rejects(admin.query("UPDATE test_results SET status='failed' WHERE id=$1", [id(80)]), error => error.code === "23514");
    await assert.rejects(admin.query("UPDATE test_cases SET status='failed' WHERE id=$1", [caseId]), error => error.code === "23514");
    assert.equal((await admin.query("SELECT finished_at FROM test_runs WHERE id=$1", [runId])).rows[0].finished_at, null);
    await admin.query("UPDATE test_runs SET status='completed' WHERE id=$1", [runId]);
    const finished = (await admin.query("SELECT finished_at FROM test_runs WHERE id=$1", [runId])).rows[0].finished_at;
    assert.ok(finished instanceof Date);
    await admin.query("UPDATE test_runs SET name='Edit',finished_at='2000-01-01' WHERE id=$1", [runId]);
    assert.equal((await admin.query("SELECT finished_at FROM test_runs WHERE id=$1", [runId])).rows[0].finished_at.getTime(), finished.getTime());
    await assert.rejects(admin.query("UPDATE test_runs SET status='running' WHERE id=$1", [runId]), error => error.code === "23514");
  });

  await t.test("synthetic restricted RLS invoker cannot delete history when its parent is hidden", async () => {
    await reset();
    await rpc(admin, "dashboard_submit_result", resultInput(90, "failed", "2026-10-05T10:00:00Z"));
    // This role has no login and exists only in the opted-in disposable service.
    await admin.query(`CREATE ROLE dashboard_pg_contract NOLOGIN;
      GRANT USAGE ON SCHEMA public TO dashboard_pg_contract;
      GRANT SELECT, UPDATE ON test_cases TO dashboard_pg_contract;
      GRANT SELECT, DELETE ON test_results TO dashboard_pg_contract;
      ALTER TABLE test_cases ENABLE ROW LEVEL SECURITY;
      CREATE POLICY pg_contract_hidden_case ON test_cases FOR ALL TO dashboard_pg_contract USING(false) WITH CHECK(false);`);
    try {
      await second.query("SET ROLE dashboard_pg_contract");
      assert.equal((await second.query("SELECT row_security_active('public.test_cases'::regclass) AS active")).rows[0].active, true);
      await assert.rejects(second.query("DELETE FROM test_results WHERE id=$1", [id(90)]), error => error.code === "23503");
      await second.query("RESET ROLE");
      assert.equal(await count("test_results"), 1);
      assert.deepEqual(await state(), { status: "failed", latest_result_id: id(90) });
      // Dynamic policy permits the parent before deletion, but hides it after
      // removing the last child; the after-trigger must roll the deletion back.
      await admin.query(`DROP POLICY pg_contract_hidden_case ON test_cases;
        CREATE POLICY pg_contract_dynamic_case ON test_cases FOR ALL TO dashboard_pg_contract
        USING(EXISTS(SELECT 1 FROM test_results WHERE case_id=test_cases.id))
        WITH CHECK(EXISTS(SELECT 1 FROM test_results WHERE case_id=test_cases.id));`);
      await second.query("SET ROLE dashboard_pg_contract");
      assert.equal(Number((await second.query("SELECT count(*) FROM test_cases")).rows[0].count), 1);
      await assert.rejects(second.query("DELETE FROM test_results WHERE id=$1", [id(90)]), error => error.code === "23503");
      await second.query("RESET ROLE");
      assert.equal(await count("test_results"), 1);
      assert.deepEqual(await state(), { status: "failed", latest_result_id: id(90) });
    } finally {
      await second.query("RESET ROLE");
      await admin.query(`DROP POLICY IF EXISTS pg_contract_hidden_case ON test_cases;
        DROP POLICY IF EXISTS pg_contract_dynamic_case ON test_cases;
        ALTER TABLE test_cases DISABLE ROW LEVEL SECURITY;
        DROP OWNED BY dashboard_pg_contract;
        DROP ROLE dashboard_pg_contract;`);
    }
  });

  await t.test("result RLS cannot erase a newer hidden pointer or partially recompute filtered history", async () => {
    await reset();
    await rpc(admin, "dashboard_submit_result", resultInput(100, "failed", "2026-10-05T10:00:00Z"));
    await rpc(admin, "dashboard_submit_result", resultInput(101, "passed", "2026-10-05T11:00:00Z"));
    await admin.query(`CREATE ROLE dashboard_pg_contract NOLOGIN;
      GRANT USAGE ON SCHEMA public TO dashboard_pg_contract;
      GRANT SELECT, UPDATE ON test_cases TO dashboard_pg_contract;
      GRANT SELECT, DELETE ON test_results TO dashboard_pg_contract;
      ALTER TABLE test_results ENABLE ROW LEVEL SECURITY;
      CREATE POLICY pg_contract_failed_history ON test_results FOR ALL TO dashboard_pg_contract
      USING(status='failed') WITH CHECK(status='failed');`);
    try {
      await second.query("SET ROLE dashboard_pg_contract");
      assert.equal((await second.query("SELECT row_security_active('public.test_results'::regclass) AS active")).rows[0].active, true);
      assert.deepEqual((await second.query("SELECT id FROM test_results")).rows.map(row => row.id), [id(100)]);
      await second.query("DELETE FROM test_results WHERE id=$1", [id(100)]);
      await second.query("RESET ROLE");
      assert.equal(await count("test_results"), 1);
      assert.deepEqual(await state(), { status: "passed", latest_result_id: id(101) });

      await reset();
      await rpc(admin, "dashboard_submit_result", resultInput(102, "passed", "2026-10-05T10:00:00Z"));
      await rpc(admin, "dashboard_submit_result", resultInput(103, "failed", "2026-10-05T11:00:00Z"));
      await second.query("SET ROLE dashboard_pg_contract");
      // Current row is visible, but history is filtered. Invoker cannot prove
      // which row should replace it: deleting current must fail atomically.
      assert.deepEqual((await second.query("SELECT id FROM test_results")).rows.map(row => row.id), [id(103)]);
      await assert.rejects(second.query("DELETE FROM test_results WHERE id=$1", [id(103)]), error => error.code === "42501");
      await second.query("RESET ROLE");
      assert.equal(await count("test_results"), 2);
      assert.deepEqual(await state(), { status: "failed", latest_result_id: id(103) });
    } finally {
      await second.query("RESET ROLE");
      await admin.query(`DROP POLICY pg_contract_failed_history ON test_results;
        ALTER TABLE test_results DISABLE ROW LEVEL SECURITY;
        DROP OWNED BY dashboard_pg_contract;
        DROP ROLE dashboard_pg_contract;`);
    }
  });
  t.diagnostic("Real PostgreSQL used 3 backend connections and observed lock waits for 6 races. Minimal fixture/synthetic RLS only; no production schema, deployed RLS, or credentials were used.");
});
