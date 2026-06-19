
-- ============ SUB EVENTS ============
CREATE TABLE public.sub_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning','prepare','ready','done','cancelled')),
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  location TEXT,
  pic_id UUID REFERENCES public.profiles(id),
  client_id UUID REFERENCES public.clients(id),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sub_events TO authenticated;
GRANT ALL ON public.sub_events TO service_role;
ALTER TABLE public.sub_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view sub_events" ON public.sub_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage sub_events" ON public.sub_events FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_sub_events_updated BEFORE UPDATE ON public.sub_events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ SUB EVENT RUNDOWN ============
CREATE TABLE public.sub_event_rundown (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_event_id UUID NOT NULL REFERENCES public.sub_events(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  activity TEXT NOT NULL,
  location TEXT,
  pic_id UUID REFERENCES public.profiles(id),
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sub_event_rundown TO authenticated;
GRANT ALL ON public.sub_event_rundown TO service_role;
ALTER TABLE public.sub_event_rundown ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view rundown" ON public.sub_event_rundown FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage rundown" ON public.sub_event_rundown FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ SUB EVENT CHECKLISTS ============
CREATE TABLE public.sub_event_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_event_id UUID NOT NULL REFERENCES public.sub_events(id) ON DELETE CASCADE,
  item TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_by UUID REFERENCES public.profiles(id),
  completed_at TIMESTAMPTZ,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sub_event_checklists TO authenticated;
GRANT ALL ON public.sub_event_checklists TO service_role;
ALTER TABLE public.sub_event_checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view sub checklists" ON public.sub_event_checklists FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage sub checklists" ON public.sub_event_checklists FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ SUB EVENT CREW ============
CREATE TABLE public.sub_event_crew (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_event_id UUID NOT NULL REFERENCES public.sub_events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id),
  freelancer_name TEXT,
  role TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sub_event_crew TO authenticated;
GRANT ALL ON public.sub_event_crew TO service_role;
ALTER TABLE public.sub_event_crew ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view sub crew" ON public.sub_event_crew FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage sub crew" ON public.sub_event_crew FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ Link tasks to sub_event ============
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS sub_event_id UUID REFERENCES public.sub_events(id) ON DELETE SET NULL;

-- ============ TASK CHECKLISTS (separate from sub_tasks) ============
CREATE TABLE public.task_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  item TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_by UUID REFERENCES public.profiles(id),
  completed_at TIMESTAMPTZ,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_checklists TO authenticated;
GRANT ALL ON public.task_checklists TO service_role;
ALTER TABLE public.task_checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view task checklists" ON public.task_checklists FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage task checklists" ON public.task_checklists FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ AUTO-GENERATE PROJECT FOR EVENT ============
CREATE OR REPLACE FUNCTION public.auto_create_event_project()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_project_id UUID;
  target_client_id UUID;
  internal_client_id UUID;
BEGIN
  IF NEW.project_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  target_client_id := NEW.client_id;

  -- projects.client_id is NOT NULL; fallback to any internal client placeholder if missing
  IF target_client_id IS NULL THEN
    SELECT id INTO internal_client_id FROM public.clients ORDER BY created_at ASC LIMIT 1;
    target_client_id := internal_client_id;
  END IF;

  IF target_client_id IS NULL THEN
    -- no clients at all; skip auto-creation silently
    RETURN NEW;
  END IF;

  INSERT INTO public.projects (title, description, type, status, client_id, assigned_to, deadline)
  VALUES (
    NEW.name,
    'Auto-generated project for event: ' || NEW.name,
    'event',
    'in_progress',
    target_client_id,
    NEW.pic_id,
    NEW.end_date::date
  )
  RETURNING id INTO new_project_id;

  NEW.project_id := new_project_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_create_event_project ON public.events;
CREATE TRIGGER trg_auto_create_event_project
BEFORE INSERT ON public.events
FOR EACH ROW EXECUTE FUNCTION public.auto_create_event_project();
