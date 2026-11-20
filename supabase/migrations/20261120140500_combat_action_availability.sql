-- Read-only availability for the authenticated player's next combat declaration.
-- Preview/test combat only: does not resolve official matches or award currency.
create or replace function public.chaotic_my_combat_action_availability(p_lobby_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_match public.chaotic_match_turns%rowtype;
  v_lobby public.chaotic_lobbies%rowtype;
  v_has_creature boolean;
  v_has_turn_action boolean;
  v_slots jsonb;
begin
  if v_actor is null then
    raise exception 'Faça login' using errcode = '28000';
  end if;

  select * into v_match from public.chaotic_match_turns
  where lobby_id = p_lobby_id
    and (host_id = v_actor or guest_id = v_actor);
  if not found then
    raise exception 'Partida não encontrada ou acesso negado' using errcode = '42501';
  end if;

  select * into v_lobby from public.chaotic_lobbies
  where id = p_lobby_id
    and (host_id = v_actor or guest_id = v_actor);
  if not found then
    raise exception 'Sala não encontrada ou acesso negado' using errcode = '42501';
  end if;

  select exists (
    select 1 from public.chaotic_combat_declarations
    where lobby_id = p_lobby_id and actor_id = v_actor and kind = 'creature'
  ) into v_has_creature;

  select exists (
    select 1 from public.chaotic_combat_declarations
    where lobby_id = p_lobby_id and turn_no = v_match.turn_no
  ) into v_has_turn_action;

  select coalesce(jsonb_agg(s.slot order by s.slot), '[]'::jsonb)
  into v_slots
  from generate_series(1,3) as s(slot)
  where exists (
    select 1 from public.chaotic_game_nodes g
    where g.user_id = v_actor
      and g.node_path in (
        'decks/' || v_lobby.mode || '_slot_' || s.slot::text,
        'decks/' || v_lobby.mode || '_' || s.slot::text
      )
  );

  return jsonb_build_object(
    'lobby_id', p_lobby_id,
    'mode', v_lobby.mode,
    'turn_no', v_match.turn_no,
    'match_status', v_match.status,
    'your_turn', v_match.current_player = v_actor,
    'available_deck_slots', v_slots,
    'can_declare_creature', (
      v_match.status = 'active' and v_match.current_player = v_actor
      and v_lobby.status = 'ready' and v_lobby.expires_at > now()
      and v_match.turn_no between 1 and 120
      and not v_has_turn_action and not v_has_creature
    ),
    'can_declare_attack', (
      v_match.status = 'active' and v_match.current_player = v_actor
      and v_lobby.status = 'ready' and v_lobby.expires_at > now()
      and v_match.turn_no between 1 and 120
      and not v_has_turn_action and v_has_creature
    )
  );
end;
$$;

revoke all on function public.chaotic_my_combat_action_availability(uuid) from public, anon;
grant execute on function public.chaotic_my_combat_action_availability(uuid) to authenticated;
