-- =============================================
-- BATCH 4: Tables using direct user_roles queries + recruitment_forms + holidays + social_media
-- =============================================

-- RECRUITMENT_FORMS
DROP POLICY IF EXISTS "HR and SuperAdmin can manage recruitment forms" ON public.recruitment_forms;
CREATE POLICY "Authorized users can manage recruitment forms" ON public.recruitment_forms
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = ANY(ARRAY['super_admin'::app_role, 'hr'::app_role])) OR
    has_dynamic_perm(auth.uid(), 'recruitment_forms', 'can_edit')
  );

-- RECRUITMENT_FORM_FIELDS
DROP POLICY IF EXISTS "HR and SuperAdmin can manage form fields" ON public.recruitment_form_fields;
CREATE POLICY "Authorized users can manage form fields" ON public.recruitment_form_fields
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = ANY(ARRAY['super_admin'::app_role, 'hr'::app_role])) OR
    has_dynamic_perm(auth.uid(), 'recruitment_forms', 'can_edit')
  );

-- RECRUITMENT_FORM_SUBMISSIONS
DROP POLICY IF EXISTS "HR and SuperAdmin can view all submissions" ON public.recruitment_form_submissions;
CREATE POLICY "Authorized users can view all submissions" ON public.recruitment_form_submissions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = ANY(ARRAY['super_admin'::app_role, 'hr'::app_role])) OR
    has_dynamic_perm(auth.uid(), 'recruitment_forms', 'can_view')
  );

-- HOLIDAYS
DROP POLICY IF EXISTS "HR and Super Admin can insert holidays" ON public.holidays;
CREATE POLICY "Authorized users can insert holidays" ON public.holidays
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = ANY(ARRAY['super_admin'::app_role, 'hr'::app_role])) OR
    has_dynamic_perm(auth.uid(), 'holiday_calendar', 'can_create')
  );

DROP POLICY IF EXISTS "HR and Super Admin can update holidays" ON public.holidays;
CREATE POLICY "Authorized users can update holidays" ON public.holidays
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = ANY(ARRAY['super_admin'::app_role, 'hr'::app_role])) OR
    has_dynamic_perm(auth.uid(), 'holiday_calendar', 'can_edit')
  );

DROP POLICY IF EXISTS "HR and Super Admin can delete holidays" ON public.holidays;
CREATE POLICY "Authorized users can delete holidays" ON public.holidays
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = ANY(ARRAY['super_admin'::app_role, 'hr'::app_role])) OR
    has_dynamic_perm(auth.uid(), 'holiday_calendar', 'can_delete')
  );

-- POSITIONS
DROP POLICY IF EXISTS "HR and SuperAdmin can manage positions" ON public.positions;
CREATE POLICY "Authorized users can manage positions" ON public.positions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = ANY(ARRAY['super_admin'::app_role, 'hr'::app_role])) OR
    has_dynamic_perm(auth.uid(), 'team', 'can_edit')
  );

-- SHOOTING_NOTIFICATIONS
DROP POLICY IF EXISTS "HR and super admin can view all notifications" ON public.shooting_notifications;
CREATE POLICY "Authorized users can view all shooting notifications" ON public.shooting_notifications
  FOR SELECT USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_dynamic_perm(auth.uid(), 'shooting', 'can_view') OR
    auth.uid() = user_id
  );

-- SOCIAL_MEDIA_POSTS (delete/update)
DROP POLICY IF EXISTS "Staff can delete their own posts" ON public.social_media_posts;
CREATE POLICY "Authorized users can delete social posts" ON public.social_media_posts
  FOR DELETE TO authenticated USING (
    staff_id = auth.uid() OR
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_dynamic_perm(auth.uid(), 'social_media', 'can_delete')
  );

DROP POLICY IF EXISTS "Staff can update their own posts" ON public.social_media_posts;
CREATE POLICY "Authorized users can update social posts" ON public.social_media_posts
  FOR UPDATE TO authenticated USING (
    staff_id = auth.uid() OR
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_role(auth.uid(), 'finance'::app_role) OR
    has_dynamic_perm(auth.uid(), 'social_media', 'can_edit')
  );

