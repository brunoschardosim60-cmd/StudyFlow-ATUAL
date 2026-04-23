
-- Drop any existing permissive SELECT policy on storage.objects for notebook-images
-- and replace with owner-scoped listing
CREATE POLICY "Users can list own notebook images"
ON storage.objects FOR SELECT
USING (bucket_id = 'notebook-images' AND auth.uid()::text = (storage.foldername(name))[1]);
