import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDatabase } from './support/db.mjs';
import { handleApp } from '../functions/handler.mjs';

const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
test('SQL summaries isolate projects and count all result pages; history has stable ordering', async t => {
  const db=await createDatabase();
  try {
    await db.exec(await readFile(new URL('../migrations/002_dashboard.sql',import.meta.url),'utf8'));
    await db.query(`INSERT INTO projects(id,name) VALUES ($1,'A'),($2,'B'),($3,'Empty')`,[id(1),id(2),id(3)]);
    await db.query(`INSERT INTO test_cases(id,project_id,name,status,priority) VALUES ($1,$2,'A-case','pending','P1'),($3,$4,'B-case','pending','P0')`,[id(10),id(1),id(20),id(2)]);
    await db.query(`INSERT INTO test_runs(id,project_id,name,status) VALUES ($1,$2,'A-run','running'),($3,$4,'B-run','running')`,[id(11),id(1),id(21),id(2)]);
    await db.query(`INSERT INTO test_results(id,run_id,case_id,status,duration_ms,created_at,error_log)
      SELECT ('00000000-0000-4000-8000-'||lpad((1000+i)::text,12,'0'))::uuid,$1,$2,
      CASE WHEN i%2=1 THEN 'failed' ELSE 'passed' END,1000,
      current_timestamp - interval '1 hour' + i*interval '1 second',repeat('诊断',500)
      FROM generate_series(1,205) i`,[id(11),id(10)]);
    await db.query(`INSERT INTO test_results(id,run_id,case_id,status,duration_ms,created_at)
      SELECT ('00000000-0000-4000-8000-'||lpad((2000+i)::text,12,'0'))::uuid,$1,$2,'passed',900,current_timestamp FROM generate_series(1,7) i`,[id(21),id(20)]);
    const rpc = async (name,args) => {
      const q=name==='dashboard_stats'?'SELECT dashboard_stats($1) AS data':'SELECT dashboard_result_page($1,$2,$3,$4,$5,$6) AS data';
      const values=name==='dashboard_stats'?[args.p_project_id]:[args.p_project_id,args.p_run_id,args.p_case_id,args.p_offset,args.p_page_size,args.p_result_id];
      return {data:(await db.query(q,values)).rows[0].data,error:null};
    };
    const call=async query=>(await handleApp({request:new Request('http://localhost/functions/v1/app?'+query),supabase:{rpc}})).json();
    const a=await call(`action=dashboard_stats&projectId=${id(1)}`), b=await call(`action=dashboard_stats&projectId=${id(2)}`),empty=await call(`action=dashboard_stats&projectId=${id(3)}`);
    assert.equal(a.caseCount,1); assert.equal(a.failed,1); assert.equal(a.totalDuration,205000);
    assert.equal(a.recentResults.length,20); assert.equal(a.topFailed[0].failCount,103);
    assert.equal(a.durationData.reduce((n,x)=>n+x.count,0),205);
    assert.equal(a.trendData.reduce((n,x)=>n+x.count,0),205);
    assert.equal(b.totalDuration,6300); assert.equal(b.passed,1); assert.equal(b.topFailed.length,0);
    assert.equal(empty.caseCount,0); assert.equal(empty.passRate,0); assert.deepEqual(empty.recentResults,[]);
    const single=await call(`action=result_list&projectId=${id(1)}&resultId=${id(1205)}&pageSize=1`);
    assert.equal(single.total,1); assert.equal(single.items[0].id,id(1205));
    const wrongProject=await call(`action=result_list&projectId=${id(2)}&resultId=${id(1205)}&pageSize=1`);
    assert.equal(wrongProject.total,0);
    const history=[]; let offset=0;
    do {
      const page=await call(`action=result_list&projectId=${id(1)}&offset=${offset}&pageSize=100`);
      assert.equal(page.total,205); assert.ok(page.items.length<=100);
      history.push(...page.items); offset=page.nextOffset;
    } while(offset!==null);
    assert.equal(history.length,205); assert.equal(new Set(history.map(r=>r.id)).size,205);
    assert.equal(history[0].id,id(1205));
    const ties=await call(`action=result_list&projectId=${id(2)}&pageSize=3`);
    assert.deepEqual(ties.items.map(r=>r.id),[id(2007),id(2006),id(2005)]);
    const oldRows=(await db.query('SELECT * FROM test_results')).rows;
    const before=3*Buffer.byteLength(JSON.stringify({items:oldRows}));
    const after=Buffer.byteLength(JSON.stringify(a))+Buffer.byteLength(JSON.stringify(b))+Buffer.byteLength(JSON.stringify(empty));
    assert.ok(after<before);
    t.diagnostic(`Deterministic 3-project/212-result fixture: old full-history transfers=3, bytes=${before}; new full-history transfers=0, summary requests=3, bytes=${after}. Excludes unchanged project-list traffic and HTTP headers; not production timings.`);
  } finally { await db.close(); }
});
