ALTER TABLE public.editorial_slides ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id);

UPDATE public.editorial_slides es
SET created_by = ep.created_by
FROM public.editorial_plans ep
WHERE es.ep_id = ep.id AND es.created_by IS NULL;