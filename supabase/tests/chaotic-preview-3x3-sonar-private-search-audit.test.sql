-- v0.1.55: Supabase private SONAR search verification, no persistent writes.
begin;
do $audit$
declare src text; ledger_policy text; checkdef text; key text;
begin
 if not (select relrowsecurity from pg_class
   where oid='public.chaotic_preview_3x3_sonar_search_events'::regclass)
 or has_table_privilege('anon','public.chaotic_preview_3x3_sonar_search_events','select')
 or not has_table_privilege('authenticated','public.chaotic_preview_3x3_sonar_search_events','select')
 or has_table_privilege('authenticated','public.chaotic_preview_3x3_sonar_search_events','insert')
 or has_table_privilege('authenticated','public.chaotic_preview_3x3_sonar_search_events','update')
 or has_table_privilege('authenticated','public.chaotic_preview_3x3_attack_hand','update')
 then raise exception 'Private card state or RLS privileges are unsafe';end if;
 select qual into ledger_policy from pg_policies where schemaname='public'
  and tablename='chaotic_preview_3x3_sonar_search_events'
  and policyname='chaotic_preview_3x3_sonar_search_private_actor_read';
 if ledger_policy is null or position('actor_id' in ledger_policy)=0
 or position('auth.uid()' in ledger_policy)=0
 then raise exception 'Private SONAR events visible to opponent';end if;
 if has_function_privilege('anon',
  'public.chaotic_resolve_preview_3x3_sonar_search(uuid,integer,integer,boolean)','execute')
 or not has_function_privilege('authenticated',
  'public.chaotic_resolve_preview_3x3_sonar_search(uuid,integer,integer,boolean)','execute')
 then raise exception 'SONAR search RPC grants invalid';end if;
 select lower(regexp_replace(pg_get_functiondef(
  'public.chaotic_resolve_preview_3x3_sonar_search(uuid,integer,integer,boolean)'::regprocedure),
  '[[:space:]]+','','g')) into src;
 foreach key in array array[
  'actoruuid:=auth.uid()','m.current_playerisdistinctfromactor',
  'spent.catalog_attack_id<>''110''',
  'dmg.catalog_attack_id<>''110''',
  'spent.training_damage_applied','chaotic_preview_3x3_training_outcomes',
  'cost_value<=1','count_hand<5','wallet.total_cards',
  'x.card->>''id''=card_row.attack_instance_id',
  'x.card->>''tipocarta''=''ataque''',
  'x.card->>''nome''=c.card_name',
  'training_elemental_sonar_110_search_complete',
  'seteffects_fully_resolved=true',
  'original_card_consumed'
 ] loop
  if position(key in src)=0 then raise exception 'SONAR safeguard missing: %',key;end if;
 end loop;
 if not exists(select 1 from pg_trigger
  where tgrelid='public.chaotic_preview_3x3_sonar_search_events'::regclass
  and tgname='chaotic_3x3_terminal_guard' and tgenabled='O')
 then raise exception 'Terminal match guard missing';end if;
 select pg_get_constraintdef(oid) into checkdef from pg_constraint
  where conrelid='public.chaotic_preview_3x3_training_damage_events'::regclass
   and conname='chaotic_preview_3x3_training_elemental_attack_catalog_check';
 if checkdef is null or position('110' in checkdef)=0
  or position('101' in checkdef)=0 or position('114' in checkdef)=0
 then raise exception 'Existing eight attacks not retained';end if;
 if exists(select 1 from pg_publication_tables where pubname='supabase_realtime'
  and schemaname='public' and tablename='chaotic_preview_3x3_sonar_search_events')
 then raise exception 'Private SONAR receipt leaked via Realtime';end if;
end $audit$;
rollback;
select 'PASS v0.1.55: private search RLS, owner-only RPC, canonical cost, terminal guard, replay and no broadcast' as result;