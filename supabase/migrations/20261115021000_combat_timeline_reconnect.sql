-- Authenticated, reconnect-safe combat timeline for the existing Drome.
-- Read-only: never awards XP, coins or modifies official results.
create or replace function public.chaotic_get_combat_timeline(p_lobby_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_match public.chaotic_match_turns%rowtype;
  v_events jsonb;
begin
  if v_actor is null then
    raise exception 'Faça login' using errcode='28000';
  end if;
  select * into v_match from public.chaotic_match_turns
    where lobby_id=p_lobby_id;
  if not found or v_actor is distinct from v_match.host_id
    and v_actor is distinct from v_match.guest_id then
    raise exception 'Partida não encontrada' using errcode='42501';
  end if;
  select coalesce(jsonb_agg(
    jsonb_build_object('turn_no',d.turn_no,'actor_id',d.actor_id,
      'kind',d.kind,'deck_slot',d.deck_slot,'card_slot',d.card_slot,
      'card_id',d.card_id,'created_at',d.created_at)
    order by d.turn_no), '[]'::jsonb)
  into v_events
  from public.chaotic_combat_declarations d
  where d.lobby_id=p_lobby_id;
  return jsonb_build_object(
    'lobby_id',v_match.lobby_id,'status',v_match.status,
    'turn_no',v_match.turn_no,'current_player',v_match.current_player,
    'host_id',v_match.host_id,'guest_id',v_match.guest_id,
    'declarations',v_events);
end;
$$;
revoke all on function public.chaotic_get_combat_timeline(uuid) from public, anon, authenticated;
grant execute on function public.chaotic_get_combat_timeline(uuid) to authenticated;