-- =============================================
-- BATCH 3: LEAVE, PROSPECTS, HR, EVENT SUB-TABLES, KOL, LETTERS, PROJECTS, REIMBURSEMENTS, REMAINING
-- =============================================

-- LEAVE_REQUESTS
DROP POLICY IF EXISTS "HR and super admin can view all leave requests" ON public.leave_requests;
CREATE POLICY "Authorized users can view all leave requests" ON public.leave_requests
  FOR SELECT USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_dynamic_perm(auth.uid(), 'leave', 'can_view') OR
    auth.uid() = user_id
  );

DROP POLICY IF EXISTS "HR and super admin can update leave requests" ON public.leave_requests;
CREATE POLICY "Authorized users can update leave requests" ON public.leave_requests
  FOR UPDATE USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_dynamic_perm(auth.uid(), 'leave', 'can_edit')
  );

-- PROSPECTS
DROP POLICY IF EXISTS "Prospects - view for sales & hr & marketing" ON public.prospects;
CREATE POLICY "Authorized users can view prospects" ON public.prospects
  FOR SELECT USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_role(auth.uid(), 'sales'::app_role) OR
    has_role(auth.uid(), 'marketing'::app_role) OR
    has_dynamic_perm(auth.uid(), 'prospects', 'can_view')
  );

DROP POLICY IF EXISTS "Prospects - insert by sales & hr & marketing" ON public.prospects;
CREATE POLICY "Authorized users can create prospects" ON public.prospects
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_role(auth.uid(), 'sales'::app_role) OR
    has_role(auth.uid(), 'marketing'::app_role) OR
    has_dynamic_perm(auth.uid(), 'prospects', 'can_create')
  );

DROP POLICY IF EXISTS "Prospects - update by owner & hr & super_admin" ON public.prospects;
CREATE POLICY "Authorized users can update prospects" ON public.prospects
  FOR UPDATE USING (
    created_by = auth.uid() OR
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_dynamic_perm(auth.uid(), 'prospects', 'can_edit')
  );

DROP POLICY IF EXISTS "Prospects - delete by super_admin & hr" ON public.prospects;
CREATE POLICY "Authorized users can delete prospects" ON public.prospects
  FOR DELETE USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_dynamic_perm(auth.uid(), 'prospects', 'can_delete')
  );

-- PROSPECT_COMMENTS
DROP POLICY IF EXISTS "Prospect comments - view" ON public.prospect_comments;
CREATE POLICY "Authorized users can view prospect comments" ON public.prospect_comments
  FOR SELECT USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_role(auth.uid(), 'sales'::app_role) OR
    has_role(auth.uid(), 'marketing'::app_role) OR
    has_dynamic_perm(auth.uid(), 'prospects', 'can_view')
  );

DROP POLICY IF EXISTS "Prospect comments - delete own" ON public.prospect_comments;
CREATE POLICY "Authorized users can delete prospect comments" ON public.prospect_comments
  FOR DELETE USING (
    auth.uid() = author_id OR
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_dynamic_perm(auth.uid(), 'prospects', 'can_delete')
  );

-- PROSPECT_STATUS_HISTORY
DROP POLICY IF EXISTS "Prospect history - view" ON public.prospect_status_history;
CREATE POLICY "Authorized users can view prospect history" ON public.prospect_status_history
  FOR SELECT USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_role(auth.uid(), 'sales'::app_role) OR
    has_role(auth.uid(), 'marketing'::app_role) OR
    has_dynamic_perm(auth.uid(), 'prospects', 'can_view')
  );

-- DISCIPLINARY_CASES
DROP POLICY IF EXISTS "HR and super admin can view all disciplinary cases" ON public.disciplinary_cases;
CREATE POLICY "Authorized users can view disciplinary cases" ON public.disciplinary_cases
  FOR SELECT USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_dynamic_perm(auth.uid(), 'hr_dashboard', 'can_view')
  );

DROP POLICY IF EXISTS "HR and super admin can create disciplinary cases" ON public.disciplinary_cases;
CREATE POLICY "Authorized users can create disciplinary cases" ON public.disciplinary_cases
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_dynamic_perm(auth.uid(), 'hr_dashboard', 'can_create')
  );

DROP POLICY IF EXISTS "HR and super admin can update disciplinary cases" ON public.disciplinary_cases;
CREATE POLICY "Authorized users can update disciplinary cases" ON public.disciplinary_cases
  FOR UPDATE USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_dynamic_perm(auth.uid(), 'hr_dashboard', 'can_edit')
  );

