-- Add table_data column to store editable table content (JSON format)
-- Format: { headers: string[], rows: string[][] }
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS table_data jsonb;

-- Add share_token for public sharing capability
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS share_token text UNIQUE;

-- Create index for faster lookup by share_token
CREATE INDEX IF NOT EXISTS idx_tasks_share_token ON public.tasks(share_token) WHERE share_token IS NOT NULL;

-- Create RLS policy for public access to shared tasks (view only via share token)
CREATE POLICY "Anyone can view tasks with valid share token" 
ON public.tasks 
FOR SELECT 
TO anon
USING (share_token IS NOT NULL);