-- Chaotic GO v0.1.66: read-only, member-scoped reconnection checkpoint.
-- The caller cannot invoke a combat action through this function; it only
-- reports the current stage for this particular authenticated participant.
-- No private hand/deck, identities, card IDs, damage amounts or rewards leak.
create or replace function public.chaotic_get_preview_3x3_resume_status(
  p_lobby_id uuid
) returns jsonb
language plpgsql stable security definer set search_path=''
as $resume$
declare
  actor uuid:=auth.uid();
  lobby public.chaotic_lobbies;
  match_state public.chaotic_match_turns;
  attack_owner uuid;
  defense_owner uuid;
  defense_status text;
  paid_damage_applied boolean;
  damage_card text;
  pending_reveal boolean;
  effects_done boolean;
  has_contact boolean;
  has_projection boolean;
  winner uuid;
  phase text;
  should_act boolean:=false;
begin
  if actor is null or p_lobby_id is null
  then raise exception 'Faça login para recuperar o treino 3x3';end if;
  select * into lobby from public.chaotic_lobbies where id=p_lobby_id;
  select * into match_state from public.chaotic_match_turns where lobby_id=p_lobby_id;
  if lobby.id is null or match_state.lobby_id is null
    or lobby.mode<>'3x3' or lobby.status<>'ready'
    or lobby.expires_at<=statement_timestamp()
    or match_state.status not in('active','finished')
    or lobby.host_id is distinct from match_state.host_id
    or lobby.guest_id is distinct from match_state.guest_id
    or actor not in(lobby.host_id,lobby.guest_id)
  then raise exception 'Recuperação disponível somente aos dois membros da sala 3x3';end if;
  select winner_id into winner from public.chaotic_preview_3x3_training_outcomes
    where lobby_id=p_lobby_id;
  select s.actor_id,s.training_damage_applied
    into attack_owner,paid_damage_applied
    from public.chaotic_preview_3x3_attack_spends s
    where s.lobby_id=p_lobby_id and s.turn_no=match_state.turn_no
    order by s.created_at desc limit 1;
  select w.defender_id,w.status into defense_owner,defense_status
    from public.chaotic_preview_3x3_defense_windows w
    where w.lobby_id=p_lobby_id and w.turn_no=match_state.turn_no
    order by w.created_at desc limit 1;
  select d.catalog_attack_id,d.optional_reveal_pending,d.effects_fully_resolved
    into damage_card,pending_reveal,effects_done
    from public.chaotic_preview_3x3_training_damage_events d
    where d.lobby_id=p_lobby_id and d.turn_no=match_state.turn_no
    order by d.created_at desc limit 1;
  select exists(select 1 from public.chaotic_preview_3x3_contact_intents
    where lobby_id=p_lobby_id and turn_no=match_state.turn_no) into has_contact;
  select exists(select 1 from public.chaotic_preview_3x3_attack_projections
    where lobby_id=p_lobby_id and turn_no=match_state.turn_no) into has_projection;
  phase:=case
    when winner is not null then 'training_finished'
    when match_state.status<>'active' then 'session_closed'
    when defense_status='awaiting_defender' then 'awaiting_defender'
    when attack_owner is not null and not coalesce(paid_damage_applied,false) then 'awaiting_damage'
    when damage_card='105' and coalesce(pending_reveal,false) then 'awaiting_optional_reveal'
    when damage_card='110' and not coalesce(effects_done,false) then 'awaiting_sonar_search'
    when damage_card is not null then 'damage_settled'
    when has_projection then 'awaiting_payment'
    when has_contact then 'contact_open'
    else 'ready'
  end;
  should_act:=case
    when phase='awaiting_defender' then actor=defense_owner
    when phase in ('awaiting_damage','awaiting_optional_reveal','awaiting_sonar_search') then
      actor=match_state.current_player and actor=attack_owner
    when phase='awaiting_payment' then actor=match_state.current_player
    else false
  end;
  return pg_catalog.jsonb_build_object(
    'phase',phase,
    'turn_no',match_state.turn_no,
    'your_turn',match_state.current_player=actor,
    'your_action_required',should_act,
    'training_finished',winner is not null,
    'you_won_training',case when winner is null then null else winner=actor end,
    'checkpoint_only',true,
    'training_only',true,
    'server_time',statement_timestamp()
  );
end;
$resume$;
revoke all on function public.chaotic_get_preview_3x3_resume_status(uuid)
from public,anon,authenticated;
grant execute on function public.chaotic_get_preview_3x3_resume_status(uuid)
to authenticated;