DROP POLICY IF EXISTS "HR and super admin can delete disciplinary cases" ON public.disciplinary_cases;
CREATE POLICY "Authorized users can delete disciplinary cases" ON public.disciplinary_cases
  FOR DELETE USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_dynamic_perm(auth.uid(), 'hr_dashboard', 'can_delete')
  );

-- DELETION_LOGS
DROP POLICY IF EXISTS "HR and super admin can view deletion logs" ON public.deletion_logs;
CREATE POLICY "Authorized users can view deletion logs" ON public.deletion_logs
  FOR SELECT USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_dynamic_perm(auth.uid(), 'hr_dashboard', 'can_view')
  );

DROP POLICY IF EXISTS "HR and super admin can update deletion logs" ON public.deletion_logs;
CREATE POLICY "Authorized users can update deletion logs" ON public.deletion_logs
  FOR UPDATE USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_dynamic_perm(auth.uid(), 'hr_dashboard', 'can_edit')
  );

-- EVENT SUB-TABLES (checklists, crew, documents, history, issues, vendors)
-- Event Checklists
DROP POLICY IF EXISTS "Authorized roles can insert event checklists" ON public.event_checklists;
CREATE POLICY "Authorized users can insert event checklists" ON public.event_checklists
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'project_manager'::app_role) OR
    has_dynamic_perm(auth.uid(), 'event', 'can_create')
  );
DROP POLICY IF EXISTS "Authorized roles can update event checklists" ON public.event_checklists;
CREATE POLICY "Authorized users can update event checklists" ON public.event_checklists
  FOR UPDATE USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'project_manager'::app_role) OR
    has_dynamic_perm(auth.uid(), 'event', 'can_edit')
  );
DROP POLICY IF EXISTS "Authorized roles can delete event checklists" ON public.event_checklists;
CREATE POLICY "Authorized users can delete event checklists" ON public.event_checklists
  FOR DELETE USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'project_manager'::app_role) OR
    has_dynamic_perm(auth.uid(), 'event', 'can_delete')
  );

-- Event Crew
DROP POLICY IF EXISTS "Authorized roles can insert event crew" ON public.event_crew;
CREATE POLICY "Authorized users can insert event crew" ON public.event_crew
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'project_manager'::app_role) OR
    has_dynamic_perm(auth.uid(), 'event', 'can_create')
  );
DROP POLICY IF EXISTS "Authorized roles can update event crew" ON public.event_crew;
CREATE POLICY "Authorized users can update event crew" ON public.event_crew
  FOR UPDATE USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'project_manager'::app_role) OR
    has_dynamic_perm(auth.uid(), 'event', 'can_edit')
  );
DROP POLICY IF EXISTS "Authorized roles can delete event crew" ON public.event_crew;
CREATE POLICY "Authorized users can delete event crew" ON public.event_crew
  FOR DELETE USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'project_manager'::app_role) OR
    has_dynamic_perm(auth.uid(), 'event', 'can_delete')
  );

-- Event Documents
DROP POLICY IF EXISTS "Authorized roles can insert event documents" ON public.event_documents;
CREATE POLICY "Authorized users can insert event documents" ON public.event_documents
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'project_manager'::app_role) OR
    has_dynamic_perm(auth.uid(), 'event', 'can_create')
  );
DROP POLICY IF EXISTS "Authorized roles can update event documents" ON public.event_documents;
CREATE POLICY "Authorized users can update event documents" ON public.event_documents
  FOR UPDATE USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'project_manager'::app_role) OR
    has_dynamic_perm(auth.uid(), 'event', 'can_edit')
  );
DROP POLICY IF EXISTS "Authorized roles can delete event documents" ON public.event_documents;
CREATE POLICY "Authorized users can delete event documents" ON public.event_documents
  FOR DELETE USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'project_manager'::app_role) OR
    has_dynamic_perm(auth.uid(), 'event', 'can_delete')
  );

-- Event History
DROP POLICY IF EXISTS "Authorized roles can insert event history" ON public.event_history;
CREATE POLICY "Authorized users can insert event history" ON public.event_history
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'project_manager'::app_role) OR
    has_dynamic_perm(auth.uid(), 'event', 'can_create')
  );

