-- Fix storage policy for public recruitment uploads: ensure we reference the storage.objects row, not recruitment_forms.name
DROP POLICY IF EXISTS "Public can upload recruitment files" ON storage.objects;

CREATE POLICY "Public can upload recruitment files"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'company-assets'
  AND (storage.foldername(storage.objects.name))[1] = 'recruitment'
  AND EXISTS (
    SELECT 1
    FROM public.recruitment_forms rf
    WHERE rf.id::text = (storage.foldername(storage.objects.name))[2]
      AND rf.status = 'active'
  )
);