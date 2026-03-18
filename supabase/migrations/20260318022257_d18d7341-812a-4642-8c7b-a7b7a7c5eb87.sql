
-- Fix attendance_reminder: enable it but ONLY personal (to the user who clocked in), never broadcast
UPDATE wa_notification_settings 
SET is_enabled = true, 
    send_to_personal = true, 
    send_to_all_users = false, 
    role_filter = '{}',
    group_ids = '{}',
    updated_at = now()
WHERE event_type = 'attendance_reminder';