-- Event Issues
DROP POLICY IF EXISTS "Authorized roles can insert event issues" ON public.event_issues;
CREATE POLICY "Authorized users can insert event issues" ON public.event_issues
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'project_manager'::app_role) OR
    has_dynamic_perm(auth.uid(), 'event', 'can_create')
  );
DROP POLICY IF EXISTS "Authorized roles can update event issues" ON public.event_issues;
CREATE POLICY "Authorized users can update event issues" ON public.event_issues
  FOR UPDATE USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'project_manager'::app_role) OR
    has_dynamic_perm(auth.uid(), 'event', 'can_edit')
  );
DROP POLICY IF EXISTS "Authorized roles can delete event issues" ON public.event_issues;
CREATE POLICY "Authorized users can delete event issues" ON public.event_issues
  FOR DELETE USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'project_manager'::app_role) OR
    has_dynamic_perm(auth.uid(), 'event', 'can_delete')
  );

-- Event Vendors
DROP POLICY IF EXISTS "Authorized roles can insert event vendors" ON public.event_vendors;
CREATE POLICY "Authorized users can insert event vendors" ON public.event_vendors
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'project_manager'::app_role) OR
    has_dynamic_perm(auth.uid(), 'event', 'can_create')
  );
DROP POLICY IF EXISTS "Authorized roles can update event vendors" ON public.event_vendors;
CREATE POLICY "Authorized users can update event vendors" ON public.event_vendors
  FOR UPDATE USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'project_manager'::app_role) OR
    has_dynamic_perm(auth.uid(), 'event', 'can_edit')
  );
DROP POLICY IF EXISTS "Authorized roles can delete event vendors" ON public.event_vendors;
CREATE POLICY "Authorized users can delete event vendors" ON public.event_vendors
  FOR DELETE USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'project_manager'::app_role) OR
    has_dynamic_perm(auth.uid(), 'event', 'can_delete')
  );

-- REIMBURSEMENTS
DROP POLICY IF EXISTS "Approvers can view all reimbursements" ON public.reimbursements;
CREATE POLICY "Authorized users can view all reimbursements" ON public.reimbursements
  FOR SELECT USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'finance'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_dynamic_perm(auth.uid(), 'reimburse', 'can_view') OR
    auth.uid() = user_id
  );

DROP POLICY IF EXISTS "Approvers can update reimbursements" ON public.reimbursements;
CREATE POLICY "Authorized users can update reimbursements" ON public.reimbursements
  FOR UPDATE USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'finance'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_dynamic_perm(auth.uid(), 'reimburse', 'can_edit')
  );

DROP POLICY IF EXISTS "Approvers can delete reimbursements" ON public.reimbursements;
CREATE POLICY "Authorized users can delete reimbursements" ON public.reimbursements
  FOR DELETE USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'finance'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_dynamic_perm(auth.uid(), 'reimburse', 'can_delete')
  );

-- LETTERS
DROP POLICY IF EXISTS "HR, Super Admin, Finance, PM can create letters" ON public.letters;
CREATE POLICY "Authorized users can create letters" ON public.letters
  FOR INSERT TO authenticated WITH CHECK (
    has_role(auth.uid(), 'hr'::app_role) OR
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'finance'::app_role) OR
    has_role(auth.uid(), 'project_manager'::app_role) OR
    has_dynamic_perm(auth.uid(), 'letters', 'can_create')
  );

DROP POLICY IF EXISTS "HR, Super Admin, Finance, PM can update letters" ON public.letters;
CREATE POLICY "Authorized users can update letters" ON public.letters
  FOR UPDATE TO authenticated USING (
    has_role(auth.uid(), 'hr'::app_role) OR
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'finance'::app_role) OR
    has_role(auth.uid(), 'project_manager'::app_role) OR
    has_dynamic_perm(auth.uid(), 'letters', 'can_edit')
  );

DROP POLICY IF EXISTS "HR, Super Admin can delete letters" ON public.letters;
CREATE POLICY "Authorized users can delete letters" ON public.letters
  FOR DELETE TO authenticated USING (
    has_role(auth.uid(), 'hr'::app_role) OR
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_dynamic_perm(auth.uid(), 'letters', 'can_delete')
  );

-- PROJECTS
DROP POLICY IF EXISTS "HR can create projects" ON public.projects;
CREATE POLICY "Authorized users can create projects" ON public.projects
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_dynamic_perm(auth.uid(), 'projects', 'can_create')
  );

