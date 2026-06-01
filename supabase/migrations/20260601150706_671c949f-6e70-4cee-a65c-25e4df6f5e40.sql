CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'company-assets'
  AND (storage.foldername(name))[1] = 'avatars'
  AND split_part(split_part(name, '/', 2), '-', 1) = auth.uid()::text
);

CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'company-assets'
  AND (storage.foldername(name))[1] = 'avatars'
  AND split_part(split_part(name, '/', 2), '-', 1) = auth.uid()::text
);