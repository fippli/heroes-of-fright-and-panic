-- Resolve an email to a user id for friend requests. SECURITY DEFINER reads
-- auth.users; execution is stripped from client roles, so only the service
-- role (edge functions) can call it — no email probing from browsers.
CREATE FUNCTION public.user_id_by_email(lookup TEXT) RETURNS UUID
LANGUAGE sql SECURITY DEFINER SET search_path = auth, public AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(lookup) LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.user_id_by_email(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_id_by_email(TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_id_by_email(TEXT) FROM authenticated;
