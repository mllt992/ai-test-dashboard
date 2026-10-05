// Deliberately outside deployment. Composable, awaitable, in-memory only.
export const FIXTURE_PROJECT = '00000000-0000-4000-8000-000000000001';
export const FIXTURE_PLAN = '00000000-0000-4000-8000-000000000002';
export const FIXTURE_CASE = '00000000-0000-4000-8000-000000000003';
export const FIXTURE_RUN = '00000000-0000-4000-8000-000000000004';
export function createFixture(seed = {}) {
  const timestamp = '2026-10-05T00:00:00Z';
  const tables = structuredClone({
    projects: [{id: FIXTURE_PROJECT, name: 'Local fixture', created_at: timestamp}],
    test_plans: [{id: FIXTURE_PLAN, project_id: FIXTURE_PROJECT, name: 'Local plan', created_at: timestamp}],
    test_cases: [{id: FIXTURE_CASE, project_id: FIXTURE_PROJECT, plan_id: FIXTURE_PLAN, name: 'Local case', priority: 'P1', status: 'pending', sort_order: 0, created_at: timestamp}],
    test_runs: [{id: FIXTURE_RUN, project_id: FIXTURE_PROJECT, plan_id: FIXTURE_PLAN, name: 'Local run', status: 'running', created_at: timestamp}],
    test_results: [], defects: [], solutions: [], retests: [], external_tasks: [], ...seed,
  });
  return {
    tables,
    from(table) {
      tables[table] ??= [];
      let operation = 'select', values, columns = '*', single = false, count = false, head = false;
      let start = 0, end = Infinity;
      const filters = [], ordering = [];
      const query = {
        select(cols = '*', options = {}) { columns = cols; count = options.count === 'exact'; head = options.head === true; return query; },
        eq(key, value) { filters.push(row => row[key] === value); return query; },
        in(key, values) { filters.push(row => values.includes(row[key])); return query; },
        order(key, {ascending = true} = {}) { ordering.push([key, ascending]); return query; },
        limit(n) { end = start + n; return query; },
        range(a,b) { start = a; end = b+1; return query; },
        insert(rows) { operation = 'insert'; values = Array.isArray(rows) ? rows : [rows]; return query; },
        update(fields) { operation = 'update'; values = fields; return query; },
        delete() { operation = 'delete'; return query; },
        single() { single = 'required'; return query; },
        maybeSingle() { single = 'optional'; return query; },
        then(resolve, reject) {
          return Promise.resolve().then(() => {
            let rows = tables[table].filter(row => filters.every(f => f(row)));
            if (operation === 'insert') { rows = structuredClone(values); tables[table].push(...rows); }
            if (operation === 'update') rows.forEach(row => Object.assign(row, structuredClone(values)));
            if (operation === 'delete') tables[table] = tables[table].filter(row => !rows.includes(row));
            rows = [...rows].sort((a,b) => {
              for (const [key, ascending] of ordering) {
                const cmp = a[key] === b[key] ? 0 : a[key] < b[key] ? -1 : 1;
                if(cmp) return ascending ? cmp : -cmp;
              }
              return 0;
            });
            const total = rows.length;
            rows = rows.slice(start,end).map(row => columns === '*' ? structuredClone(row) : Object.fromEntries(columns.split(',').map(key => [key,row[key]])));
            if (single && (rows.length > 1 || (single === 'required' && rows.length !== 1))) return {data: null,error: {code:'PGRST116'},count: total};
            return {data: head ? null : single ? rows[0] ?? null : rows, error:null, ...(count ? {count:total} : {})};
          }).then(resolve,reject);
        },
      };
      return query;
    },
    async rpc(name, params) {
      // RPC smoke fixture; checked-in SQL has separate real PostgreSQL tests.
      if (name === 'dashboard_stats') {
        const cases=tables.test_cases.filter(c=>!params.p_project_id || c.project_id===params.p_project_id);
        const caseIds=new Set(cases.map(c=>c.id));
        const results=tables.test_results.filter(r=>caseIds.has(r.case_id));
        const count=status=>cases.filter(c=>c.status===status).length;
        const total=cases.length,passed=count('passed'),failed=count('failed');
        const today=new Date().toISOString().slice(0,10);
        const trendData=Array.from({length:7},(_,i)=>{
          const date=new Date(today+'T00:00:00Z');date.setUTCDate(date.getUTCDate()-6+i);
          const rows=results.filter(r=>r.created_at.startsWith(date.toISOString().slice(0,10)));
          return {date:`${date.getUTCMonth()+1}/${date.getUTCDate()}`,count:rows.length,passRate:rows.length?Math.round(100*rows.filter(r=>r.status==='passed').length/rows.length):0};
        });
        return {data:{caseCount:total,total,passed,failed,skipped:count('skipped'),blocked:count('blocked'),failedCount:failed,
          passRate:total?Math.round(1000*passed/total)/10:0,
          openDefects:tables.defects.filter(d=>(!params.p_project_id || d.project_id===params.p_project_id)&&!['closed','verified'].includes(d.status)).length,
          planCount:tables.test_plans.filter(p=>!params.p_project_id||p.project_id===params.p_project_id).length,
          totalDuration:results.reduce((n,r)=>n+(r.duration_ms??0),0),
          recentResults:[...results].sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id.localeCompare(a.id)).slice(0,20).map(({error_log,screenshots,description,...r})=>r),
          priorityData:['P0','P1','P2','P3'].map(name=>{const rows=cases.filter(c=>c.priority===name);return {name,total:rows.length,passed:rows.filter(c=>c.status==='passed').length,failed:rows.filter(c=>c.status==='failed').length};}),
          trendData,durationData:[['<1s',0,1000],['1-3s',1000,3000],['3-5s',3000,5000],['5s+',5000,Infinity]].map(([range,min,max])=>({range,count:results.filter(r=>r.duration_ms>=min&&r.duration_ms<max).length})),
          topFailed:cases.filter(c=>c.status==='failed').map(c=>({name:c.name,failCount:results.filter(r=>r.case_id===c.id&&r.status==='failed').length,total:results.filter(r=>r.case_id===c.id).length})).sort((a,b)=>b.failCount-a.failCount).slice(0,5),
        },error:null};
      }
      if (['dashboard_submit_result','dashboard_add_solution','dashboard_create_retest'].includes(name)) {
        const row = structuredClone(params.p_input);
        if (name === 'dashboard_submit_result') {
          const c = tables.test_cases.find(c=>c.id===row.case_id);
          const run = tables.test_runs.find(r=>r.id===row.run_id);
          if (!c || !run || c.project_id!==run.project_id) return {data:null,error:{code:'23503'}};
          tables.test_results.push(row);
          const latest = tables.test_results.filter(r=>r.case_id===c.id).sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id.localeCompare(a.id))[0];
          c.status = latest.status; c.latest_result_id = latest.id; c.latest_result_at = latest.created_at;
        } else {
          const d = tables.defects.find(d=>d.id===row.defect_id);
          if (!d) return {data:null,error:{code:'23503'}};
          if (name === 'dashboard_add_solution') {
            if (!['open','in_progress','reopened'].includes(d.status)) return {data:null,error:{code:'23514'}};
            tables.solutions.push(row); d.status='fixed';
          } else {
            if (d.status!=='fixed') return {data:null,error:{code:'23514'}};
            tables.retests.push(row); d.status=row.status==='passed'?'verified':'reopened';
          }
        }
        return {data:row,error:null};
      }
      if (name === 'dashboard_result_page') {
        let rows = tables.test_results.filter(r => (!params.p_result_id || r.id === params.p_result_id) && (!params.p_run_id || r.run_id === params.p_run_id) && (!params.p_case_id || r.case_id === params.p_case_id) && (!params.p_project_id || tables.test_cases.some(c=>c.id===r.case_id && c.project_id===params.p_project_id)));
        rows.sort((a,b)=>b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
        const total = rows.length, start = params.p_offset, size = params.p_page_size;
        return {data:{items:structuredClone(rows.slice(start,start+size)),total,nextOffset:start+size<total?start+size:null,pageSize:size},error:null};
      }
      return {data:null,error:{code:'42883'}};
    },
  };
}
