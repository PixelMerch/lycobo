-- Private PG storage for normalized originals and display variants.
-- The browser has no direct policy; the authenticated application server owns access checks.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('lycobo-images', 'lycobo-images', false, 33554432, ARRAY['image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
SET file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types
WHERE storage.buckets.public = false;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'lycobo-images' AND public = false) THEN
    RAISE EXCEPTION 'PRIVATE_IMAGE_BUCKET_REQUIRED';
  END IF;
END;
$$;
