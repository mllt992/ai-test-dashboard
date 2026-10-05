import test from 'node:test';
import assert from 'node:assert/strict';
import { handleApp } from '../functions/handler.mjs';
import { createFixture, FIXTURE_PROJECT, FIXTURE_PLAN, FIXTURE_CASE, FIXTURE_RUN } from '../dev/fixture.mjs';

test('fixture supports order then multiple filters and always returns data/error', async () => {
  const db=createFixture();
  const response=await db.from('test_cases').select('*').order('sort_order').eq('project_id',FIXTURE_PROJECT).eq('plan_id',FIXTURE_PLAN);
  assert.equal(response.error,null);
  assert.equal(response.data[0].id,FIXTURE_CASE);
  assert.equal((await db.from('test_cases').select('*').eq('id',FIXTURE_CASE).single()).data.id,FIXTURE_CASE);
  assert.equal((await db.from('test_cases').select('*').eq('id','missing').maybeSingle()).data,null);
  assert.equal((await db.from('test_cases').select('*').eq('id','missing').single()).error.code,'PGRST116');
});

test('Function health, project, combined case/result filters smoke', async () => {
  const db=createFixture({test_results:[{id:FIXTURE_CASE,run_id:FIXTURE_RUN,case_id:FIXTURE_CASE,created_at:'2026-10-05T00:00:00Z'}]});
  for(const query of ['action=health','action=project_list',`action=case_list&projectId=${FIXTURE_PROJECT}&planId=${FIXTURE_PLAN}`,`action=result_list&runId=${FIXTURE_RUN}&caseId=${FIXTURE_CASE}`,`action=dashboard_stats&projectId=${FIXTURE_PROJECT}`]) {
    const response=await handleApp({request:new Request('http://localhost/functions/v1/app?'+query),supabase:db});
    assert.equal(response.status,200,query);
    const body=await response.json();
    assert.equal(body.error,undefined);
    assert.ok(body.ok || body.caseCount===1 || body.items.length===1);
  }
});

test('result history rejects unbounded or malformed pagination before database work', async () => {
  const db={rpc(){throw new Error('must not query');}};
  for(const query of ['pageSize=201','pageSize=0','offset=-1','offset=1.5','projectId=invalid']) {
    const response=await handleApp({request:new Request('http://localhost/functions/v1/app?action=result_list&'+query),supabase:db});
    assert.equal(response.status,400);
  }
});
