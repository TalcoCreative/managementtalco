-- Drop the old constraint and add a new one with more options
ALTER TABLE public.reimbursements DROP CONSTRAINT IF EXISTS reimbursements_request_from_check;

ALTER TABLE public.reimbursements ADD CONSTRAINT reimbursements_request_from_check 
CHECK (request_from = ANY (ARRAY['event'::text, 'meeting'::text, 'production'::text, 'operational'::text, 'other'::text, 'training'::text, 'equipment'::text, 'software'::text, 'transport'::text, 'meal'::text, 'accommodation'::text, 'communication'::text]));