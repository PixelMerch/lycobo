-- CloudBase grants these roles privileges on new public objects by default.
REVOKE ALL ON FUNCTION public.lycobo_video_operation(text, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.generation_video_outbox
  FROM PUBLIC, anon, authenticated, service_role;
