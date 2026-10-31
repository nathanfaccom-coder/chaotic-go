-- Chaotic GO v0.1.32: original Arpa +1 training token, safe nonmutating regression.
begin;
do $test$
declare f text; pname text;
begin
 if not (select relrowsecurity from pg_class where oid='public.chaotic_preview_harp_token_events'::regclass)
  or has_table_privilege('anon','public.chaotic_preview_harp_token_events','select')
  or has_table_privilege('authenticated','public.chaotic_preview_harp_token_events','insert')
  or has_table_privilege('authenticated','public.chaotic_preview_harp_token_events','update')
  or has_table_privilege('authenticated','public.chaotic_preview_harp_token_events','delete')
 then raise exception 'Private Harp journal RLS/grants invalid';end if;
 if not has_table_privilege('authenticated','public.chaotic_preview_harp_token_events','select')
 or has_function_privilege('anon','public.chaotic_discard_preview_harp_for_token(uuid,integer)','execute')
 or not has_function_privilege('authenticated','public.chaotic_discard_preview_harp_for_token(uuid,integer)','execute')
 then raise exception 'Harp RPC execution permissions unsafe';end if;
 select qual into pname from pg_policies
 where schemaname='public' and tablename='chaotic_preview_harp_token_events'
 and policyname='chaotic_preview_harp_token_members_read';
 if pname is null or position('auth.uid()' in pname)=0 or position('chaotic_match_turns' in pname)=0
 then raise exception 'Member-only RLS policy missing';end if;
 select lower(regexp_replace(pg_get_functiondef('public.chaotic_discard_preview_harp_for_token(uuid,integer)'::regprocedure),
 '[[:space:]]+','','g')) into f;
 if position('auth.uid()' in f)=0
  or position('m.current_playerisdistinctfromactor' in f)=0
  or position('m.turn_no<>p_expected_turn' in f)=0
  or position('chaotic_preview_loadouts' in f)=0
  or position('chaotic_preview_equipment_reveals' in f)=0
  or position('equipment_nameisdistinctfrom' in f)=0
  or position('revelation.equipment_instance_idisdistinctfromunit.equipment_instance_id' in f)=0
  or position('wallet.creature_instance_idisdistinctfromunit.card_instance_id' in f)=0
  or position('wallet.bonus_tokens<>0' in f)=0
  or position('chaotic_preview_clashes' in f)=0
  or position('chaotic_preview_burst_windows' in f)=0
  or position('chaotic_preview_harp_token_events' in f)=0
  or position('forupdate' in f)=0
 then raise exception 'Missing server checks for Harp identity, reveal, replay or turn';end if;
 if not exists(select 1 from pg_constraint where conrelid='public.chaotic_preview_mugic_token_wallets'::regclass
   and pg_get_constraintdef(oid) like '%remaining_tokens%starting_tokens%bonus_tokens%')
 then raise exception 'Bonus token limit not constrained in wallet';end if;
 if exists(select 1 from public.chaotic_preview_harp_token_events
 where original_equipment_discarded or official_tokens_changed or official_match_modified
 or tokens_after<>tokens_before+1)
 then raise exception 'Official card state or token accounting changed';end if;
end $test$;
rollback;
select 'PASS v0.1.32: Arpa Mágica +1 training token one-time, reveal, authenticated turn, original card untouched' as result;