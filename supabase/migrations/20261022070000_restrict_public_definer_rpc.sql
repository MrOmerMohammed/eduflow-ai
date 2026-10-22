-- Restrict privileged public RPCs to the trusted server-side gateway.
-- The application calls these functions through /api/gateway using the server-only
-- Supabase secret key. Do not expose SECURITY DEFINER functions directly to clients.
DO $secure_public_definer_functions$
DECLARE
  f record;
BEGIN
  FOR f IN
    SELECT n.nspname, p.proname, pg_catalog.oidvectortypes(p.proargtypes) AS args
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated',
      f.nspname, f.proname, f.args
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role',
      f.nspname, f.proname, f.args
    );
  END LOOP;
END
$secure_public_definer_functions$;

-- New functions must not become client-callable by default.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO service_role;
