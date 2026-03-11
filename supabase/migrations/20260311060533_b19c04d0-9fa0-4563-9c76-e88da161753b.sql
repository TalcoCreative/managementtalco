
-- Delete existing VAPID keys so they get regenerated properly with web-push library
DELETE FROM public.company_settings WHERE setting_key IN ('vapid_public_key', 'vapid_private_key');
