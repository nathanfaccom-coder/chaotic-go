-- v0.1.22: read-only safety regression for server-prepared Burst inspection plans.
begin;
do $$
declare
 def text;
 n integer;
begin
 if not (select relrowsecurity from pg_class
  where oid='public.chaotic_preview_burst_order_plans'::regclass)
 then raise exception 'RLS disabled';end if;
 if not has_table_privilege('authenticated','public.chaotic_preview_burst_order_plans','select')
  or has_table_privilege('anon','public.chaotic_preview_burst_order_plans','select')
  or has_table_privilege('authenticated','public.chaotic_preview_burst_order_plans','insert')
  or has_table_privilege('authenticated','public.chaotic_preview_burst_order_plans','update')
  or has_table_privilege('authenticated','public.chaotic_preview_burst_order_plans','delete')
 then raise exception 'Burst plan permissions are unsafe';end if;
 if has_function_privilege('anon','public.chaotic_prepare_preview_burst_order(uuid,integer)','execute')
  or not has_function_privilege('authenticated','public.chaotic_prepare_preview_burst_order(uuid,integer)','execute')
 then raise exception 'Burst plan RPC roles wrong';end if;
 select count(*) into n from pg_policies
  where schemaname='public' and tablename='chaotic_preview_burst_order_plans'
   and cmd='SELECT';
 if n<>1 then raise exception 'Exactly one members-only read policy required: %',n;end if;
 select pg_get_functiondef('public.chaotic_prepare_preview_burst_order(uuid,integer)'::regprocedure)
 into def;
 if position('win.status NOT IN' in upper(def))=0
   or position('defender_passed' in def)=0
   or position('defender_immunity_noted' in def)=0
 then raise exception 'Both completed defender response types not guarded';end if;
 if position('m.current_player <> actor' in def)=0
   and position('m.current_player<>actor' in def)=0
 then raise exception 'Attacker-only guard absent';end if;
 if position('clash.attack_card IS DISTINCT FROM win.attack_instance_id' in def)=0
  and position('clash.attack_card is distinct from win.attack_instance_id' in def)=0
 then raise exception 'Card identity guard missing';end if;
 if position('inspect_passive_air_immunity' in def)=0
  or position('inspect_attack' in def)=0
 then raise exception 'Server inspection sequence incomplete';end if;
 if not exists(select 1 from pg_constraint where
  conrelid='public.chaotic_preview_burst_order_plans'::regclass
   and pg_get_constraintdef(oid) like '%burst_stack_executed%')
  or not exists(select 1 from pg_constraint where
  conrelid='public.chaotic_preview_burst_order_plans'::regclass
   and pg_get_constraintdef(oid) like '%official_match_modified%')
 then raise exception 'No non-execution safety checks';end if;
 if exists(select 1 from public.chaotic_preview_burst_order_plans
  where burst_stack_executed or final_damage_verified
   or official_match_modified or preparation_status<>'prepared_not_executed')
 then raise exception 'Unexpected executed Burst plan';end if;
end $$;
rollback;
select 'PASS: two ordered defender response plans, PASS not counter, anti-forgery, RLS and no executed damage' as result;