-- Chaotic GO 0.1.48: freeze training 3x3 actions after a recorded 3-creature outcome.
-- 1x1, original cards, the official winner, inventories, XP and currency stay untouched.
-- The terminal outcome is created inside the final HP update in v0.1.47.
-- Do not guard attack_spends UPDATE or training_damage_events INSERT:
-- v0.1.46 must still finish those statements in that SAME transaction.

create or replace function public.chaotic_guard_preview_3x3_terminal_actions()
returns trigger language plpgsql security definer set search_path=''
as $fn$
declare v_lobby_id uuid;
begin
 v_lobby_id:=new.lobby_id;
 if v_lobby_id is null then
  raise exception 'Sala de treinamento inválida';
 end if;
 if exists(select 1 from public.chaotic_preview_3x3_training_outcomes o
  where o.lobby_id=v_lobby_id)
 then raise exception
  'Treino 3x3 encerrado: as três criaturas de uma equipe foram nocauteadas';
 end if;
 return new;
end;
$fn$;
revoke all on function public.chaotic_guard_preview_3x3_terminal_actions()
 from public,anon,authenticated;

-- These source tables are all training-only, keyed by lobby_id.
-- The HP UPDATE trigger runs BEFORE the knockout/outcome AFTER trigger.
do $create_triggers$
declare t text;
begin
 foreach t in array array[
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
  execute pg_catalog.format(
   'create trigger chaotic_3x3_terminal_guard before insert or update on public.%I for each row execute function public.chaotic_guard_preview_3x3_terminal_actions()',
   t);
 end loop;
end;
$create_triggers$;

-- Attack spends INSERT should not start AFTER the training outcome.
-- UPDATE on this table after the final knockout is intentionally allowed
-- within the atomic v0.1.46 resolution (paid -> training_damage_applied).
create trigger chaotic_3x3_terminal_guard
before insert on public.chaotic_preview_3x3_attack_spends
for each row execute function public.chaotic_guard_preview_3x3_terminal_actions();

-- Do not advance the shared turn counter after a TERMINAL TRAINING outcome.
-- Keep old/current 1x1 and other matches unaffected and do not mark
-- official match.status as 'finished' or award official results.
create or replace function public.chaotic_guard_preview_3x3_terminal_turn()
returns trigger language plpgsql security definer set search_path=''
as $fn$
begin
 if new.turn_no is distinct from old.turn_no
 and exists(select 1 from public.chaotic_preview_3x3_training_outcomes o
  where o.lobby_id=old.lobby_id)
 then raise exception 'Treino 3x3 concluído; não é permitido continuar turnos experimentais';
 end if;
 return new;
end;
$fn$;
revoke all on function public.chaotic_guard_preview_3x3_terminal_turn()
 from public,anon,authenticated;
create trigger chaotic_preview_3x3_terminal_turn_guard
before update of turn_no on public.chaotic_match_turns
for each row execute function public.chaotic_guard_preview_3x3_terminal_turn();
