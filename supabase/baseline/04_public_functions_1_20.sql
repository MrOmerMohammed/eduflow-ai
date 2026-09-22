-- Production public function snapshot, functions 1-20; generated 2026-09-22.
-- DATA-FREE.

CREATE OR REPLACE FUNCTION public.ai_authorize_tool(p_actor_user_id uuid, p_school_id uuid, p_tool_slug text, p_input jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_tool public.ai_tools%rowtype; v_allowed boolean; v_reason text;
begin
 if not private.actor_has_permission(p_actor_user_id,'ai.use',p_school_id) then raise exception 'AI access denied'; end if;
 select t.* into v_tool from public.ai_tools t join public.schools s on (t.organization_id is null or s.organization_id=t.organization_id)
 where s.id=p_school_id and t.slug=p_tool_slug and t.is_active=true order by (t.organization_id is null) desc limit 1;
 if not found then return jsonb_build_object('allowed',false,'reason','Tool not found or inactive'); end if;
 v_allowed:=true; v_reason:='authorized';
 if v_tool.required_permission is not null and not private.actor_has_permission(p_actor_user_id,v_tool.required_permission,p_school_id) then v_allowed:=false; v_reason:='Required permission denied'; end if;
 insert into public.ai_action_logs(organization_id,school_id,user_id,action_name,input,status)
 select s.organization_id,p_school_id,p_actor_user_id,'tool.authorization',jsonb_build_object('tool',p_tool_slug,'input',coalesce(p_input,'{}'::jsonb)),case when v_allowed then 'authorized' else 'denied' end from public.schools s where s.id=p_school_id;
 return jsonb_build_object('allowed',v_allowed,'reason',v_reason,'tool',jsonb_build_object('slug',v_tool.slug,'name',v_tool.name,'risk_level',v_tool.risk_level,'handler_key',v_tool.handler_key,'input_schema',v_tool.input_schema));
end; $function$


CREATE OR REPLACE FUNCTION public.ai_create_conversation(p_actor_user_id uuid, p_school_id uuid, p_title text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_org uuid; v_id uuid;
begin
 if p_actor_user_id is null or p_school_id is null then raise exception 'Actor and school are required'; end if;
 if not private.actor_has_permission(p_actor_user_id,'ai.use',p_school_id) then raise exception 'AI access denied'; end if;
 select organization_id into v_org from public.schools where id=p_school_id and status='active';
 if v_org is null then raise exception 'School not found'; end if;
 insert into public.ai_conversations(organization_id,school_id,user_id,title,context)
 values(v_org,p_school_id,p_actor_user_id,nullif(btrim(p_title),''),'{}'::jsonb) returning id into v_id;
 insert into public.ai_action_logs(organization_id,school_id,user_id,action_name,input,status)
 values(v_org,p_school_id,p_actor_user_id,'conversation.create',jsonb_build_object('title',p_title),'success');
 return v_id;
end; $function$


CREATE OR REPLACE FUNCTION public.ai_list_tools(p_actor_user_id uuid, p_school_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v jsonb;
begin
 if not private.actor_has_permission(p_actor_user_id,'ai.use',p_school_id) then raise exception 'AI access denied'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('slug',t.slug,'name',t.name,'description',t.description,'input_schema',t.input_schema,'risk_level',t.risk_level,'required_permission',t.required_permission,'handler_key',t.handler_key) order by t.slug),'[]'::jsonb)
 into v from public.ai_tools t join public.schools s on (t.organization_id is null or s.organization_id=t.organization_id)
 where s.id=p_school_id and t.is_active=true;
 return v;
end; $function$


CREATE OR REPLACE FUNCTION public.ai_plan_request(p_actor_user_id uuid, p_school_id uuid, p_request_text text, p_conversation_id uuid DEFAULT NULL::uuid, p_idempotency_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_org uuid;
  v_run public.ai_execution_runs%rowtype;
  v_existing public.ai_execution_runs%rowtype;
  v_intent text;
  v_status text := 'planned';
  v_input jsonb;
  v_tool jsonb;
  v_steps jsonb := '[]'::jsonb;
  v_step jsonb;
  v_slug text;
  v_intent_step text;
  v_auth_step jsonb;
  v_risk text;
  v_any_denied boolean := false;
  v_any_confirmation boolean := false;
  v_order integer := 0;
  v_lower text := lower(btrim(p_request_text));
  v_student_ref text := null;
  v_student_ref_type text := null;
  v_date_context text := null;
  v_modifiers jsonb := '[]'::jsonb;
  v_query text := null;
  v_step_input jsonb;
begin
  if p_actor_user_id is null or p_school_id is null or nullif(btrim(p_request_text),'') is null then
    raise exception 'Actor, school and request are required';
  end if;

  if not private.actor_has_permission(p_actor_user_id,'ai.use',p_school_id) then
    raise exception 'AI access denied';
  end if;

  select organization_id into v_org
  from public.schools
  where id=p_school_id and status='active';

  if v_org is null then raise exception 'School not found'; end if;

  if p_conversation_id is not null and not exists(
    select 1 from public.ai_conversations
    where id=p_conversation_id and school_id=p_school_id and user_id=p_actor_user_id
  ) then
    raise exception 'Conversation does not belong to actor and school';
  end if;

  if p_idempotency_key is not null then
    select * into v_existing
    from public.ai_execution_runs
    where school_id=p_school_id and idempotency_key=p_idempotency_key;
    if found then
      return jsonb_build_object(
        'run_id',v_existing.id,'status',v_existing.status,'intent',v_existing.intent,
        'plan',v_existing.plan,'result',v_existing.result,'reused',true
      );
    end if;
  end if;

  -- Lightweight natural-language entity extraction. This is deterministic,
  -- auditable, and does not require an external model/API key.
  if v_lower ~ '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' then
    v_student_ref := substring(v_lower from '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}');
    v_student_ref_type := 'uuid';
  elsif v_lower ~ '(admission[[:space:]]*(number|no)|adm[[:space:]]*no)[[:space:]:#-]*[a-z0-9-]+' then
    select (regexp_matches(v_lower, '(?:admission[[:space:]]*(?:number|no)|adm[[:space:]]*no)[[:space:]:#-]*([a-z0-9-]+)', 'i'))[1] into v_student_ref;
    v_student_ref_type := 'admission_number';
  end if;

  if v_lower ~ '\m(today|todays|today''s)\M' then
    v_date_context := 'today';
  elsif v_lower ~ '\m(this week|current week|weekly)\M' then
    v_date_context := 'this_week';
  elsif v_lower ~ '\m(this month|current month|monthly)\M' then
    v_date_context := 'this_month';
  elsif v_lower ~ '\m(this year|current academic year|academic year)\M' then
    v_date_context := 'current_academic_year';
  end if;

  if v_lower ~ '\m(summary|summarize|overview|brief)\M' then
    v_modifiers := v_modifiers || '"summary"'::jsonb;
  end if;
  if v_lower ~ '\m(details|detailed|full|complete)\M' then
    v_modifiers := v_modifiers || '"detailed"'::jsonb;
  end if;
  if v_lower ~ '\m(latest|recent|last)\M' then
    v_modifiers := v_modifiers || '"latest"'::jsonb;
  end if;
  if v_lower ~ '\m(percentage|percent|rate)\M' then
    v_modifiers := v_modifiers || '"percentage"'::jsonb;
  end if;
  if v_lower ~ '\m(outstanding|due|dues|balance)\M' then
    v_modifiers := v_modifiers || '"outstanding"'::jsonb;
  end if;

  v_query := nullif(
    btrim(regexp_replace(
      regexp_replace(
        regexp_replace(v_lower,
          '(show|find|get|lookup|give|tell me|what is|what are|please|can you|could you)', ' ', 'gi'),
        '(student|pupil|child|attendance|present|absent|late|fees?|fee|payment|invoice|finance|balance|dues?|outstanding|exam|marks?|results?|report card|timetable|schedule|period|class timing|dashboard|kpi|analytics|overview|performance)', ' ', 'gi'),
      '[^a-z0-9@._ +()\-]', ' ', 'gi'
    )),
    ''
  );

  v_input := jsonb_build_object(
    'request', p_request_text,
    'query', v_query,
    'student_ref', v_student_ref,
    'student_ref_type', v_student_ref_type,
    'date_context', v_date_context,
    'modifiers', v_modifiers
  );

  -- Student lookup/search is only planned when the request explicitly
  -- references a student/pupil/child or a resolvable student identifier.
  if v_lower ~ '\m(student|pupil|child)\M' or v_student_ref is not null then
    if v_student_ref is not null then
      v_slug := 'student.get'; v_intent_step := 'student.lookup';
    else
      v_slug := 'student.search'; v_intent_step := 'student.lookup';
    end if;
    v_step_input := v_input || jsonb_build_object('purpose','resolve_student');
    v_auth_step := public.ai_authorize_tool(p_actor_user_id,p_school_id,v_slug,v_step_input);
    v_steps := v_steps || jsonb_build_array(jsonb_build_object(
      'order',jsonb_array_length(v_steps)+1,'intent',v_intent_step,
      'tool',v_auth_step->'tool','authorization',v_auth_step,'input',v_step_input
    ));
  end if;

  if v_lower ~ '\m(attendance|present|absent|late)\M' then
    v_slug := 'attendance.student'; v_intent_step := 'attendance.lookup';
    v_step_input := v_input || jsonb_build_object('purpose','attendance');
    v_auth_step := public.ai_authorize_tool(p_actor_user_id,p_school_id,v_slug,v_step_input);
    v_steps := v_steps || jsonb_build_array(jsonb_build_object(
      'order',jsonb_array_length(v_steps)+1,'intent',v_intent_step,
      'tool',v_auth_step->'tool','authorization',v_auth_step,'input',v_step_input
    ));
  end if;

  if v_lower ~ '\m(fee|fees|payment|invoice|finance|balance|dues|outstanding)\M' then
    v_slug := 'finance.student_balance'; v_intent_step := 'finance.lookup';
    v_step_input := v_input || jsonb_build_object('purpose','student_fee_balance');
    v_auth_step := public.ai_authorize_tool(p_actor_user_id,p_school_id,v_slug,v_step_input);
    v_steps := v_steps || jsonb_build_array(jsonb_build_object(
      'order',jsonb_array_length(v_steps)+1,'intent',v_intent_step,
      'tool',v_auth_step->'tool','authorization',v_auth_step,'input',v_step_input
    ));
  end if;

  if v_lower ~ '\m(exam|marks?|result|results|report card|score|scores)\M' then
    v_slug := 'exam.results'; v_intent_step := 'assessment.lookup';
    v_step_input := v_input || jsonb_build_object('purpose','exam_results');
    v_auth_step := public.ai_authorize_tool(p_actor_user_id,p_school_id,v_slug,v_step_input);
    v_steps := v_steps || jsonb_build_array(jsonb_build_object(
      'order',jsonb_array_length(v_steps)+1,'intent',v_intent_step,
      'tool',v_auth_step->'tool','authorization',v_auth_step,'input',v_step_input
    ));
  end if;

  if v_lower ~ '\m(timetable|schedule|period|class timing|class timings)\M' then
    v_slug := 'timetable.lookup'; v_intent_step := 'academic.timetable';
    v_step_input := v_input || jsonb_build_object('purpose','timetable');
    v_auth_step := public.ai_authorize_tool(p_actor_user_id,p_school_id,v_slug,v_step_input);
    v_steps := v_steps || jsonb_build_array(jsonb_build_object(
      'order',jsonb_array_length(v_steps)+1,'intent',v_intent_step,
      'tool',v_auth_step->'tool','authorization',v_auth_step,'input',v_step_input
    ));
  end if;

  if v_lower ~ '\m(dashboard|kpi|analytics|overview|performance|school performance)\M' then
    v_slug := 'management.dashboard'; v_intent_step := 'management.dashboard';
    v_step_input := v_input || jsonb_build_object('purpose','management_dashboard');
    v_auth_step := public.ai_authorize_tool(p_actor_user_id,p_school_id,v_slug,v_step_input);
    v_steps := v_steps || jsonb_build_array(jsonb_build_object(
      'order',jsonb_array_length(v_steps)+1,'intent',v_intent_step,
      'tool',v_auth_step->'tool','authorization',v_auth_step,'input',v_step_input
    ));
  end if;

  if jsonb_array_length(v_steps)=0 then
    v_slug := 'student.search'; v_intent_step := 'student.search';
    v_step_input := v_input || jsonb_build_object('purpose','fallback_search');
    v_auth_step := public.ai_authorize_tool(p_actor_user_id,p_school_id,v_slug,v_step_input);
    v_steps := jsonb_build_array(jsonb_build_object(
      'order',1,'intent',v_intent_step,
      'tool',v_auth_step->'tool','authorization',v_auth_step,'input',v_step_input
    ));
  end if;

  v_steps := (
    select coalesce(jsonb_agg(value order by (value->>'order')::int),'[]'::jsonb)
    from jsonb_array_elements(v_steps) with ordinality as x(value,ord)
    where ord <= 3
  );

  v_intent := coalesce(v_steps->0->>'intent','student.search');
  v_tool := v_steps->0->'tool';

  for v_step in select value from jsonb_array_elements(v_steps) loop
    v_auth_step := v_step->'authorization';
    if coalesce((v_auth_step->>'allowed')::boolean,false)=false then v_any_denied := true; end if;
    v_risk := coalesce(v_auth_step->'tool'->>'risk_level','read');
    if v_risk in ('write','external') then v_any_confirmation := true; end if;
  end loop;

  if v_any_denied then v_status := 'failed';
  elsif v_any_confirmation then v_status := 'awaiting_confirmation';
  else v_status := 'planned'; end if;

  insert into public.ai_execution_runs(
    organization_id,school_id,user_id,conversation_id,request_text,intent,status,idempotency_key,plan
  )
  values(
    v_org,p_school_id,p_actor_user_id,p_conversation_id,p_request_text,v_intent,v_status,p_idempotency_key,
    jsonb_build_object('intent',v_intent,'tool',v_tool,'steps',v_steps,'input',v_input)
  )
  returning * into v_run;

  for v_step in select value from jsonb_array_elements(v_steps) loop
    v_order := (v_step->>'order')::int;
    insert into public.ai_execution_steps(
      run_id,step_order,tool_slug,handler_key,risk_level,input,status,authz
    )
    values(
      v_run.id,v_order,
      coalesce(v_step->'tool'->>'slug',v_step->'authorization'->'tool'->>'slug','unavailable'),
      coalesce(v_step->'tool'->>'handler_key',v_step->'authorization'->'tool'->>'handler_key','unavailable'),
      coalesce(v_step->'tool'->>'risk_level',v_step->'authorization'->'tool'->>'risk_level','read'),
      v_step->'input',
      case when coalesce((v_step->'authorization'->>'allowed')::boolean,false)=false then 'failed'
           when v_status='awaiting_confirmation' then 'awaiting_confirmation' else 'planned' end,
      v_step->'authorization'
    );
  end loop;

  insert into public.ai_action_logs(
    organization_id,school_id,user_id,action_name,input,output,status
  )
  values(
    v_org,p_school_id,p_actor_user_id,'plan.create',
    jsonb_build_object('request',p_request_text,'run_id',v_run.id,'intent',v_intent,'steps',v_steps,'entities',v_input),
    jsonb_build_object('status',v_status,'steps',v_steps,'entities',v_input),
    case when v_status='failed' then 'denied' else 'success' end
  );

  return jsonb_build_object(
    'run_id',v_run.id,'status',v_status,'intent',v_intent,'tool',v_tool,
    'steps',v_steps,'input',v_input,'reused',false
  );
end;
$function$


CREATE OR REPLACE FUNCTION public.ai_register_tool(p_actor_user_id uuid, p_school_id uuid, p_name text, p_slug text, p_description text, p_input_schema jsonb, p_risk_level text, p_required_permission text, p_handler_key text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_org uuid; v_id uuid;
begin
 if not private.actor_has_permission(p_actor_user_id,'ai.manage',p_school_id) then raise exception 'AI management access denied'; end if;
 select organization_id into v_org from public.schools where id=p_school_id;
 if v_org is null then raise exception 'School not found'; end if;
 if p_risk_level not in ('read','write','external') then raise exception 'Invalid risk level'; end if;
 insert into public.ai_tools(organization_id,name,slug,description,input_schema,risk_level,required_permission,handler_key)
 values(v_org,p_name,p_slug,p_description,coalesce(p_input_schema,'{}'::jsonb),p_risk_level,p_required_permission,p_handler_key)
 on conflict(organization_id,slug) do update set name=excluded.name,description=excluded.description,input_schema=excluded.input_schema,risk_level=excluded.risk_level,required_permission=excluded.required_permission,handler_key=excluded.handler_key,is_active=true
 returning id into v_id;
 insert into public.ai_action_logs(organization_id,school_id,user_id,action_name,input,status)
 values(v_org,p_school_id,p_actor_user_id,'tool.register',jsonb_build_object('slug',p_slug,'risk_level',p_risk_level),'success');
 return v_id;
end; $function$


CREATE OR REPLACE FUNCTION public.assign_school_role(p_actor_user_id uuid, p_school_id uuid, p_target_user_id uuid, p_role_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_org_id uuid; v_role_id uuid; v_actor_ok boolean; v_role_name text;
begin
if p_actor_user_id is null or p_target_user_id is null then raise exception 'User is required'; end if;
if p_role_key not in ('admin','teacher','staff') then raise exception 'Invalid school role'; end if;
select s.organization_id into v_org_id from public.schools s where s.id=p_school_id and s.status='active';
if v_org_id is null then raise exception 'School not found or inactive'; end if;
select exists(select 1 from public.school_memberships sm where sm.school_id=p_school_id and sm.user_id=p_actor_user_id and sm.status='active' and sm.role='admin') into v_actor_ok;
if not v_actor_ok then raise exception 'Only school administrators can assign roles'; end if;
select r.id,r.name into v_role_id,v_role_name from public.roles r where r.key=p_role_key and r.scope='school' and r.is_system=true;
if v_role_id is null then raise exception 'School role is not configured'; end if;
insert into public.school_memberships(school_id,user_id,role,status) values(p_school_id,p_target_user_id,p_role_key,'active') on conflict(school_id,user_id) do update set role=excluded.role,status='active';
delete from public.user_roles where user_id=p_target_user_id and school_id=p_school_id;
insert into public.user_roles(user_id,role_id,organization_id,school_id) values(p_target_user_id,v_role_id,null,p_school_id);
update public.staff_members set user_id=p_target_user_id,updated_at=now() where school_id=p_school_id and lower(email)=lower((select email from auth.users where id=p_target_user_id));
insert into public.audit_logs(organization_id,school_id,actor_user_id,action,entity_type,entity_id,metadata) values(v_org_id,p_school_id,p_actor_user_id,'school.role.assign','user',p_target_user_id,jsonb_build_object('role',p_role_key,'role_name',v_role_name));
return jsonb_build_object('user_id',p_target_user_id,'school_id',p_school_id,'role',p_role_key,'role_name',v_role_name);
end; $function$


CREATE OR REPLACE FUNCTION public.assign_student_fee(p_actor_user_id uuid, p_school_id uuid, p_enrollment_id uuid, p_fee_structure_id uuid, p_amount numeric DEFAULT NULL::numeric, p_discount numeric DEFAULT 0)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid; v_amount numeric; v_fee_year uuid;
begin
 if not private.actor_has_permission(p_actor_user_id,'finance.manage',p_school_id) then raise exception 'not authorized'; end if;
 if not exists(select 1 from public.student_enrollments where id=p_enrollment_id and school_id=p_school_id) then raise exception 'enrollment does not belong to school'; end if;
 select amount,academic_year_id into v_amount,v_fee_year from public.fee_structures where id=p_fee_structure_id and school_id=p_school_id and active=true;
 if v_amount is null then raise exception 'fee structure not found or inactive'; end if;
 if not exists(select 1 from public.student_enrollments where id=p_enrollment_id and school_id=p_school_id and academic_year_id=v_fee_year) then raise exception 'fee structure and enrollment academic years do not match'; end if;
 v_amount:=coalesce(p_amount,v_amount);
 if v_amount<=0 or p_discount<0 or p_discount>v_amount then raise exception 'invalid amount or discount'; end if;
 insert into public.student_fee_assignments(school_id,enrollment_id,fee_structure_id,amount,discount,assigned_by) values(p_school_id,p_enrollment_id,p_fee_structure_id,v_amount,p_discount,p_actor_user_id) returning id into v_id;
 insert into public.audit_logs(organization_id,school_id,actor_user_id,action,entity_type,entity_id,metadata)
 select organization_id,p_school_id,p_actor_user_id,'student_fee.assign','student_fee_assignment',v_id,jsonb_build_object('enrollment_id',p_enrollment_id,'fee_structure_id',p_fee_structure_id) from public.schools where id=p_school_id;
 return v_id;
end $function$


CREATE OR REPLACE FUNCTION public.bootstrap_school_workspace(p_actor_user_id uuid, p_org_name text, p_school_name text, p_school_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_org_id uuid;
  v_school_id uuid;
  v_existing_school_id uuid;
  v_org_role_id uuid;
  v_admin_role_id uuid;
  v_slug text;
  v_full_name text;
  v_existing_role text;
  v_existing_school_name text;
  v_existing_school_code text;
begin
  if p_actor_user_id is null then raise exception 'Actor is required'; end if;
  if not exists (select 1 from auth.users where id = p_actor_user_id) then raise exception 'Actor not found'; end if;
  if nullif(trim(p_org_name), '') is null or nullif(trim(p_school_name), '') is null or nullif(trim(p_school_code), '') is null then
    raise exception 'Organization name, school name and school code are required';
  end if;

  select sm.school_id, sm.role
    into v_existing_school_id, v_existing_role
    from public.school_memberships sm
   where sm.user_id = p_actor_user_id
     and sm.status = 'active'
   limit 1;

  if v_existing_school_id is not null then
    if v_existing_role <> 'admin' then
      raise exception 'User already belongs to a school workspace';
    end if;

    select s.organization_id, s.name, s.code
      into v_org_id, v_existing_school_name, v_existing_school_code
      from public.schools s
     where s.id = v_existing_school_id
       and s.status = 'active';

    if v_org_id is null then
      raise exception 'Existing school workspace is not active';
    end if;

    return jsonb_build_object(
      'organization_id', v_org_id,
      'school_id', v_existing_school_id,
      'organization_name', (select o.name from public.organizations o where o.id = v_org_id),
      'school_name', v_existing_school_name,
      'school_code', v_existing_school_code
    );
  end if;

  select coalesce(nullif(raw_user_meta_data->>'full_name',''), email)
    into v_full_name
    from auth.users
   where id = p_actor_user_id;

  v_slug := lower(regexp_replace(trim(p_org_name), '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);
  if v_slug = '' then v_slug := 'organization'; end if;
  if exists (select 1 from public.organizations where slug = v_slug) then
    v_slug := v_slug || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,8);
  end if;

  select id into v_org_role_id
    from public.roles
   where key = 'organization_admin' and is_system = true
   limit 1;
  select id into v_admin_role_id
    from public.roles
   where key = 'admin' and is_system = true
   limit 1;
  if v_org_role_id is null or v_admin_role_id is null then
    raise exception 'Required system roles are not configured';
  end if;

  insert into public.organizations(name, slug, status)
  values (trim(p_org_name), v_slug, 'active')
  returning id into v_org_id;

  insert into public.schools(organization_id, name, code, address, settings, status)
  values (v_org_id, trim(p_school_name), upper(trim(p_school_code)), '{}'::jsonb, '{}'::jsonb, 'active')
  returning id into v_school_id;

  insert into public.organization_memberships(organization_id, user_id, role, status)
  values (v_org_id, p_actor_user_id, 'organization_admin', 'active');

  insert into public.school_memberships(school_id, user_id, role, status)
  values (v_school_id, p_actor_user_id, 'admin', 'active');

  insert into public.user_roles(user_id, role_id, organization_id, school_id)
  values
    (p_actor_user_id, v_org_role_id, v_org_id, null),
    (p_actor_user_id, v_admin_role_id, null, v_school_id);

  insert into public.user_profiles(user_id, full_name)
  values (p_actor_user_id, coalesce(v_full_name, trim(p_org_name)))
  on conflict(user_id) do update
    set full_name = coalesce(public.user_profiles.full_name, excluded.full_name),
        updated_at = now();

  insert into public.audit_logs(organization_id, school_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (
    v_org_id, v_school_id, p_actor_user_id, 'workspace.bootstrap', 'school', v_school_id,
    jsonb_build_object(
      'organization_name', trim(p_org_name),
      'school_name', trim(p_school_name),
      'school_code', upper(trim(p_school_code))
    )
  );

  return jsonb_build_object(
    'organization_id', v_org_id,
    'school_id', v_school_id,
    'organization_name', trim(p_org_name),
    'school_name', trim(p_school_name),
    'school_code', upper(trim(p_school_code))
  );
end;
$function$


CREATE OR REPLACE FUNCTION public.commit_import_batch(p_actor_user_id uuid, p_school_id uuid, p_batch_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r record; v_guardian uuid; v_student uuid; v_grade uuid; v_section uuid; v_ay uuid; v_imported integer:=0; v_skipped integer:=0; v_name text; v_first text; v_last text; v_parts text[];
begin
 if not private.actor_has_permission(p_actor_user_id,'data.import',p_school_id) then raise exception 'Data import access denied'; end if;
 select academic_year_id into v_ay from public.import_batches where id=p_batch_id and school_id=p_school_id and status='ready';
 if not found then raise exception 'Import batch is not ready to commit'; end if;
 if v_ay is null then raise exception 'Academic year is required before commit'; end if;
 for r in select * from public.import_rows where batch_id=p_batch_id and status='valid' order by row_number loop
  v_name:=btrim(r.normalized_data->>'name'); v_parts:=string_to_array(v_name,' '); v_first:=v_parts[1]; v_last:=case when array_length(v_parts,1)>1 then array_to_string(v_parts[2:array_length(v_parts,1)],' ') else null end;
  select s.id into v_student from public.students s where s.school_id=p_school_id and lower(btrim(concat_ws(' ',s.first_name,s.middle_name,s.last_name)))=lower(v_name) and regexp_replace(coalesce(s.phone,''),'[^0-9]','','g')=regexp_replace(coalesce(r.normalized_data->>'mobile',''),'[^0-9]','','g') limit 1;
  if v_student is not null then update public.import_rows set status='skipped',errors=jsonb_build_array('Student already exists') where id=r.id; v_skipped:=v_skipped+1; continue; end if;
  select id into v_grade from public.grades where school_id=p_school_id and lower(btrim(name))=lower(btrim(r.normalized_data->>'class')) limit 1;
  if v_grade is null then raise exception 'Class is not configured in this school'; end if;
  select id into v_section from public.sections where school_id=p_school_id and grade_id=v_grade order by created_at limit 1;
  insert into public.students(school_id,admission_number,first_name,last_name,phone,status,metadata) values(p_school_id,'IMP-'||upper(substr(replace(p_batch_id::text,'-',''),1,8))||'-'||r.row_number,v_first,v_last,regexp_replace(r.normalized_data->>'mobile','[^0-9]','','g'),'active',jsonb_build_object('import_batch_id',p_batch_id,'source_row',r.row_number,'source_name',v_name)) returning id into v_student;
  select id into v_guardian from public.guardians where school_id=p_school_id and regexp_replace(coalesce(phone,''),'[^0-9]','','g')=regexp_replace(r.normalized_data->>'mobile','[^0-9]','','g') limit 1;
  if v_guardian is null then insert into public.guardians(school_id,full_name,relationship,phone,address) values(p_school_id,btrim(r.normalized_data->>'father_name'),'father',regexp_replace(r.normalized_data->>'mobile','[^0-9]','','g'),'{}'::jsonb) returning id into v_guardian; end if;
  insert into public.student_guardians(student_id,guardian_id,is_primary) values(v_student,v_guardian,true) on conflict (student_id,guardian_id) do update set is_primary=excluded.is_primary;
  insert into public.student_enrollments(school_id,student_id,academic_year_id,grade_id,section_id,status) values(p_school_id,v_student,v_ay,v_grade,v_section,'active');
  update public.import_rows set status='imported',errors='[]'::jsonb where id=r.id; v_imported:=v_imported+1;
 end loop;
 update public.import_batches set status='committed',committed_rows=v_imported,skipped_rows=v_skipped,committed_at=now() where id=p_batch_id;
 insert into public.audit_logs(organization_id,school_id,actor_user_id,action,entity_type,entity_id,metadata)
 select s.organization_id,p_school_id,p_actor_user_id,'data.import.commit','import_batch',p_batch_id,jsonb_build_object('committed_rows',v_imported,'skipped_rows',v_skipped) from public.schools s where s.id=p_school_id;
 return jsonb_build_object('batch_id',p_batch_id,'committed_rows',v_imported,'skipped_rows',v_skipped);
end; $function$


CREATE OR REPLACE FUNCTION public.create_academic_year(p_actor_user_id uuid, p_school_id uuid, p_name text, p_start_date date, p_end_date date, p_is_current boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare v_id uuid; begin if p_actor_user_id is null then raise exception 'Actor is required'; end if; if not exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=p_actor_user_id and ur.school_id=p_school_id and r.key in('admin','principal','vice_principal','organization_admin','super_admin')) then raise exception 'Insufficient permission'; end if; if p_end_date<=p_start_date then raise exception 'End date must be after start date'; end if; if nullif(trim(p_name),'') is null then raise exception 'Name is required'; end if; if p_is_current then update public.academic_years set is_current=false where school_id=p_school_id; end if; insert into public.academic_years(school_id,name,start_date,end_date,is_current) values(p_school_id,trim(p_name),p_start_date,p_end_date,p_is_current) returning id into v_id; insert into public.audit_logs(school_id,actor_user_id,action,entity_type,entity_id,metadata) values(p_school_id,p_actor_user_id,'academic_year.create','academic_year',v_id,jsonb_build_object('name',trim(p_name),'is_current',p_is_current)); return jsonb_build_object('id',v_id,'school_id',p_school_id,'name',trim(p_name),'start_date',p_start_date,'end_date',p_end_date,'is_current',p_is_current); end; $function$


CREATE OR REPLACE FUNCTION public.create_communication_campaign(p_actor_user_id uuid, p_school_id uuid, p_title text, p_body text, p_channel text, p_audience_type text, p_target_student_ids uuid[] DEFAULT NULL::uuid[], p_scheduled_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid;
begin
  if not private.actor_has_permission(p_actor_user_id,'communication.send',p_school_id) then
    raise exception 'Permission denied';
  end if;
  insert into public.communication_campaigns
    (school_id,created_by,title,body,channel,audience_type,target_student_ids,scheduled_at)
  values
    (p_school_id,p_actor_user_id,btrim(p_title),btrim(p_body),p_channel,p_audience_type,p_target_student_ids,p_scheduled_at)
  returning id into v_id;
  insert into public.audit_logs(organization_id,school_id,actor_user_id,action,entity_type,entity_id,metadata)
  select s.organization_id,p_school_id,p_actor_user_id,'communication.campaign.create','communication_campaign',v_id,
         jsonb_build_object('channel',p_channel,'audience_type',p_audience_type)
  from public.schools s where s.id=p_school_id;
  return v_id;
end;
$function$


CREATE OR REPLACE FUNCTION public.create_curriculum_unit(p_actor_user_id uuid, p_school_id uuid, p_grade_id uuid, p_subject_id uuid, p_name text, p_sequence_no integer DEFAULT 1, p_description text DEFAULT NULL::text)
 RETURNS curriculum_units
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare r public.curriculum_units; begin if not private.actor_has_permission(p_actor_user_id,'academic.manage',p_school_id) then raise exception 'Permission denied'; end if; if not exists(select 1 from public.grades where id=p_grade_id and school_id=p_school_id) then raise exception 'Grade does not belong to school'; end if; if not exists(select 1 from public.subjects where id=p_subject_id and school_id=p_school_id) then raise exception 'Subject does not belong to school'; end if; insert into public.curriculum_units(school_id,grade_id,subject_id,name,sequence_no,description) values(p_school_id,p_grade_id,p_subject_id,trim(p_name),p_sequence_no,p_description) returning * into r; insert into public.audit_logs(actor_user_id,school_id,action,entity_type,entity_id,metadata) values(p_actor_user_id,p_school_id,'curriculum_unit.create','curriculum_unit',r.id,jsonb_build_object('name',r.name)); return r; end $function$


CREATE OR REPLACE FUNCTION public.create_exam(p_actor_user_id uuid, p_school_id uuid, p_academic_year_id uuid, p_name text, p_exam_type text, p_start_date date, p_end_date date, p_max_marks numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid;
begin
 if not private.actor_has_permission(p_actor_user_id,'exam.manage',p_school_id) then raise exception 'permission denied'; end if;
 if not exists(select 1 from public.academic_years where id=p_academic_year_id and school_id=p_school_id) then raise exception 'academic year does not belong to school'; end if;
 if nullif(trim(p_name),'') is null then raise exception 'name is required'; end if;
 if nullif(trim(p_exam_type),'') is null then raise exception 'exam type is required'; end if;
 if p_max_marks is null or p_max_marks<=0 then raise exception 'max marks must be positive'; end if;
 if p_end_date is not null and p_start_date is not null and p_end_date<p_start_date then raise exception 'end date must not be before start date'; end if;
 insert into public.exams(school_id,academic_year_id,name,exam_type,start_date,end_date,max_marks,created_by) values(p_school_id,p_academic_year_id,trim(p_name),trim(p_exam_type),p_start_date,p_end_date,p_max_marks,p_actor_user_id) returning id into v_id;
 insert into public.audit_logs(school_id,actor_user_id,action,entity_type,entity_id,metadata) values(p_school_id,p_actor_user_id,'exam.create','exam',v_id,jsonb_build_object('name',trim(p_name)));
 return v_id;
end $function$


CREATE OR REPLACE FUNCTION public.create_exam_subject(p_actor_user_id uuid, p_school_id uuid, p_exam_id uuid, p_subject_id uuid, p_exam_date date, p_max_marks numeric, p_pass_marks numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid; v_exam_year uuid;
begin
 if not private.actor_has_permission(p_actor_user_id,'exam.manage',p_school_id) then raise exception 'permission denied'; end if;
 select academic_year_id into v_exam_year from public.exams where id=p_exam_id and school_id=p_school_id;
 if v_exam_year is null then raise exception 'exam not found'; end if;
 if not exists(select 1 from public.subjects where id=p_subject_id and school_id=p_school_id) then raise exception 'subject not found'; end if;
 if p_max_marks is null or p_max_marks<=0 then raise exception 'max marks must be positive'; end if;
 if p_pass_marks is null or p_pass_marks<0 or p_pass_marks>p_max_marks then raise exception 'pass marks must be between 0 and max marks'; end if;
 insert into public.exam_subjects(school_id,exam_id,subject_id,exam_date,max_marks,pass_marks) values(p_school_id,p_exam_id,p_subject_id,p_exam_date,p_max_marks,p_pass_marks) returning id into v_id;
 insert into public.audit_logs(school_id,actor_user_id,action,entity_type,entity_id,metadata) values(p_school_id,p_actor_user_id,'exam.subject.create','exam_subject',v_id,jsonb_build_object('exam_id',p_exam_id,'subject_id',p_subject_id));
 return v_id;
end $function$


CREATE OR REPLACE FUNCTION public.create_fee_invoice(p_actor_user_id uuid, p_school_id uuid, p_enrollment_id uuid, p_invoice_number text, p_due_date date, p_items jsonb, p_discount numeric DEFAULT 0, p_notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare v_id uuid; v_subtotal numeric:=0; v_item jsonb; v_org uuid; begin
 if not private.actor_has_permission(p_actor_user_id,'finance.manage',p_school_id) then raise exception 'not authorized'; end if;
 if not exists(select 1 from public.student_enrollments where id=p_enrollment_id and school_id=p_school_id) then raise exception 'enrollment does not belong to school'; end if;
 if p_due_date < current_date then raise exception 'due date cannot be in the past'; end if;
 if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items)=0 then raise exception 'invoice requires items'; end if;
 for v_item in select * from jsonb_array_elements(p_items) loop
   if coalesce((v_item->>'amount')::numeric,0) <= 0 then raise exception 'invoice item amount must be positive'; end if;
   if coalesce((v_item->>'discount')::numeric,0) < 0 or coalesce((v_item->>'discount')::numeric,0) > (v_item->>'amount')::numeric then raise exception 'invalid invoice item discount'; end if;
   v_subtotal := v_subtotal + ((v_item->>'amount')::numeric - coalesce((v_item->>'discount')::numeric,0)); end loop;
 if p_discount < 0 or p_discount > v_subtotal then raise exception 'invalid invoice discount'; end if;
 insert into public.fee_invoices(school_id,enrollment_id,invoice_number,due_date,subtotal,discount,notes,created_by) values(p_school_id,p_enrollment_id,trim(p_invoice_number),p_due_date,v_subtotal,p_discount,p_notes,p_actor_user_id) returning id into v_id;
 for v_item in select * from jsonb_array_elements(p_items) loop insert into public.fee_invoice_items(school_id,invoice_id,fee_structure_id,description,amount,discount) values(p_school_id,v_id,nullif(v_item->>'fee_structure_id','')::uuid,v_item->>'description',(v_item->>'amount')::numeric,coalesce((v_item->>'discount')::numeric,0)); end loop;
 select organization_id into v_org from public.schools where id=p_school_id; insert into public.audit_logs(organization_id,school_id,actor_user_id,action,entity_type,entity_id,metadata) values(v_org,p_school_id,p_actor_user_id,'fee_invoice.create','fee_invoice',v_id,jsonb_build_object('invoice_number',p_invoice_number,'total',v_subtotal-p_discount)); return v_id; end; $function$


CREATE OR REPLACE FUNCTION public.create_fee_structure(p_actor_user_id uuid, p_school_id uuid, p_academic_year_id uuid, p_name text, p_fee_type text, p_frequency text, p_amount numeric, p_due_day integer DEFAULT NULL::integer, p_grade_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare v_id uuid; v_org uuid; begin
 if not private.actor_has_permission(p_actor_user_id,'finance.manage',p_school_id) then raise exception 'not authorized'; end if;
 if not exists(select 1 from public.academic_years where id=p_academic_year_id and school_id=p_school_id) then raise exception 'academic year does not belong to school'; end if;
 if p_grade_id is not null and not exists(select 1 from public.grades where id=p_grade_id and school_id=p_school_id) then raise exception 'grade does not belong to school'; end if;
 if p_amount <= 0 then raise exception 'amount must be positive'; end if;
 insert into public.fee_structures(school_id,academic_year_id,name,fee_type,frequency,amount,due_day,grade_id,created_by) values(p_school_id,p_academic_year_id,trim(p_name),p_fee_type,p_frequency,p_amount,p_due_day,p_grade_id,p_actor_user_id) returning id into v_id;
 select organization_id into v_org from public.schools where id=p_school_id;
 insert into public.audit_logs(organization_id,school_id,actor_user_id,action,entity_type,entity_id,metadata) values(v_org,p_school_id,p_actor_user_id,'fee_structure.create','fee_structure',v_id,jsonb_build_object('name',p_name,'amount',p_amount)); return v_id; end; $function$


CREATE OR REPLACE FUNCTION public.create_grade(p_actor_user_id uuid, p_school_id uuid, p_name text, p_code text, p_sort_order integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare v_id uuid; begin if p_actor_user_id is null then raise exception 'Actor is required'; end if; if not exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=p_actor_user_id and ur.school_id=p_school_id and r.key in('admin','principal','vice_principal','organization_admin','super_admin')) then raise exception 'Insufficient permission'; end if; if nullif(trim(p_name),'') is null or nullif(trim(p_code),'') is null then raise exception 'Name and code are required'; end if; insert into public.grades(school_id,name,code,sort_order) values(p_school_id,trim(p_name),upper(trim(p_code)),p_sort_order) returning id into v_id; insert into public.audit_logs(school_id,actor_user_id,action,entity_type,entity_id,metadata) values(p_school_id,p_actor_user_id,'grade.create','grade',v_id,jsonb_build_object('name',trim(p_name),'code',upper(trim(p_code)))); return jsonb_build_object('id',v_id,'school_id',p_school_id,'name',trim(p_name),'code',upper(trim(p_code)),'sort_order',p_sort_order); end; $function$


CREATE OR REPLACE FUNCTION public.create_guardian(p_actor_user_id uuid, p_school_id uuid, p_full_name text, p_relationship text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_address jsonb DEFAULT '{}'::jsonb, p_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_id uuid;
  v_org_id uuid;
begin
  if p_actor_user_id is null then raise exception 'Actor is required'; end if;
  if not private.actor_has_permission(p_actor_user_id, 'student.manage', p_school_id) then
    raise exception 'Insufficient permission';
  end if;
  if nullif(trim(p_full_name), '') is null then raise exception 'Guardian name is required'; end if;
  if p_user_id is not null and not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'Guardian user not found';
  end if;

  select organization_id into v_org_id from public.schools where id = p_school_id;
  insert into public.guardians(school_id, user_id, full_name, relationship, phone, email, address)
  values (
    p_school_id, p_user_id, trim(p_full_name), nullif(trim(p_relationship), ''),
    nullif(trim(p_phone), ''), nullif(trim(p_email), ''), coalesce(p_address, '{}'::jsonb)
  ) returning id into v_id;

  insert into public.audit_logs(organization_id, school_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (
    v_org_id, p_school_id, p_actor_user_id, 'guardian.create', 'guardian', v_id,
    jsonb_build_object('full_name', trim(p_full_name), 'relationship', p_relationship)
  );

  return jsonb_build_object('id', v_id, 'school_id', p_school_id, 'full_name', trim(p_full_name));
end;
$function$


CREATE OR REPLACE FUNCTION public.create_import_batch(p_actor_user_id uuid, p_school_id uuid, p_source_filename text, p_source_type text DEFAULT 'xlsx'::text, p_academic_year_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid;
begin
 if p_actor_user_id is null or p_school_id is null then raise exception 'Actor and school are required'; end if;
 if not private.actor_has_permission(p_actor_user_id,'data.import',p_school_id) then raise exception 'Data import access denied'; end if;
 if length(btrim(coalesce(p_source_filename,''))) < 1 then raise exception 'Source filename is required'; end if;
 if p_source_type not in ('xlsx','csv','json') then raise exception 'Unsupported source type'; end if;
 if p_academic_year_id is not null and not exists(select 1 from public.academic_years ay where ay.id=p_academic_year_id and ay.school_id=p_school_id) then raise exception 'Academic year does not belong to this school'; end if;
 insert into public.import_batches(school_id,created_by,academic_year_id,source_filename,source_type) values(p_school_id,p_actor_user_id,p_academic_year_id,btrim(p_source_filename),p_source_type) returning id into v_id;
 insert into public.audit_logs(organization_id,school_id,actor_user_id,action,entity_type,entity_id,metadata)
 select s.organization_id,p_school_id,p_actor_user_id,'data.import.create','import_batch',v_id,jsonb_build_object('source_filename',btrim(p_source_filename),'source_type',p_source_type) from public.schools s where s.id=p_school_id;
 return v_id;
end; $function$


CREATE OR REPLACE FUNCTION public.create_leave_request(p_actor_user_id uuid, p_school_id uuid, p_staff_id uuid, p_leave_type_id uuid, p_start_date date, p_end_date date, p_reason text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid; v_days numeric;
begin
 if not private.actor_has_permission(p_actor_user_id,'staff.manage',p_school_id) then raise exception 'permission denied'; end if;
 if p_end_date < p_start_date then raise exception 'end date must be on or after start date'; end if;
 if not exists(select 1 from public.staff_members s where s.id=p_staff_id and s.school_id=p_school_id) then raise exception 'staff member not found'; end if;
 if not exists(select 1 from public.leave_types l where l.id=p_leave_type_id and l.school_id=p_school_id and l.is_active) then raise exception 'leave type not found'; end if;
 v_days=(p_end_date-p_start_date)+1;
 if exists(select 1 from public.leave_requests r where r.staff_id=p_staff_id and r.status in ('pending','approved') and r.start_date<=p_end_date and r.end_date>=p_start_date) then raise exception 'overlapping leave request exists'; end if;
 insert into public.leave_requests(school_id,staff_id,leave_type_id,start_date,end_date,days,reason) values(p_school_id,p_staff_id,p_leave_type_id,p_start_date,p_end_date,v_days,p_reason) returning id into v_id;
 insert into public.audit_logs(actor_user_id,school_id,action,entity_type,entity_id,metadata) values(p_actor_user_id,p_school_id,'leave.create','leave_request',v_id,jsonb_build_object('staff_id',p_staff_id,'days',v_days));
 return v_id;
end;$function$

