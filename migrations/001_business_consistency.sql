-- Review migrations/README.md before applying. Never run against production from tests.
BEGIN;

ALTER TABLE public.test_results ADD COLUMN IF NOT EXISTS error_log text NOT NULL DEFAULT '';
ALTER TABLE public.test_cases ADD COLUMN IF NOT EXISTS latest_result_at timestamptz;
ALTER TABLE public.test_cases ADD COLUMN IF NOT EXISTS latest_result_id uuid;
ALTER TABLE public.test_runs ADD COLUMN IF NOT EXISTS finished_at timestamptz;

ALTER TABLE public.test_results ADD CONSTRAINT dashboard_error_log_size CHECK (char_length(error_log) <= 65536) NOT VALID;
ALTER TABLE public.test_results ADD CONSTRAINT dashboard_result_status CHECK (status IS NOT NULL AND status IN ('passed', 'failed', 'skipped', 'blocked')) NOT VALID;
ALTER TABLE public.retests ADD CONSTRAINT dashboard_retest_status CHECK (status IS NOT NULL AND status IN ('passed', 'failed')) NOT VALID;

-- Current state is the newest execution timestamp, with UUID as a stable tie-breaker.
-- Older arriving executions remain history and do not replace a newer result.
WITH latest AS (
  SELECT DISTINCT ON (case_id) case_id, id, created_at, status
  FROM public.test_results ORDER BY case_id, created_at DESC, id DESC
)
UPDATE public.test_cases c SET status = r.status, latest_result_at = r.created_at, latest_result_id = r.id
FROM latest r WHERE c.id = r.case_id;

CREATE FUNCTION public.dashboard_result_before() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE c public.test_cases%ROWTYPE; r public.test_runs%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (to_jsonb(NEW) - 'screenshots') IS DISTINCT FROM (to_jsonb(OLD) - 'screenshots') THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'result_history_is_immutable';
    END IF;
    RETURN NEW;
  END IF;
  SELECT * INTO c FROM public.test_cases WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.case_id ELSE NEW.case_id END FOR UPDATE;
  IF NOT FOUND THEN
    -- Under active RLS, an absent and a hidden parent are indistinguishable.
    -- The built-in checks current invoker visibility without bypassing policy.
    IF TG_OP = 'DELETE' AND NOT pg_catalog.row_security_active('public.test_cases'::regclass) THEN RETURN OLD; END IF;
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'case_not_found';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  SELECT * INTO r FROM public.test_runs WHERE id = NEW.run_id;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'run_not_found'; END IF;
  IF r.project_id IS DISTINCT FROM c.project_id OR (r.plan_id IS NOT NULL AND r.plan_id IS DISTINCT FROM c.plan_id) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'run_case_mismatch';
  END IF;
  IF NEW.created_at IS NULL THEN NEW.created_at := clock_timestamp(); END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION public.dashboard_result_after() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE latest public.test_results%ROWTYPE; current_case public.test_cases%ROWTYPE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT * INTO current_case FROM public.test_cases WHERE id = NEW.case_id FOR UPDATE;
    IF current_case.latest_result_at IS NULL OR (NEW.created_at, NEW.id) > (current_case.latest_result_at, current_case.latest_result_id) THEN
      UPDATE public.test_cases SET status = NEW.status, latest_result_at = NEW.created_at, latest_result_id = NEW.id, updated_at = clock_timestamp() WHERE id = NEW.case_id;
      IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'case_update_not_allowed'; END IF;
    END IF;
  ELSE
    PERFORM 1 FROM public.test_cases WHERE id = OLD.case_id;
    IF NOT FOUND THEN
      IF NOT pg_catalog.row_security_active('public.test_cases'::regclass) THEN RETURN NULL; END IF;
      RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'case_not_found';
    END IF;
    SELECT * INTO latest FROM public.test_results WHERE case_id = OLD.case_id ORDER BY created_at DESC, id DESC LIMIT 1;
    UPDATE public.test_cases SET status = COALESCE(latest.status, 'pending'), latest_result_at = latest.created_at, latest_result_id = latest.id, updated_at = clock_timestamp() WHERE id = OLD.case_id;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'case_update_not_allowed'; END IF;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER dashboard_result_before BEFORE INSERT OR UPDATE OR DELETE ON public.test_results FOR EACH ROW EXECUTE FUNCTION public.dashboard_result_before();
CREATE TRIGGER dashboard_result_after AFTER INSERT OR DELETE ON public.test_results FOR EACH ROW EXECUTE FUNCTION public.dashboard_result_after();

CREATE FUNCTION public.dashboard_case_state_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
BEGIN
  IF pg_trigger_depth() <= 1 AND (NEW.status IS DISTINCT FROM OLD.status OR NEW.latest_result_id IS DISTINCT FROM OLD.latest_result_id OR NEW.latest_result_at IS DISTINCT FROM OLD.latest_result_at) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'case_state_requires_result';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER dashboard_case_state_guard BEFORE UPDATE ON public.test_cases FOR EACH ROW EXECUTE FUNCTION public.dashboard_case_state_guard();

