-- Allow the server to save video results in the existing private media bucket.
DO $$
BEGIN
  UPDATE storage.buckets
  SET file_size_limit = GREATEST(file_size_limit, 134217728),
      allowed_mime_types = CASE
        WHEN 'video/mp4' = ANY(allowed_mime_types) THEN allowed_mime_types
        ELSE array_append(allowed_mime_types, 'video/mp4')
      END
  WHERE id = 'lycobo-images' AND public = false
    AND allowed_mime_types @> ARRAY['image/png', 'image/webp'];

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRIVATE_IMAGE_BUCKET_REQUIRED';
  END IF;
END;
$$;
