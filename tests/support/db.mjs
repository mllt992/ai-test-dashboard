import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

export async function createDatabase() {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE projects (id uuid PRIMARY KEY, name text, description text, status text, tags jsonb, created_at timestamptz, updated_at timestamptz);
    CREATE TABLE test_plans (id uuid PRIMARY KEY, project_id uuid, name text, status text, created_at timestamptz, updated_at timestamptz);
    CREATE TABLE test_cases (id uuid PRIMARY KEY, project_id uuid, plan_id uuid, name text, status text NOT NULL DEFAULT 'pending', priority text DEFAULT 'P1', sort_order integer DEFAULT 0, created_at timestamptz, updated_at timestamptz);
    CREATE TABLE test_runs (id uuid PRIMARY KEY, project_id uuid, plan_id uuid, name text, status text, trigger_type text, environment text, created_at timestamptz, updated_at timestamptz);
    CREATE TABLE test_results (id uuid PRIMARY KEY, run_id uuid, case_id uuid, status text NOT NULL, description text, duration_ms integer, screenshots jsonb, created_at timestamptz);
    CREATE TABLE defects (id uuid PRIMARY KEY, project_id uuid, case_id uuid, result_id uuid, title text, description text, severity text, status text NOT NULL DEFAULT 'open', created_at timestamptz, updated_at timestamptz);
    CREATE TABLE solutions (id uuid PRIMARY KEY, defect_id uuid, title text NOT NULL, root_cause text, fix_description text, commit_url text, created_at timestamptz);
    CREATE TABLE retests (id uuid PRIMARY KEY, defect_id uuid, status text NOT NULL, notes text, created_at timestamptz);
  `);
  await db.exec(await readFile(new URL("../../migrations/001_business_consistency.sql", import.meta.url), "utf8"));
  return db;
}

export function databaseClient(db) {
  return {
    async rpc(name, args) {
      if (!["dashboard_submit_result", "dashboard_add_solution", "dashboard_create_retest"].includes(name)) throw new Error("Unsupported test RPC");
      try {
        const { rows } = await db.query(`SELECT public.${name}($1::jsonb) AS item`, [JSON.stringify(args.p_input)]);
        return { data: rows[0].item, error: null };
      } catch (error) {
        return { data: null, error: { code: error.code } };
      }
    },
  };
}
