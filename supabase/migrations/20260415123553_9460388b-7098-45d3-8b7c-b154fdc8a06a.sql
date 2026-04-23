INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('notebook-images', 'notebook-images', true, 5242880)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload notebook images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'notebook-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Public read notebook images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'notebook-images');

CREATE POLICY "Users can delete own notebook images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'notebook-images' AND (storage.foldername(name))[1] = auth.uid()::text);