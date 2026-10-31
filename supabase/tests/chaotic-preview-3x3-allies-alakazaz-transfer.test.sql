-- Chaotic GO v0.1.33 — read-only checks for independent allied 3x3 token transfer.
begin;
do $test$
declare prep text;transfer text;policies integer;
begin
 if exists(select 1 from pg_class
   where oid in ('public.chaotic_preview_3x3_allies'::regclass,
                 'public.chaotic_preview_3x3_token_transfers'::regclass)
    and relrowsecurity=false)
 then raise exception 'Allied 3x3 tables must enable RLS';end if;
 if has_table_privilege('anon','public.chaotic_preview_3x3_allies','select')
  or has_table_privilege('authenticated','public.chaotic_preview_3x3_allies','insert')
  or has_table_privilege('authenticated','public.chaotic_preview_3x3_allies','update')
  or has_table_privilege('authenticated','public.chaotic_preview_3x3_token_transfers','insert')
  or has_table_privilege('authenticated','public.chaotic_preview_3x3_token_transfers','delete')
 then raise exception 'Client can forge 3x3 snapshots or token gifts';end if;
 if has_function_privilege('anon','public.chaotic_prepare_preview_3x3_allies(uuid,integer,integer)','execute')
  or has_function_privilege('anon','public.chaotic_transfer_preview_alakazaz_token(uuid,integer,integer)','execute')
 then raise exception 'Anonymous user can manipulate 3x3';end if;
 if not has_function_privilege('authenticated','public.chaotic_prepare_preview_3x3_allies(uuid,integer,integer)','execute')
  or not has_function_privilege('authenticated','public.chaotic_transfer_preview_alakazaz_token(uuid,integer,integer)','execute')
 then raise exception 'Valid authenticated functions not enabled';end if;
 select count(*) into policies from pg_policies
  where schemaname='public' and tablename in
   ('chaotic_preview_3x3_allies','chaotic_preview_3x3_token_transfers')
   and qual like '%auth.uid()%'
   and qual like '%chaotic_match_turns%';
 if policies<>2 then raise exception '3x3 member-only policies missing';end if;
 select lower(regexp_replace(pg_get_functiondef('public.chaotic_prepare_preview_3x3_allies(uuid,integer,integer)'::regprocedure),'[[:space:]]+','','g')) into prep;
 select lower(regexp_replace(pg_get_functiondef('public.chaotic_transfer_preview_alakazaz_token(uuid,integer,integer)'::regprocedure),'[[:space:]]+','','g')) into transfer;
 if position('m.current_playerisdistinctfromactor' in prep)=0
  or position('chaotic_game_nodes' in prep)=0
  or position('decks/3x3_slot_' in prep)=0
  or position('album' in prep)=0
  or position('pg_catalog.jsonb_array_elements' in prep)=0
  or position('chaotic_preview_mugic_token_catalog' in prep)=0
  or position('forcard_positionin4..6loop' in prep)=0
 then raise exception 'Original Deck/album identity checks missing';end if;
 if position('m.current_playerisdistinctfromactor' in transfer)=0
  or position('creature_name=''alakazaz''' in transfer)=0
  or position('donor.position=p_receiver_position' in transfer)=0
  or position('chaotic_preview_3x3_token_transfers' in transfer)=0
  or position('recipient.remaining_tokens>=20' in transfer)=0
  or position('forupdate' in transfer)=0
  or position('m.turn_no<>p_expected_turn' in transfer)=0
 then raise exception 'Atomic Alakazaz recipient/turn/replay validation missing';end if;
 if exists(select 1 from public.chaotic_preview_3x3_allies where official_match_modified
  or remaining_tokens>starting_tokens+received_tokens)
  or exists(select 1 from public.chaotic_preview_3x3_token_transfers
    where official_match_modified or official_tokens_changed or original_card_consumed)
 then raise exception 'Official cards/resources changed in preview';end if;
end $test$;
rollback;
select 'PASS v0.1.33: 3x3 authentic deck/album, ally-only Alakazaz 1-token transfer and anti-replay, no official effects' result;