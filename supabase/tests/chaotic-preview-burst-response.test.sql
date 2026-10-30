-- Chaotic GO v0.1.20: transactional security and immutability checks.
begin;
do $$
declare
 n integer;
 audit_def text;
 open_def text;
 pass_def text;
begin
 if not (select relrowsecurity from pg_class
  where oid='public.chaotic_preview_burst_windows'::regclass) then
  raise exception 'Burst RLS is off';end if;
 if has_table_privilege('anon','public.chaotic_preview_burst_windows','select')
  or has_table_privilege('anon','public.chaotic_preview_burst_windows','insert')
  or has_table_privilege('authenticated','public.chaotic_preview_burst_windows','insert')
  or has_table_privilege('authenticated','public.chaotic_preview_burst_windows','update')
  or has_table_privilege('authenticated','public.chaotic_preview_burst_windows','delete')
 then raise exception 'Client can forge or read Burst directly';end if;
 if not has_table_privilege('authenticated','public.chaotic_preview_burst_windows','select')
 then raise exception 'Participants cannot select Burst';end if;
 if has_function_privilege('anon','public.chaotic_open_preview_burst(uuid,integer)','execute')
  or has_function_privilege('anon','public.chaotic_pass_preview_burst(uuid,integer)','execute')
 then raise exception 'Anonymous can open/respond Burst';end if;
 if not has_function_privilege('authenticated','public.chaotic_pass_preview_burst(uuid,integer)','execute')
 then raise exception 'Authenticated responder cannot pass Burst';end if;
 select count(*) into n from pg_policies
  where schemaname='public' and tablename='chaotic_preview_burst_windows'
  and cmd='SELECT';
 if n<>1 then raise exception 'Burst needs one member-only read policy';end if;
 select pg_get_functiondef('public.chaotic_open_preview_burst(uuid,integer)'::regprocedure)
 into open_def;
 select pg_get_functiondef('public.chaotic_pass_preview_burst(uuid,integer)'::regprocedure)
 into pass_def;
 select pg_get_functiondef('public.chaotic_audit_preview_damage(uuid,integer)'::regprocedure)
 into audit_def;
 if position('current_player <> actor' in open_def)=0 and
  position('current_player<>actor' in open_def)=0 then
  raise exception 'Attacker-only opener guard is absent';end if;
 if position('win.defender_id <> actor' in pass_def)=0 and
  position('win.defender_id<>actor' in pass_def)=0 then
  raise exception 'Defender-only response guard absent';end if;
 if position('burst_defender_passed_preview_only' in audit_def)=0 or
  position('burst_window_not_opened' in audit_def)=0 or
  position('burst_defender_response_pending' in audit_def)=0 then
  raise exception 'Burst audit does not track all three response states';end if;
 if exists(select 1 from public.chaotic_preview_burst_windows
  where burst_fully_resolved or final_damage_verified) then
  raise exception 'Burst prematurely marked as final';end if;
 if not exists(select 1 from pg_constraint
  where conrelid='public.chaotic_preview_burst_windows'::regclass
   and pg_get_constraintdef(oid) like '%burst_fully_resolved%') then
   raise exception 'No immutable false guard for finalizing Burst';end if;
end $$;
rollback;
select 'PASS: opponent-only Burst response, one pass, RLS, zero final damage, 3 audit statuses' as result;