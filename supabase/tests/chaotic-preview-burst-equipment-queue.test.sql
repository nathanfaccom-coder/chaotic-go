-- Chaotic GO 0.1.23: verify queue, LIFO inspection and protected damage.
begin;
do $$
declare
 def text;
 n int;
begin
 if not (select relrowsecurity from pg_class
  where oid='public.chaotic_preview_burst_equipment_responses'::regclass)
 then raise exception 'Burst equipment RLS disabled';end if;
 if not has_table_privilege('authenticated',
   'public.chaotic_preview_burst_equipment_responses','select')
  or has_table_privilege('anon',
   'public.chaotic_preview_burst_equipment_responses','select')
  or has_table_privilege('authenticated',
   'public.chaotic_preview_burst_equipment_responses','insert')
  or has_table_privilege('authenticated',
   'public.chaotic_preview_burst_equipment_responses','update')
  or has_table_privilege('authenticated',
   'public.chaotic_preview_burst_equipment_responses','delete')
 then raise exception 'Burst response permissions not read-only';end if;
 if has_function_privilege('anon',
   'public.chaotic_queue_preview_burst_equipment(uuid,integer)','execute')
  or not has_function_privilege('authenticated',
   'public.chaotic_queue_preview_burst_equipment(uuid,integer)','execute')
 then raise exception 'Incorrect authenticated response permissions';end if;
 select pg_get_functiondef(
  'public.chaotic_queue_preview_burst_equipment(uuid,integer)'::regprocedure
 ) into def;
 if position('w.defender_id' in def)=0
  or position('unit.equipment_instance_id' in def)=0
  or position('chaotic_preview_equipment_reveals' in def)=0
  or position('awaiting_defender' in def)=0
 then raise exception 'Response must validate defender, frozen gear and waiting phase';end if;
 select pg_get_functiondef(
  'public.chaotic_prepare_preview_burst_order(uuid,integer)'::regprocedure
 ) into def;
 if position('inspect_queued_equipment_reveal' in def)=0
  or position('inspect_attack' in def)=0
 then raise exception 'LIFO plan must inspect equipment before attack';end if;
 select pg_get_functiondef(
  'public.chaotic_calculate_individual_preview(uuid,integer)'::regprocedure
 ) into def;
 if position('chaotic_preview_burst_equipment_responses' in def)=0
  or position('queued_unexecuted' in def)=0
 then raise exception 'Damage must remain blocked while equipment reveal is queued';end if;
 if not exists(
  select 1 from pg_constraint
  where conrelid='public.chaotic_preview_burst_equipment_responses'::regclass
   and pg_get_constraintdef(oid) like '%equipment_actually_revealed%'
 ) or not exists(
  select 1 from pg_constraint
  where conrelid='public.chaotic_preview_burst_equipment_responses'::regclass
   and pg_get_constraintdef(oid) like '%official_match_modified%'
 ) then raise exception 'Equipment execution guards missing';end if;
 select count(*) into n from public.chaotic_preview_burst_equipment_responses
 where equipment_actually_revealed or official_match_modified
   or resolution_status<>'queued_unexecuted';
 if n<>0 then raise exception 'Unexpected executed equipment';end if;
 if not exists(
  select 1 from pg_policies
  where schemaname='public' and tablename='chaotic_preview_burst_equipment_responses'
    and cmd='SELECT'
 ) then raise exception 'Participants read policy missing';end if;
end $$;
rollback;
select 'PASS: defender-only equipment queue, LIFO, unexecuted state, RLS and damage guard' as result;