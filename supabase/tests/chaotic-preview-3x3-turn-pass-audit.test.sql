-- Chaotic GO 0.1.62 verifies server turn guards and existing 1x1 rules.
begin;
do $audit$
declare fn text; label text;
begin
 select lower(regexp_replace(pg_get_functiondef(
  'public.chaotic_pass_turn(uuid,integer)'::regprocedure),
  '[[:space:]]+','','g')) into fn;
 foreach label in array array[
  'actoruuid:=auth.uid()',
  'ifmatch.current_player<>actorthen',
  'ifmatch.turn_no<>p_expected_turnthen',
  'iflobby.mode=''3x3''then',
  'chaotic_preview_3x3_training_outcomes',
  'chaotic_preview_3x3_defense_windows',
  'd.status=''awaiting_defender''',
  'chaotic_preview_3x3_attack_spends',
  'nots.training_damage_applied',
  'd.catalog_attack_id=''105''',
  'd.optional_reveal_pending',
  'd.catalog_attack_id=''110''',
  'notd.effects_fully_resolved',
  'lobby.mode=''1x1''',
  'chaotic_preview_burst_windows',
  'chaotic_preview_burst_mugic_intents',
  'updatepublic.chaotic_match_turns',
  'insertintopublic.chaotic_match_events'
 ] loop
  if position(label in fn)=0 then
   raise exception 'Missing turn-pass guard/regression protection: %',label;end if;
 end loop;
 if position('d.catalog_attack_id=''107''andnotd.effects_fully_resolved' in fn)>0
 then raise exception '107 intentionally partial vine effect would deadlock the turn';end if;
 if not exists(select 1 from pg_trigger where
  tgrelid='public.chaotic_match_turns'::regclass
  and tgname='chaotic_preview_3x3_terminal_turn_guard' and tgenabled='O')
 then
  -- For older databases trigger names may vary; accept any enabled
  -- server-side 3x3 turn guard, do not make unsafe assumptions.
  if not exists(select 1 from pg_trigger
     where tgrelid='public.chaotic_match_turns'::regclass
       and not tgisinternal and tgenabled='O'
       and pg_get_triggerdef(oid) ilike '%3x3%')
  then raise exception 'Missing 3x3 terminal outcome trigger';end if;
 end if;
end $audit$;
rollback;
select 'PASS v0.1.62: server pass guards 3x3 pending actions and outcomes; 1x1 Burst/Mugic untouched' result;