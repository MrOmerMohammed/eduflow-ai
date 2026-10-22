-- Replace legacy role-only checks with active membership + permission checks.
DO $harden_academic_mutations$
DECLARE
  function_signature text;
  definition text;
  old_guard text := 'if not exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=p_actor_user_id and ur.school_id=p_school_id and r.key in(''admin'',''principal'',''vice_principal'',''organization_admin'',''super_admin'')) then raise exception ''Insufficient permission''; end if;';
  new_guard text := 'if not exists(select 1 from public.school_memberships sm where sm.user_id=p_actor_user_id and sm.school_id=p_school_id and sm.status=''active'' and sm.role in(''admin'',''principal'',''vice_principal'')) or not exists(select 1 from public.schools where id=p_school_id and status=''active'') or not private.actor_has_permission(p_actor_user_id,''academic.manage'',p_school_id) then raise exception ''Insufficient permission''; end if;';
BEGIN
  FOREACH function_signature IN ARRAY ARRAY[
    'public.create_academic_year(uuid,uuid,text,date,date,boolean)',
    'public.create_grade(uuid,uuid,text,text,integer)',
    'public.create_section(uuid,uuid,uuid,text,integer)'
  ]
  LOOP
    EXECUTE format('SELECT pg_get_functiondef(%L::regprocedure)', function_signature) INTO definition;
    IF position(old_guard in definition) = 0 THEN
      RAISE EXCEPTION 'Expected legacy authorization guard not found in %', function_signature;
    END IF;
    definition := replace(definition, old_guard, new_guard);
    EXECUTE definition;
  END LOOP;
END
$harden_academic_mutations$;
