SELECT cron.schedule(
  'generate-recurring-invoices-daily',
  '5 19 * * *',
  $$
  SELECT net.http_post(
    url := 'https://kuidassgxkopjdqziqvq.supabase.co/functions/v1/generate-recurring-invoices',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1aWRhc3NneGtvcGpkcXppcXZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxODE1ODAsImV4cCI6MjA3Nzc1NzU4MH0.PMWKEPluvweCCy9xKWxTyXua76Xr-BUgrYD_bdE6VP4"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);