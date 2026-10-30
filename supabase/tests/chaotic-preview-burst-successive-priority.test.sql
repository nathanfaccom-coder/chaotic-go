-- v0.1.27: transactional regression for the successive 1x1 priority ledger.
-- Read-only check; does not create players, change cards or play matches.
begin;
do $$
declare def_open text; def_pass text; def_order text; def_damage text; def_turn text;
begin
 if not (select relrowsecurity from pg_class where oid='public.chaotic_preview_burst_priority'::regclass)
  or not (select relrowsecurity from pg_class where oid='public.chaotic_preview_burst_priority_passes'::regclass)
 then raise exception 'RLS must protect the priority state and its pass journal';end if;
 if has_table_privilege('anon','public.chaotic_preview_burst_priority','select')
  or has_table_privilege('authenticated','public.chaotic_preview_burst_priority','insert')
  or has_table_privilege('authenticated','public.chaotic_preview_burst_priority','update')
  or has_table_privilege('authenticated','public.chaotic_preview_burst_priority_passes','insert')
  or has_table_privilege('authenticated','public.chaotic_preview_burst_priority_passes','delete')
 then raise exception 'Clients can forge or mutate priority passes';end if;
 if not has_table_privilege('authenticated','public.chaotic_preview_burst_priority','select')
  or not has_table_privilege('authenticated','public.chaotic_preview_burst_priority_passes','select')
 then raise exception 'Players cannot view their priority ledger';end if;
 if has_function_privilege('anon','public.chaotic_open_preview_burst_priority(uuid,integer)','execute')
  or has_function_privilege('anon','public.chaotic_pass_preview_burst_priority(uuid,integer)','execute')
 then raise exception 'Anonymous caller can forge priority';end if;
 select pg_get_functiondef('public.chaotic_open_preview_burst_priority(uuid,integer)'::regprocedure) into def_open;
 select pg_get_functiondef('public.chaotic_pass_preview_burst_priority(uuid,integer)'::regprocedure) into def_pass;
 select pg_get_functiondef('public.chaotic_prepare_preview_burst_order(uuid,integer)'::regprocedure) into def_order;
 select pg_get_functiondef('public.chaotic_calculate_individual_preview(uuid,integer)'::regprocedure) into def_damage;
 select pg_get_functiondef('public.chaotic_pass_turn(uuid,integer)'::regprocedure) into def_turn;
 if position('for update' in lower(def_pass))=0 or
    position('state.next_actor_id is distinct from actor' in def_pass)=0 or
    position('state.consecutive_passes+1' in def_pass)=0
 then raise exception 'Priority pass must enforce turn order and lock the state';end if;
 if position('m.current_player<>actor' in def_open)=0 or
    position('chaotic_preview_individual_damage' in def_open)=0
 then raise exception 'Priority opener lacks turn or retrospective replay guard';end if;
 if position('priority_state.consecutive_passes<>2' in def_order)=0
   or position('pass_seq=1 and actor_id=actor' in def_order)=0
   or position('pass_seq=2 and actor_id=win.defender_id' in def_order)=0
 then raise exception 'LIFO plan can bypass successive authenticated passes';end if;
 if position('Aguarde os dois passes de prioridade' in def_damage)=0
  or position('chaotic_preview_burst_priority' in def_turn)=0
 then raise exception 'Preview damage or turn still bypasses the priority sequence';end if;
 if not exists(select 1 from pg_constraint where conrelid='public.chaotic_preview_burst_priority'::regclass
     and pg_get_constraintdef(oid) like '%consecutive_passes%')
 then raise exception 'Priority state integrity check absent';end if;
 if exists(select 1 from public.chaotic_preview_burst_priority
     where official_match_modified or burst_fully_resolved or final_damage_verified)
 then raise exception 'Priority claims a full official resolution';end if;
end $$;
rollback;
select 'PASS: 2 sequential authenticated priority passes, private RLS, protected order/damage/turn, no official state' as result;