DROP POLICY IF EXISTS "Super admin can manage all projects" ON public.projects;
CREATE POLICY "Admin and dynamic roles can manage all projects" ON public.projects
  FOR ALL USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_dynamic_perm(auth.uid(), 'projects', 'can_edit')
  );

-- PROFILES (update all)
DROP POLICY IF EXISTS "HR and super admin can update all profiles" ON public.profiles;
CREATE POLICY "Authorized users can update all profiles" ON public.profiles
  FOR UPDATE USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_dynamic_perm(auth.uid(), 'team', 'can_edit') OR
    auth.uid() = id
  );

-- ASSETS
DROP POLICY IF EXISTS "Authorized roles can create assets" ON public.assets;
CREATE POLICY "Authorized users can create assets" ON public.assets
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_role(auth.uid(), 'project_manager'::app_role) OR
    has_dynamic_perm(auth.uid(), 'asset', 'can_create')
  );

DROP POLICY IF EXISTS "HR and super admin can delete assets" ON public.assets;
CREATE POLICY "Authorized users can delete assets" ON public.assets
  FOR DELETE USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_dynamic_perm(auth.uid(), 'asset', 'can_delete')
  );

-- SHOOTING_SCHEDULES (approve)
DROP POLICY IF EXISTS "HR and super admin can approve shooting schedules" ON public.shooting_schedules;
CREATE POLICY "Authorized users can approve shooting schedules" ON public.shooting_schedules
  FOR UPDATE TO authenticated USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_dynamic_perm(auth.uid(), 'shooting', 'can_edit')
  );

-- MEETINGS (update/delete)
DROP POLICY IF EXISTS "Meeting creator and HR can update meetings" ON public.meetings;
CREATE POLICY "Authorized users can update meetings" ON public.meetings
  FOR UPDATE USING (
    auth.uid() = created_by OR
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_dynamic_perm(auth.uid(), 'meeting', 'can_edit')
  );

DROP POLICY IF EXISTS "Meeting creator and HR can delete meetings" ON public.meetings;
CREATE POLICY "Authorized users can delete meetings" ON public.meetings
  FOR DELETE USING (
    auth.uid() = created_by OR
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_dynamic_perm(auth.uid(), 'meeting', 'can_delete')
  );

-- KOL_DATABASE (create/update)
DROP POLICY IF EXISTS "Authorized roles can create KOL" ON public.kol_database;
CREATE POLICY "Authorized users can create KOL" ON public.kol_database
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'project_manager'::app_role) OR has_role(auth.uid(), 'marketing'::app_role) OR has_role(auth.uid(), 'sales'::app_role) OR
    has_dynamic_perm(auth.uid(), 'kol_database', 'can_create')
  );

DROP POLICY IF EXISTS "Authorized roles can update KOL" ON public.kol_database;
CREATE POLICY "Authorized users can update KOL" ON public.kol_database
  FOR UPDATE USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'project_manager'::app_role) OR has_role(auth.uid(), 'marketing'::app_role) OR has_role(auth.uid(), 'sales'::app_role) OR
    has_dynamic_perm(auth.uid(), 'kol_database', 'can_edit')
  );

-- KOL_CAMPAIGNS (create/update/delete)
DROP POLICY IF EXISTS "Authorized roles can create KOL campaigns" ON public.kol_campaigns;
CREATE POLICY "Authorized users can create KOL campaigns" ON public.kol_campaigns
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'project_manager'::app_role) OR has_role(auth.uid(), 'marketing'::app_role) OR has_role(auth.uid(), 'sales'::app_role) OR
    has_dynamic_perm(auth.uid(), 'kol_campaign', 'can_create')
  );

DROP POLICY IF EXISTS "Authorized roles can update KOL campaigns" ON public.kol_campaigns;
CREATE POLICY "Authorized users can update KOL campaigns" ON public.kol_campaigns
  FOR UPDATE USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'project_manager'::app_role) OR has_role(auth.uid(), 'marketing'::app_role) OR has_role(auth.uid(), 'sales'::app_role) OR
    has_dynamic_perm(auth.uid(), 'kol_campaign', 'can_edit')
  );

DROP POLICY IF EXISTS "Authorized roles can delete KOL campaigns" ON public.kol_campaigns;
CREATE POLICY "Authorized users can delete KOL campaigns" ON public.kol_campaigns
  FOR DELETE USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'project_manager'::app_role) OR has_role(auth.uid(), 'marketing'::app_role) OR has_role(auth.uid(), 'sales'::app_role) OR
    has_dynamic_perm(auth.uid(), 'kol_campaign', 'can_delete')
  );

