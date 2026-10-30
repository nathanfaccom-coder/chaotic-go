-- Chaotic GO 0.1.28 read-only transactional security checks
begin;
do $test$
declare q text;c text;o text;d text;t text; policy_def text;
begin
 if not (select relrowsecurity from pg_class
  where oid='public.chaotic_preview_burst_mugic_intents'::regclass) then
  raise exception 'Mugic intents RLS disabled';end if;
 if has_table_privilege('anon','public.chaotic_preview_burst_mugic_intents','select')
 or has_table_privilege('authenticated','public.chaotic_preview_burst_mugic_intents','insert')
 or has_table_privilege('authenticated','public.chaotic_preview_burst_mugic_intents','update')
 or has_table_privilege('authenticated','public.chaotic_preview_burst_mugic_intents','delete')
 then raise exception 'Client can forge or reveal Mugic intentions';end if;
 if not has_table_privilege('authenticated','public.chaotic_preview_burst_mugic_intents','select')
 then raise exception 'Own Mugic intent unreadable';end if;
 select qual into policy_def from pg_policies
 where schemaname='public' and tablename='chaotic_preview_burst_mugic_intents'
  and policyname='chaotic_burst_mugic_private_read';
 if policy_def is null or position('actor_id' in policy_def)=0
  or position('auth.uid()' in policy_def)=0 then
  raise exception 'Mugic privacy policy does not constrain actor ownership';end if;
 if has_function_privilege('anon','public.chaotic_queue_preview_burst_mugic(uuid,integer,text)','execute')
  or has_function_privilege('anon','public.chaotic_cancel_preview_burst_mugic(uuid,integer)','execute')
 then raise exception 'Anonymous account can access Mugic write RPC';end if;
 if not has_function_privilege('authenticated','public.chaotic_queue_preview_burst_mugic(uuid,integer,text)','execute')
  or not has_function_privilege('authenticated','public.chaotic_cancel_preview_burst_mugic(uuid,integer)','execute')
 then raise exception 'Authorized player Mugic RPC missing';end if;
 select pg_get_functiondef('public.chaotic_queue_preview_burst_mugic(uuid,integer,text)'::regprocedure) into q;
 select pg_get_functiondef('public.chaotic_cancel_preview_burst_mugic(uuid,integer)'::regprocedure) into c;
 select pg_get_functiondef('public.chaotic_prepare_preview_burst_order(uuid,integer)'::regprocedure) into o;
 select pg_get_functiondef('public.chaotic_calculate_individual_preview(uuid,integer)'::regprocedure) into d;
 select pg_get_functiondef('public.chaotic_pass_turn(uuid,integer)'::regprocedure) into t;
 if position('p_catalog_mugic_id not in' in q)=0
  or position('next_actor_id is distinct from actor' in q)=0
  or position('decks/1x1_slot_' in q)=0
  or position('chaotic_game_nodes' in q)=0
  or position('album' in q)=0
  or position('jsonb_array_elements_text' in q)=0
  or position('tipoCarta' in q)=0
  or position('criaturas' in q)=0 then
   raise exception 'Server did not check original Deck, captured identity, and canonical Mugic';end if;
 if position('intent_status=''cancelled''' in c)=0
  or position('actor_id=actor' in c)=0
  or position('cancelled_at=now()' in c)=0 then
   raise exception 'Cancellation can forge or discard other players intentions';end if;
 if position('chaotic_preview_burst_mugic_intents' in o)=0
  or position('chaotic_preview_burst_mugic_intents' in d)=0
  or position('chaotic_preview_burst_mugic_intents' in t)=0
 then raise exception 'Pending Mugic bypasses plan, damage, or turn';end if;
 if exists(select 1 from public.chaotic_preview_burst_mugic_intents
  where consumes_card or consumes_tokens or applied_to_official_match or effect_executed)
 then raise exception 'An experimental Mugic already changed game state';end if;
end;
$test$;
rollback;
select 'PASS: Mugic 301/302, private intent, Deck/album inspection, cancelled without consumption, guards on preview damage/turn' as result;