-- SCHEDULED_POSTS
DROP POLICY IF EXISTS "Socmed admin and super admin can view scheduled posts" ON public.scheduled_posts;
CREATE POLICY "Authorized users can view scheduled posts" ON public.scheduled_posts
  FOR SELECT USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'socmed_admin'::app_role) OR
    has_dynamic_perm(auth.uid(), 'social_media', 'can_view')
  );

DROP POLICY IF EXISTS "Socmed admin and super admin can manage scheduled posts" ON public.scheduled_posts;
CREATE POLICY "Authorized users can manage scheduled posts" ON public.scheduled_posts
  FOR ALL USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'socmed_admin'::app_role) OR
    has_dynamic_perm(auth.uid(), 'social_media', 'can_edit')
  );

-- MEETING_MINUTES (create/update/delete with dynamic perm)
DROP POLICY IF EXISTS "Meeting creator and HR can create meeting minutes" ON public.meeting_minutes;
CREATE POLICY "Authorized users can create meeting minutes" ON public.meeting_minutes
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM meetings WHERE meetings.id = meeting_minutes.meeting_id AND (
      meetings.created_by = auth.uid() OR
      has_role(auth.uid(), 'super_admin'::app_role) OR
      has_role(auth.uid(), 'hr'::app_role) OR
      has_dynamic_perm(auth.uid(), 'meeting', 'can_create')
    ))
  );

DROP POLICY IF EXISTS "Meeting creator and HR can update meeting minutes" ON public.meeting_minutes;
CREATE POLICY "Authorized users can update meeting minutes" ON public.meeting_minutes
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM meetings WHERE meetings.id = meeting_minutes.meeting_id AND (
      meetings.created_by = auth.uid() OR
      has_role(auth.uid(), 'super_admin'::app_role) OR
      has_role(auth.uid(), 'hr'::app_role) OR
      has_dynamic_perm(auth.uid(), 'meeting', 'can_edit')
    ))
  );

DROP POLICY IF EXISTS "Meeting creator and HR can delete meeting minutes" ON public.meeting_minutes;
CREATE POLICY "Authorized users can delete meeting minutes" ON public.meeting_minutes
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM meetings WHERE meetings.id = meeting_minutes.meeting_id AND (
      meetings.created_by = auth.uid() OR
      has_role(auth.uid(), 'super_admin'::app_role) OR
      has_role(auth.uid(), 'hr'::app_role) OR
      has_dynamic_perm(auth.uid(), 'meeting', 'can_delete')
    ))
  );

-- EMAIL_SETTINGS
DROP POLICY IF EXISTS "Super admins can view email settings" ON public.email_settings;
CREATE POLICY "Authorized users can view email settings" ON public.email_settings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'super_admin'::app_role) OR
    has_dynamic_perm(auth.uid(), 'email_settings', 'can_view')
  );

DROP POLICY IF EXISTS "Super admins can update email settings" ON public.email_settings;
CREATE POLICY "Authorized users can update email settings" ON public.email_settings
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'super_admin'::app_role) OR
    has_dynamic_perm(auth.uid(), 'email_settings', 'can_edit')
  );

DROP POLICY IF EXISTS "Super admins can insert email settings" ON public.email_settings;
CREATE POLICY "Authorized users can insert email settings" ON public.email_settings
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'super_admin'::app_role) OR
    has_dynamic_perm(auth.uid(), 'email_settings', 'can_create')
  );

-- EMAIL_LOGS
DROP POLICY IF EXISTS "Admins can view email logs" ON public.email_logs;
CREATE POLICY "Authorized users can view email logs" ON public.email_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = ANY(ARRAY['super_admin'::app_role, 'hr'::app_role, 'finance'::app_role])) OR
    has_dynamic_perm(auth.uid(), 'email_settings', 'can_view')
  );