CREATE FUNCTION public.dashboard_defect_transition() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  IF (OLD.status IN ('open', 'reopened') AND NEW.status IN ('in_progress', 'fixed'))
    OR (OLD.status = 'in_progress' AND NEW.status = 'fixed')
    OR (OLD.status = 'verified' AND NEW.status = 'closed')
    OR (OLD.status = 'fixed' AND NEW.status IN ('verified', 'reopened') AND pg_trigger_depth() > 1) THEN
    NEW.updated_at := clock_timestamp();
    RETURN NEW;
  END IF;
  RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'invalid_defect_transition';
END $$;
CREATE TRIGGER dashboard_defect_transition BEFORE UPDATE ON public.defects FOR EACH ROW EXECUTE FUNCTION public.dashboard_defect_transition();

CREATE FUNCTION public.dashboard_solution_transition() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE current_status text;
BEGIN
  SELECT status INTO current_status FROM public.defects WHERE id = NEW.defect_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'defect_not_found'; END IF;
  IF current_status IS NULL OR current_status NOT IN ('open', 'in_progress', 'reopened') THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'invalid_solution_transition';
  END IF;
  UPDATE public.defects SET status = 'fixed', updated_at = clock_timestamp() WHERE id = NEW.defect_id;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'defect_update_not_allowed'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER dashboard_solution_transition BEFORE INSERT ON public.solutions FOR EACH ROW EXECUTE FUNCTION public.dashboard_solution_transition();

CREATE FUNCTION public.dashboard_retest_transition() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE current_status text;
BEGIN
  SELECT status INTO current_status FROM public.defects WHERE id = NEW.defect_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'defect_not_found'; END IF;
  IF current_status IS DISTINCT FROM 'fixed' OR NEW.status IS NULL OR NEW.status NOT IN ('passed', 'failed') THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'invalid_retest_transition';
  END IF;
  UPDATE public.defects SET status = CASE WHEN NEW.status = 'passed' THEN 'verified' ELSE 'reopened' END, updated_at = clock_timestamp() WHERE id = NEW.defect_id;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'defect_update_not_allowed'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER dashboard_retest_transition BEFORE INSERT ON public.retests FOR EACH ROW EXECUTE FUNCTION public.dashboard_retest_transition();

CREATE FUNCTION public.dashboard_run_transition() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS DISTINCT FROM 'running' THEN RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'invalid_run_status'; END IF;
    NEW.finished_at := NULL;
  ELSE
    IF NEW.status IS NULL OR NEW.status NOT IN ('running', 'completed') OR (OLD.status = 'completed' AND NEW.status <> OLD.status) THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'invalid_run_transition';
    END IF;
    NEW.finished_at := CASE WHEN OLD.status = 'running' AND NEW.status = 'completed' THEN clock_timestamp() ELSE OLD.finished_at END;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER dashboard_run_transition BEFORE INSERT OR UPDATE ON public.test_runs FOR EACH ROW EXECUTE FUNCTION public.dashboard_run_transition();

-- Type conversion follows existing table definitions; these do not grant access
-- or bypass RLS. Missing functions intentionally cause the application to fail closed.
CREATE FUNCTION public.dashboard_submit_result(p_input jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE row public.test_results%ROWTYPE;
BEGIN
  row := jsonb_populate_record(NULL::public.test_results, p_input);
  INSERT INTO public.test_results (id, run_id, case_id, status, description, error_log, duration_ms, screenshots, created_at)
  VALUES (row.id, row.run_id, row.case_id, row.status, row.description, row.error_log, row.duration_ms, row.screenshots, row.created_at) RETURNING * INTO row;
  RETURN to_jsonb(row);
END $$;
CREATE FUNCTION public.dashboard_add_solution(p_input jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE row public.solutions%ROWTYPE;
BEGIN
  row := jsonb_populate_record(NULL::public.solutions, p_input);
  INSERT INTO public.solutions (id, defect_id, title, root_cause, fix_description, commit_url, created_at)
  VALUES (row.id, row.defect_id, row.title, row.root_cause, row.fix_description, row.commit_url, row.created_at) RETURNING * INTO row;
  RETURN to_jsonb(row);
END $$;
CREATE FUNCTION public.dashboard_create_retest(p_input jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE row public.retests%ROWTYPE;
BEGIN
  row := jsonb_populate_record(NULL::public.retests, p_input);
  INSERT INTO public.retests (id, defect_id, status, notes, created_at)
  VALUES (row.id, row.defect_id, row.status, row.notes, row.created_at) RETURNING * INTO row;
  RETURN to_jsonb(row);
END $$;

COMMIT;
