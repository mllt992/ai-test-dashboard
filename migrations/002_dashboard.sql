-- Review against the deployed schema before applying. Invoker/RLS permissions
-- are preserved; this migration grants no roles and creates no credentials.
BEGIN;
CREATE OR REPLACE FUNCTION public.dashboard_result_page(
  p_project_id uuid DEFAULT NULL, p_run_id uuid DEFAULT NULL,
  p_case_id uuid DEFAULT NULL, p_offset integer DEFAULT 0,
  p_page_size integer DEFAULT 100, p_result_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = public, pg_temp AS $$
DECLARE payload jsonb;
BEGIN
  IF p_offset < 0 OR p_page_size < 1 OR p_page_size > 200 THEN
    RAISE EXCEPTION 'invalid_pagination' USING ERRCODE = '22023';
  END IF;
  WITH matching AS MATERIALIZED (
    SELECT r.* FROM public.test_results r
    JOIN public.test_cases c ON c.id = r.case_id
    WHERE (p_project_id IS NULL OR c.project_id = p_project_id)
      AND (p_run_id IS NULL OR r.run_id = p_run_id)
      AND (p_case_id IS NULL OR r.case_id = p_case_id)
      AND (p_result_id IS NULL OR r.id = p_result_id)
  ), page AS (
    SELECT * FROM matching ORDER BY created_at DESC, id DESC
    LIMIT p_page_size OFFSET p_offset
  )
  SELECT jsonb_build_object(
    'items', COALESCE((SELECT jsonb_agg(to_jsonb(page) ORDER BY created_at DESC, id DESC) FROM page), '[]'::jsonb),
    'total', (SELECT count(*) FROM matching),
    'nextOffset', CASE WHEN p_offset+p_page_size < (SELECT count(*) FROM matching) THEN p_offset+p_page_size ELSE NULL END,
    'pageSize', p_page_size
  ) INTO payload;
  RETURN payload;
END $$;

CREATE OR REPLACE FUNCTION public.dashboard_stats(p_project_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public, pg_temp AS $$
WITH cases AS MATERIALIZED (
  SELECT id, name, status, priority FROM public.test_cases
  WHERE p_project_id IS NULL OR project_id = p_project_id
), results AS MATERIALIZED (
  SELECT r.id, r.run_id, r.case_id, r.status, r.duration_ms, r.created_at
  FROM public.test_results r JOIN cases c ON c.id = r.case_id
), counts AS (
  SELECT count(*) AS total,
    count(*) FILTER (WHERE status='passed') AS passed,
    count(*) FILTER (WHERE status='failed') AS failed,
    count(*) FILTER (WHERE status='skipped') AS skipped,
    count(*) FILTER (WHERE status='blocked') AS blocked FROM cases
), recent AS (
  SELECT * FROM results ORDER BY created_at DESC,id DESC LIMIT 20
), priority AS (
  SELECT p AS name, count(c.id) AS total,
    count(c.id) FILTER (WHERE c.status='passed') AS passed,
    count(c.id) FILTER (WHERE c.status='failed') AS failed
  FROM unnest(ARRAY['P0','P1','P2','P3']) p LEFT JOIN cases c ON c.priority=p GROUP BY p
), days AS (
  SELECT (current_timestamp AT TIME ZONE 'UTC')::date-i AS day FROM generate_series(6,0,-1) i
), trend AS (
  SELECT day, count(r.id) AS count,
    CASE WHEN count(r.id)=0 THEN 0 ELSE round(100.0*count(r.id) FILTER (WHERE r.status='passed')/count(r.id)) END AS rate
  FROM days LEFT JOIN results r ON (r.created_at AT TIME ZONE 'UTC')::date=day GROUP BY day
), failures AS (
  SELECT c.id,c.name,count(r.id) FILTER (WHERE r.status='failed') AS failed,count(r.id) AS total
  FROM cases c JOIN results r ON r.case_id=c.id WHERE c.status='failed'
  GROUP BY c.id,c.name ORDER BY failed DESC,c.id LIMIT 5
)
SELECT jsonb_build_object(
  'caseCount',total,'total',total,'passed',passed,'failed',failed,
  'skipped',skipped,'blocked',blocked,'failedCount',failed,
  'passRate', CASE WHEN total=0 THEN 0 ELSE round(100.0*passed/total,1) END,
  'planCount',(SELECT count(*) FROM public.test_plans WHERE p_project_id IS NULL OR project_id=p_project_id),
  'openDefects',(SELECT count(*) FROM public.defects WHERE (p_project_id IS NULL OR project_id=p_project_id) AND status NOT IN ('closed','verified')),
  'totalDuration',(SELECT COALESCE(sum(duration_ms),0) FROM results),
  'recentResults',COALESCE((SELECT jsonb_agg(to_jsonb(recent) ORDER BY created_at DESC,id DESC) FROM recent),'[]'::jsonb),
  'priorityData',(SELECT jsonb_agg(to_jsonb(priority) ORDER BY name) FROM priority),
  'trendData',(SELECT jsonb_agg(jsonb_build_object('date',to_char(day,'FMMM/FMDD'),'passRate',rate,'count',count) ORDER BY day) FROM trend),
  'durationData',jsonb_build_array(
    jsonb_build_object('range','<1s','count',(SELECT count(*) FROM results WHERE duration_ms<1000)),
    jsonb_build_object('range','1-3s','count',(SELECT count(*) FROM results WHERE duration_ms>=1000 AND duration_ms<3000)),
    jsonb_build_object('range','3-5s','count',(SELECT count(*) FROM results WHERE duration_ms>=3000 AND duration_ms<5000)),
    jsonb_build_object('range','5s+','count',(SELECT count(*) FROM results WHERE duration_ms>=5000))
  ),
  'topFailed',COALESCE((SELECT jsonb_agg(jsonb_build_object('name',name,'failCount',failed,'total',total) ORDER BY failed DESC,id) FROM failures),'[]'::jsonb)
) FROM counts;
$$;
CREATE INDEX IF NOT EXISTS dashboard_results_history ON public.test_results(created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS dashboard_results_case_history ON public.test_results(case_id,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS dashboard_cases_project ON public.test_cases(project_id);
COMMIT;
