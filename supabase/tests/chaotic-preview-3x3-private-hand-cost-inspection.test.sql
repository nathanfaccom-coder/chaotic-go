-- Chaotic GO v0.1.38: non-mutating security and state-machine regression.
begin;
do $check$
declare f text; sync_fn text; proof text; who text; tab text;
begin
 foreach tab in array array[
  'chaotic_preview_3x3_attack_wallets',
  'chaotic_preview_3x3_attack_hand',
  'chaotic_preview_3x3_cost_inspections'
 ] loop
  if not (select relrowsecurity from pg_catalog.pg_class where oid=('public.'||tab)::regclass)
  then raise exception 'Training 3x3 RLS disabled: %',tab;end if;
  if has_table_privilege('anon','public.'||tab,'select')
   or has_table_privilege('authenticated','public.'||tab,'insert')
   or has_table_privilege('authenticated','public.'||tab,'update')
   or has_table_privilege('authenticated','public.'||tab,'delete')
  then raise exception 'Direct 3x3 hand state exposure or mutation: %',tab;end if;
 end loop;
 select qual into who from pg_catalog.pg_policies
 where schemaname='public' and tablename='chaotic_preview_3x3_attack_hand'
  and policyname='chaotic_preview_3x3_hand_owner';
 if who is null or position('auth.uid()' in who)=0
 or position('actor_id' in who)=0
 then raise exception 'Private hand must be accessible ONLY to its owner';end if;
 select qual into who from pg_catalog.pg_policies
 where schemaname='public' and tablename='chaotic_preview_3x3_attack_wallets'
  and policyname='chaotic_preview_3x3_wallet_owner';
 if who is null or position('auth.uid()' in who)=0 then raise exception 'Wallet leaked';end if;
 select qual into who from pg_catalog.pg_policies
 where schemaname='public' and tablename='chaotic_preview_3x3_cost_inspections'
  and policyname='chaotic_preview_3x3_cost_members';
 if who is null or position('auth.uid()' in who)=0
 or position('chaotic_match_turns' in who)=0
 then raise exception 'Inspections must be visible only to match players';end if;
 if has_function_privilege('anon','public.chaotic_prepare_preview_3x3_hand(uuid,integer)','execute')
 or has_function_privilege('anon','public.chaotic_sync_preview_3x3_hand(uuid,integer)','execute')
 or has_function_privilege('anon','public.chaotic_inspect_preview_3x3_hand_cost(uuid,integer)','execute')
 then raise exception 'Anonymous may call training wallet RPC';end if;
 if not has_function_privilege('authenticated','public.chaotic_prepare_preview_3x3_hand(uuid,integer)','execute')
 or not has_function_privilege('authenticated','public.chaotic_sync_preview_3x3_hand(uuid,integer)','execute')
 or not has_function_privilege('authenticated','public.chaotic_inspect_preview_3x3_hand_cost(uuid,integer)','execute')
 then raise exception 'Participant hand actions unavailable';end if;
 select lower(regexp_replace(pg_catalog.pg_get_functiondef(
  'public.chaotic_prepare_preview_3x3_hand(uuid,integer)'::regprocedure),'[[:space:]]+','','g')) into f;
 select lower(regexp_replace(pg_catalog.pg_get_functiondef(
  'public.chaotic_sync_preview_3x3_hand(uuid,integer)'::regprocedure),'[[:space:]]+','','g')) into sync_fn;
 select lower(regexp_replace(pg_catalog.pg_get_functiondef(
  'public.chaotic_inspect_preview_3x3_hand_cost(uuid,integer)'::regprocedure),'[[:space:]]+','','g')) into proof;
 if position('auth.uid()' in f)=0
 or position('m.current_playerisdistinctfromactor' in f)=0
 or position('l.mode<>''3x3''' in f)=0
 or position('chaotic_preview_3x3_allies' in f)=0
 or position('decks/3x3_slot_' in f)=0
 or position('pg_catalog.jsonb_array_elements_text' in f)=0
 or position('chaotic_preview_card_reference' in f)=0
 or position('pg_catalog.gen_random_uuid()' in f)=0
 or position('chaotic_preview_3x3_attack_wallets' in f)=0
 then raise exception '3x3 hand source/draw/shuffle ownership checks missing';end if;
 if position('m.current_playerisdistinctfromactor' in sync_fn)=0
 or position('w.last_draw_turn<p_expected_turn' in sync_fn)=0
 or position('ifn_hand<5then' in sync_fn)=0
 or position('card_state=''deck''' in sync_fn)=0
 then raise exception 'One-per-turn draw / hand cap missing';end if;
 if position('m.current_playerisdistinctfromactor' in proof)=0
 or position('chaotic_preview_3x3_attack_projections' in proof)=0
 or position('projected.actor_idisdistinctfromactor' in proof)=0
 or position('item.card_state<>''hand''' in proof)=0
 or position('item.attack_instance_idisdistinctfromprojected.attack_instance_id' in proof)=0
 or position('w.last_draw_turn<>p_expected_turn' in proof)=0
 or position('forupdate' in proof)=0
 then raise exception 'Hand proof does not enforce actual owned, drawn attack';end if;
 if not exists(select 1 from pg_catalog.pg_constraint
 where conrelid='public.chaotic_preview_3x3_cost_inspections'::regclass and contype='c'
 and pg_catalog.pg_get_constraintdef(oid) ilike '%can_afford%')
 then raise exception 'Attack cost affordability not database constrained';end if;
 if exists(select 1 from public.chaotic_preview_3x3_cost_inspections
 where actual_attack_cost_paid or original_card_consumed or training_hp_changed
 or official_match_modified or can_afford is distinct from(points_available>=attack_cost))
 then raise exception 'Hand inspection wrongly claims payment or changes gameplay';end if;
end $check$;
rollback;
select 'PASS v0.1.38: private shuffled hand, turn draw, owner proof, cost-only inspection and no real spending' result;