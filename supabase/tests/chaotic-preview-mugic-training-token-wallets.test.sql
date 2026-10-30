-- Chaotic GO v0.1.30: database regression for token costs (safe, read-only).
begin;
do $test$
declare f text; fw text; c integer;
begin
 select count(*) into c from public.chaotic_preview_mugic_token_catalog;
 if c<>16 then raise exception 'Original creature cap count invalid';end if;
 if (select starting_tokens from public.chaotic_preview_mugic_token_catalog where creature_name='Alakazaz')<>5
 or (select starting_tokens from public.chaotic_preview_mugic_token_catalog where creature_name='Ferez')<>0
 or (select starting_tokens from public.chaotic_preview_mugic_token_catalog where creature_name='Xamã')<>4
 then raise exception 'Original token values differ from the card catalog';end if;
 if exists(select 1 from pg_class where oid in (
  'public.chaotic_preview_mugic_token_catalog'::regclass,
  'public.chaotic_preview_mugic_token_wallets'::regclass,
  'public.chaotic_preview_mugic_token_settlements'::regclass) and not relrowsecurity)
 then raise exception 'Missing table RLS';end if;
 if has_table_privilege('anon','public.chaotic_preview_mugic_token_wallets','select')
 or has_table_privilege('authenticated','public.chaotic_preview_mugic_token_wallets','insert')
 or has_table_privilege('authenticated','public.chaotic_preview_mugic_token_wallets','update')
 or has_table_privilege('authenticated','public.chaotic_preview_mugic_token_settlements','insert')
 or has_table_privilege('authenticated','public.chaotic_preview_mugic_token_catalog','select')
 then raise exception 'Training token state exposes direct mutation';end if;
 if has_function_privilege('anon','public.chaotic_prepare_preview_mugic_token_wallet(uuid,integer)','execute')
 or has_function_privilege('anon','public.chaotic_simulate_preview_mugic_counter_cost(uuid,integer)','execute')
 then raise exception 'Anonymous RPC access granted';end if;
 select lower(regexp_replace(pg_get_functiondef('public.chaotic_prepare_preview_mugic_token_wallet(uuid,integer)'::regprocedure),'[[:space:]]+','','g')) into fw;
 select lower(regexp_replace(pg_get_functiondef('public.chaotic_simulate_preview_mugic_counter_cost(uuid,integer)'::regprocedure),'[[:space:]]+','','g')) into f;
 if position('chaotic_preview_mugic_token_catalog' in fw)=0
 or position('onconflict(lobby_id,actor_id)donothing' in fw)=0
 or position('result.creature_instance_idisdistinctfromunit.card_instance_id' in fw)=0
 then raise exception 'Wallet source/reinitialization check absent';end if;
 if position('forupdate' in f)=0
 or position('m.current_playerisdistinctfromactor' in f)=0
 or position('chaotic_preview_burst_mugic_counterplans' in f)=0
 or position('chaotic_preview_mugic_token_settlements' in f)=0
 or position('wallet_a.remaining_tokens<1' in f)=0
 or position('wallet_d.remaining_tokens<2' in f)=0
 or position('intent_status=''resolved_training''' in f)=0
 or position('getdiagnosticschanged=row_count' in f)=0
 then raise exception 'Atomic cost/turn/replay guard missing';end if;
 if not exists(select 1 from pg_constraint where conrelid='public.chaotic_preview_mugic_token_settlements'::regclass
  and pg_get_constraintdef(oid) like '%attacker_tokens_after%')
 then raise exception 'No arithmetic consistency check';end if;
 if not exists(select 1 from pg_constraint where conrelid='public.chaotic_preview_burst_mugic_intents'::regclass
  and pg_get_constraintdef(oid) like '%resolved_training%')
 then raise exception 'Training intent status check absent';end if;
 if exists(select 1 from public.chaotic_preview_mugic_token_wallets where official_match_modified)
  or exists(select 1 from public.chaotic_preview_mugic_token_settlements
    where official_match_modified or original_card_consumed or actual_mugic_effect_executed)
 then raise exception 'Official resource modification detected';end if;
end $test$;
rollback;
select 'PASS v0.1.30: 16 caps, private 1+2 atomic token cost and no official state' result;