-- Keep private SECURITY DEFINER helpers out of the anonymous execution surface.
-- Authenticated execution remains for helpers referenced by RLS policies.
DO $secure_private_helper_functions$
DECLARE
  f record;
BEGIN
  FOR f IN
    SELECT n.nspname, p.proname, pg_catalog.oidvectortypes(p.proargtypes) AS args
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'private'
      AND p.prosecdef = true
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon',
      f.nspname, f.proname, f.args
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated, service_role',
      f.nspname, f.proname, f.args
    );
  END LOOP;
END
$secure_private_helper_functions$;

-- This helper accepts an arbitrary actor id and is intended only for calls from
-- trusted SECURITY DEFINER functions, not as a direct client-callable predicate.
REVOKE EXECUTE ON FUNCTION private.actor_has_permission(uuid, text, uuid)
  FROM PUBLIC, anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA private
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA private
  GRANT EXECUTE ON FUNCTIONS TO authenticated, service_role;
