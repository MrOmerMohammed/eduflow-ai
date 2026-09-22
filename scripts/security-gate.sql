-- EduFlow AI production security gate
-- READ-ONLY / rollback-only verification. Never run as a data migration.
-- Uses the two existing production admin identities and production schools.

begin;

-- RLS visibility: Cambridge admin must see its own school but not Shah.
set local role authenticated;
select set_config('request.jwt.claim.sub','9e8974fc-4e89-488f-a094-92d9e0e47894',true);

select
  (select count(*) from public.schools where id='0f531d29-cf28-41f3-9b54-8272adf29b2b') as own_school_visible,
  (select count(*) from public.schools where id='877b4b0d-374d-49d1-a91b-2b768d678aa8') as other_school_visible;

-- Cross-school privileged mutation must fail.
do $$
begin
  begin
    perform public.create_grade(
      '9e8974fc-4e89-488f-a094-92d9e0e47894',
      '877b4b0d-374d-49d1-a91b-2b768d678aa8',
      'SECURITY-TEST-GRADE','SEC',999
    );
    raise exception 'CROSS_SCHOOL_MUTATION_UNEXPECTEDLY_SUCCEEDED';
  exception when others then
    if sqlerrm = 'CROSS_SCHOOL_MUTATION_UNEXPECTEDLY_SUCCEEDED' then raise; end if;
  end;
end $$;

rollback;

-- Expected:
-- own_school_visible = 1
-- other_school_visible = 0
-- cross-school mutation produces an authorization failure and transaction rolls back.
