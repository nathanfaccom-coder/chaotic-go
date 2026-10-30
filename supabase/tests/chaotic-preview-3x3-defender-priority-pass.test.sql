-- Chaotic GO v0.1.41: read-only regression for two-player 3x3 defender pass.
begin;
do $check$
declare open_fn text; defense_fn text; guard_fn text; trigger_stmt text; reader_policy text;
begin
 if not (select relrowsecurity from pg_catalog.pg_class
   where oid='public.chaotic_preview_3x3_defense_windows'::regclass)
 then raise exception 'Reaction window table has no RLS';end if;
 if has_table_privilege('anon','public.chaotic_preview_3x3_defense_windows','select')
  or has_table_privilege('authenticated','public.chaotic_preview_3x3_defense_windows','insert')
  or has_table_privilege('authenticated','public.chaotic_preview_3x3_defense_windows','update')
  or has_table_privilege('authenticated','public.chaotic_preview_3x3_defense_windows','delete')
 then raise exception 'Defender window can be forged by a client';end if;
 if not has_table_privilege('authenticated','public.chaotic_preview_3x3_defense_windows','select')
  or has_function_privilege('anon','public.chaotic_open_preview_3x3_defense_window(uuid,integer)','execute')
  or has_function_privilege('anon','public.chaotic_pass_preview_3x3_defense(uuid,integer)','execute')
  or not has_function_privilege('authenticated','public.chaotic_open_preview_3x3_defense_window(uuid,integer)','execute')
  or not has_function_privilege('authenticated','public.chaotic_pass_preview_3x3_defense(uuid,integer)','execute')
 then raise exception 'Authentication grants for defender pass invalid';end if;
 select qual into reader_policy from pg_catalog.pg_policies
  where schemaname='public' and tablename='chaotic_preview_3x3_defense_windows'
   and policyname='chaotic_preview_3x3_defense_members_read';
 if reader_policy is null or position('auth.uid()' in reader_policy)=0
  or position('chaotic_match_turns' in reader_policy)=0
 then raise exception 'Only two match participants may inspect priority';end if;
 select lower(regexp_replace(pg_catalog.pg_get_functiondef(
  'public.chaotic_open_preview_3x3_defense_window(uuid,integer)'::regprocedure),
   '[[:space:]]+','','g')) into open_fn;
 select lower(regexp_replace(pg_catalog.pg_get_functiondef(
  'public.chaotic_pass_preview_3x3_defense(uuid,integer)'::regprocedure),
   '[[:space:]]+','','g')) into defense_fn;
 select lower(regexp_replace(pg_catalog.pg_get_functiondef(
  'public.chaotic_guard_preview_3x3_defense_turn_advance()'::regprocedure),
   '[[:space:]]+','','g')) into guard_fn;
 if position('auth.uid()' in open_fn)=0
  or position('m.current_playerisdistinctfromactor' in open_fn)=0
  or position('m.turn_no<>p_expected_turn' in open_fn)=0
  or position('l.mode<>''3x3''' in open_fn)=0
  or position('chaotic_preview_3x3_attack_spends' in open_fn)=0
  or position('spent.training_points_paid' in open_fn)=0
  or position('spent.training_card_spent' in open_fn)=0
  or position('chaotic_preview_3x3_contact_intents' in open_fn)=0
  or position('chaotic_preview_3x3_attack_projections' in open_fn)=0
  or position('forupdate' in open_fn)=0
 then raise exception 'Attacker open requires own turn, paid card and valid contact';end if;
 if position('auth.uid()' in defense_fn)=0
  or position('w.defender_idisdistinctfromactor' in defense_fn)=0
  or position('w.attacker_idisdistinctfromm.current_player' in defense_fn)=0
  or position('w.status<>''awaiting_defender''' in defense_fn)=0
  or position('w.defender_passed_atisnotnull' in defense_fn)=0
  or position('status=''defender_passed_preview''' in defense_fn)=0
  or position('forupdate' in defense_fn)=0
 then raise exception 'Defender must pass only their own pending window exactly once';end if;
 if position('new.turn_noisdistinctfromold.turn_no' in guard_fn)=0
  or position('chaotic_preview_3x3_attack_spends' in guard_fn)=0
  or position('chaotic_preview_3x3_defense_windows' in guard_fn)=0
  or position('w.status=''defender_passed_preview''' in guard_fn)=0
  or position('w.attacker_id=old.current_player' in guard_fn)=0
 then raise exception 'Turn advance is not guarded for a paid 3x3 Attack';end if;
 select pg_catalog.pg_get_triggerdef(oid) into trigger_stmt
 from pg_catalog.pg_trigger
 where tgrelid='public.chaotic_match_turns'::regclass
   and tgname='chaotic_preview_3x3_defense_turn_guard'
   and not tgisinternal and tgenabled='O';
 if trigger_stmt is null
  or position('BEFORE UPDATE OF turn_no' in trigger_stmt)=0
  or position('chaotic_guard_preview_3x3_defense_turn_advance' in trigger_stmt)=0
 then raise exception 'Defender before-turn trigger missing';end if;
 if not exists(select 1 from pg_catalog.pg_constraint
  where conrelid='public.chaotic_preview_3x3_defense_windows'::regclass
   and contype='p' and pg_catalog.pg_get_constraintdef(oid) like '%turn_no%')
 then raise exception 'Repeated priority windows are not prevented';end if;
 if exists(select 1 from public.chaotic_preview_3x3_defense_windows
  where defensive_card_verified or defensive_effect_executed or training_hp_changed
   or official_hp_changed or official_match_modified)
 then raise exception 'Defensive pass falsely applied a real defensive effect';end if;
end $check$;
rollback;
select 'PASS v0.1.41: paid 3x3 Attack, defender-only pass, turn guard, private RLS, no HP/effects' as result;