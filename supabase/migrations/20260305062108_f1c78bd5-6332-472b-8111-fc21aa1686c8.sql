-- =============================================
-- BATCH 1: ATTENDANCE, CANDIDATES, CLIENTS, EVENTS
-- =============================================

-- ATTENDANCE: Allow dynamic roles with hr_dashboard/hr_analytics access to view all
DROP POLICY IF EXISTS "HR and super admin can view all attendance" ON public.attendance;
CREATE POLICY "HR and dynamic roles can view all attendance" ON public.attendance
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_dynamic_perm(auth.uid(), 'hr_dashboard', 'can_view') OR
    has_dynamic_perm(auth.uid(), 'hr_analytics', 'can_view') OR
    auth.uid() = user_id
  );

-- CANDIDATES: View
DROP POLICY IF EXISTS "HR and super admin can view candidates" ON public.candidates;
CREATE POLICY "Authorized users can view candidates" ON public.candidates
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_dynamic_perm(auth.uid(), 'recruitment', 'can_view')
  );

-- CANDIDATES: Create
DROP POLICY IF EXISTS "HR and super admin can create candidates" ON public.candidates;
CREATE POLICY "Authorized users can create candidates" ON public.candidates
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_dynamic_perm(auth.uid(), 'recruitment', 'can_create')
  );

-- CANDIDATES: Update
DROP POLICY IF EXISTS "HR and super admin can update candidates" ON public.candidates;
CREATE POLICY "Authorized users can update candidates" ON public.candidates
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_dynamic_perm(auth.uid(), 'recruitment', 'can_edit')
  );

-- CANDIDATES: Delete
DROP POLICY IF EXISTS "HR and super admin can delete candidates" ON public.candidates;
CREATE POLICY "Authorized users can delete candidates" ON public.candidates
  FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_dynamic_perm(auth.uid(), 'recruitment', 'can_delete')
  );

-- CANDIDATE_ASSESSMENTS
DROP POLICY IF EXISTS "HR and super admin can view assessments" ON public.candidate_assessments;
CREATE POLICY "Authorized users can view assessments" ON public.candidate_assessments
  FOR SELECT USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_dynamic_perm(auth.uid(), 'recruitment', 'can_view')
  );

DROP POLICY IF EXISTS "HR and super admin can manage assessments" ON public.candidate_assessments;
CREATE POLICY "Authorized users can manage assessments" ON public.candidate_assessments
  FOR ALL USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_dynamic_perm(auth.uid(), 'recruitment', 'can_edit')
  );

-- CANDIDATE_NOTES
DROP POLICY IF EXISTS "HR and super admin can view notes" ON public.candidate_notes;
CREATE POLICY "Authorized users can view notes" ON public.candidate_notes
  FOR SELECT USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_dynamic_perm(auth.uid(), 'recruitment', 'can_view')
  );

DROP POLICY IF EXISTS "HR and super admin can manage notes" ON public.candidate_notes;
CREATE POLICY "Authorized users can manage notes" ON public.candidate_notes
  FOR ALL USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_dynamic_perm(auth.uid(), 'recruitment', 'can_edit')
  );

-- CANDIDATE_STATUS_HISTORY
DROP POLICY IF EXISTS "HR and super admin can view status history" ON public.candidate_status_history;
CREATE POLICY "Authorized users can view status history" ON public.candidate_status_history
  FOR SELECT USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_dynamic_perm(auth.uid(), 'recruitment', 'can_view')
  );

DROP POLICY IF EXISTS "HR and super admin can create status history" ON public.candidate_status_history;
CREATE POLICY "Authorized users can create status history" ON public.candidate_status_history
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_dynamic_perm(auth.uid(), 'recruitment', 'can_create')
  );

-- CLIENTS: Create/Update/Delete
DROP POLICY IF EXISTS "Super admin and HR can create clients" ON public.clients;
CREATE POLICY "Authorized users can create clients" ON public.clients
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_dynamic_perm(auth.uid(), 'clients', 'can_create')
  );

DROP POLICY IF EXISTS "Super admin and HR can update clients" ON public.clients;
CREATE POLICY "Authorized users can update clients" ON public.clients
  FOR UPDATE USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_dynamic_perm(auth.uid(), 'clients', 'can_edit')
  );

DROP POLICY IF EXISTS "Super admin and HR can delete clients" ON public.clients;
CREATE POLICY "Authorized users can delete clients" ON public.clients
  FOR DELETE USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_dynamic_perm(auth.uid(), 'clients', 'can_delete')
  );

-- EVENTS: View/Create/Update/Delete
DROP POLICY IF EXISTS "Authorized roles can view events" ON public.events;
CREATE POLICY "Authorized users can view events" ON public.events
  FOR SELECT USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_role(auth.uid(), 'project_manager'::app_role) OR
    has_role(auth.uid(), 'marketing'::app_role) OR
    has_role(auth.uid(), 'sales'::app_role) OR
    has_dynamic_perm(auth.uid(), 'event', 'can_view') OR
    pic_id = auth.uid()
  );

DROP POLICY IF EXISTS "Authorized roles can create events" ON public.events;
CREATE POLICY "Authorized users can create events" ON public.events
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_role(auth.uid(), 'project_manager'::app_role) OR
    has_dynamic_perm(auth.uid(), 'event', 'can_create')
  );

DROP POLICY IF EXISTS "Authorized roles can update events" ON public.events;
CREATE POLICY "Authorized users can update events" ON public.events
  FOR UPDATE USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_role(auth.uid(), 'project_manager'::app_role) OR
    has_dynamic_perm(auth.uid(), 'event', 'can_edit')
  );

DROP POLICY IF EXISTS "Authorized roles can delete events" ON public.events;
CREATE POLICY "Authorized users can delete events" ON public.events
  FOR DELETE USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_role(auth.uid(), 'project_manager'::app_role) OR
    has_dynamic_perm(auth.uid(), 'event', 'can_delete')
  );