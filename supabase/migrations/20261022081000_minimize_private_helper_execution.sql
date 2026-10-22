-- Only grant authenticated callers the private helpers referenced by RLS policies.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.is_org_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_school_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.has_staff_permission(text, uuid) TO authenticated, service_role;