-- KOL_CAMPAIGN_HISTORY
DROP POLICY IF EXISTS "Authorized roles can view KOL campaign history" ON public.kol_campaign_history;
CREATE POLICY "Authorized users can view KOL campaign history" ON public.kol_campaign_history
  FOR SELECT USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'project_manager'::app_role) OR has_role(auth.uid(), 'marketing'::app_role) OR has_role(auth.uid(), 'sales'::app_role) OR
    has_dynamic_perm(auth.uid(), 'kol_campaign', 'can_view')
  );

DROP POLICY IF EXISTS "Authorized roles can create KOL campaign history" ON public.kol_campaign_history;
CREATE POLICY "Authorized users can create KOL campaign history" ON public.kol_campaign_history
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'project_manager'::app_role) OR has_role(auth.uid(), 'marketing'::app_role) OR has_role(auth.uid(), 'sales'::app_role) OR
    has_dynamic_perm(auth.uid(), 'kol_campaign', 'can_create')
  );

DROP POLICY IF EXISTS "Authorized roles can delete KOL campaign history" ON public.kol_campaign_history;
CREATE POLICY "Authorized users can delete KOL campaign history" ON public.kol_campaign_history
  FOR DELETE USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'project_manager'::app_role) OR has_role(auth.uid(), 'marketing'::app_role) OR has_role(auth.uid(), 'sales'::app_role) OR
    has_dynamic_perm(auth.uid(), 'kol_campaign', 'can_delete')
  );

-- TASK_ACTIVITIES
DROP POLICY IF EXISTS "HR and super admin can view all activities" ON public.task_activities;
CREATE POLICY "Authorized users can view all activities" ON public.task_activities
  FOR SELECT TO authenticated USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_dynamic_perm(auth.uid(), 'hr_analytics', 'can_view') OR
    auth.uid() = user_id
  );

DROP POLICY IF EXISTS "HR and super admin can delete activities" ON public.task_activities;
CREATE POLICY "Authorized users can delete activities" ON public.task_activities
  FOR DELETE USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_dynamic_perm(auth.uid(), 'hr_analytics', 'can_delete') OR
    auth.uid() = user_id
  );

-- FREELANCERS
DROP POLICY IF EXISTS "Authorized roles can insert freelancers" ON public.freelancers;
CREATE POLICY "Authorized users can insert freelancers" ON public.freelancers
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'project_manager'::app_role) OR
    has_dynamic_perm(auth.uid(), 'event', 'can_create')
  );

DROP POLICY IF EXISTS "Authorized roles can update freelancers" ON public.freelancers;
CREATE POLICY "Authorized users can update freelancers" ON public.freelancers
  FOR UPDATE USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'project_manager'::app_role) OR
    has_dynamic_perm(auth.uid(), 'event', 'can_edit')
  );

DROP POLICY IF EXISTS "Authorized roles can delete freelancers" ON public.freelancers;
CREATE POLICY "Authorized users can delete freelancers" ON public.freelancers
  FOR DELETE USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'project_manager'::app_role) OR
    has_dynamic_perm(auth.uid(), 'event', 'can_delete')
  );

-- ANNOUNCEMENTS
DROP POLICY IF EXISTS "HR and SuperAdmin can manage announcements" ON public.announcements;
CREATE POLICY "Authorized users can manage announcements" ON public.announcements
  FOR ALL TO authenticated USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_dynamic_perm(auth.uid(), 'dashboard', 'can_edit')
  );

-- COMPANY_SETTINGS
DROP POLICY IF EXISTS "HR and super admin can manage settings" ON public.company_settings;
CREATE POLICY "Authorized users can manage settings" ON public.company_settings
  FOR ALL USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_dynamic_perm(auth.uid(), 'system_settings', 'can_edit')
  );

DROP POLICY IF EXISTS "HR and super admin can view settings" ON public.company_settings;
CREATE POLICY "Authorized users can view settings" ON public.company_settings
  FOR SELECT USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_role(auth.uid(), 'finance'::app_role) OR
    has_role(auth.uid(), 'accounting'::app_role) OR
    has_dynamic_perm(auth.uid(), 'system_settings', 'can_view') OR
    has_dynamic_perm(auth.uid(), 'finance', 'can_view')
  );