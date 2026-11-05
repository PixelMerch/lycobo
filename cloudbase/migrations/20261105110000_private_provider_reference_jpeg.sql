-- The worker stores the same compressed reference bytes it previously sent inline.
-- Preserve the private bucket, existing types and video size limit.
DO $$
BEGIN
  UPDATE storage.buckets
  SET allowed_mime_types = array_append(allowed_mime_types, 'image/jpeg')
  WHERE id = 'lycobo-images'
    AND public = false
    AND allowed_mime_types @> ARRAY['image/png', 'image/webp', 'video/mp4']
    AND NOT ('image/jpeg' = ANY(allowed_mime_types));

  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id = 'lycobo-images'
      AND public = false
      AND allowed_mime_types @> ARRAY['image/png', 'image/webp', 'video/mp4', 'image/jpeg']
  ) THEN
    RAISE EXCEPTION 'PRIVATE_IMAGE_BUCKET_REQUIRED';
  END IF;
END;
$$;
