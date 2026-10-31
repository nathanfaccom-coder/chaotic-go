-- Chaotic GO 0.1.48 — verify training-only terminal guards and final knockout transaction compatibility.
begin;
do $check$
declare tbl text; fn text; turn_fn text; n integer;
begin
 select count(*) into n from pg_trigger
 where tgname='chaotic_3x3_terminal_guard'
   and not tgisinternal and tgenabled='O';
 if n<>18 then raise exception 'Expected 17 guarded 3x3 tables + 1 spend INSERT, got %',n;end if;
 foreach tbl in array array[
  'chaotic_preview_3x3_allies',
  'chaotic_preview_3x3_board_positions',
  'chaotic_preview_3x3_move_events',
  'chaotic_preview_3x3_contact_intents',
  'chaotic_preview_3x3_attack_projections',
  'chaotic_preview_3x3_attack_wallets',
  'chaotic_preview_3x3_attack_hand',
  'chaotic_preview_3x3_cost_inspections',
  'chaotic_preview_3x3_defense_windows',
  'chaotic_preview_3x3_elemental_inspections',
  'chaotic_preview_3x3_creature_element_checks',
  'chaotic_preview_3x3_dynamic_element_checks',
  'chaotic_preview_3x3_private_equipment_checks',
  'chaotic_preview_3x3_token_transfers',
  'chaotic_preview_3x3_hand_discards',
  'chaotic_preview_3x3_hand_draw_events',
  'chaotic_preview_3x3_hp_wallets'
 ] loop
  if not exists(select 1 from pg_trigger
    where tgrelid=('public.'||tbl)::regclass
    and tgname='chaotic_3x3_terminal_guard'
    and (tgtype & 2)=2 and (tgtype & 4)=4 and (tgtype & 16)=16
    and not tgisinternal and tgenabled='O'
  ) then raise exception 'INSERT/UPDATE terminal guard missing on %',tbl;end if;
 end loop;
 if not exists(select 1 from pg_trigger
  where tgrelid='public.chaotic_preview_3x3_attack_spends'::regclass
  and tgname='chaotic_3x3_terminal_guard'
  and (tgtype & 4)=4 and (tgtype & 16)=0
  and not tgisinternal and tgenabled='O')
 then raise exception 'Spend INSERT guard must allow final-hit settlement UPDATE';end if;
 if exists(select 1 from pg_trigger
   where tgrelid='public.chaotic_preview_3x3_training_damage_events'::regclass
   and tgname='chaotic_3x3_terminal_guard')
 then raise exception 'Final-hit damage history must be insertable after KO trigger';end if;
 if not exists(select 1 from pg_trigger
  where tgrelid='public.chaotic_match_turns'::regclass
   and tgname='chaotic_preview_3x3_terminal_turn_guard'
   and (tgtype & 2)=2 and (tgtype & 16)=16 and not tgisinternal and tgenabled='O')
 then raise exception 'Terminal match turn guard not installed';end if;
 if has_function_privilege('anon','public.chaotic_guard_preview_3x3_terminal_actions()','execute')
  or has_function_privilege('authenticated','public.chaotic_guard_preview_3x3_terminal_actions()','execute')
  or has_function_privilege('anon','public.chaotic_guard_preview_3x3_terminal_turn()','execute')
  or has_function_privilege('authenticated','public.chaotic_guard_preview_3x3_terminal_turn()','execute')
 then raise exception 'Trigger-only guards should not be executable as RPC';end if;
 select lower(regexp_replace(pg_get_functiondef(
   'public.chaotic_guard_preview_3x3_terminal_actions()'::regprocedure),
   '[[:space:]]+','','g')) into fn;
 select lower(regexp_replace(pg_get_functiondef(
   'public.chaotic_guard_preview_3x3_terminal_turn()'::regprocedure),
   '[[:space:]]+','','g')) into turn_fn;
 if position('new.lobby_id' in fn)=0
  or position('chaotic_preview_3x3_training_outcomes' in fn)=0
  or position('new.turn_noisdistinctfromold.turn_no' in turn_fn)=0
  or position('chaotic_preview_3x3_training_outcomes' in turn_fn)=0
 then raise exception 'Training-only outcome check missing';end if;
 if exists(select 1 from public.chaotic_preview_3x3_training_outcomes
   where official_match_ended or official_match_modified
   or experience_awarded or currency_awarded)
 then raise exception 'Terminal training guard modified official result';end if;
end $check$;
rollback;
select 'PASS 0.1.48: 18 server action guards, turn lock, preserved atomic KO settlement, no official result' as result;