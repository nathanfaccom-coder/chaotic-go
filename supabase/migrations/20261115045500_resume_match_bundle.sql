-- Atomic API surface for resuming a Drome match from the player's durable cursor.
-- Read-only; no official result, XP, or currency mutations.
create or replace function public.chaotic_resume_match(p_lobby_id uuid, p_limit integer default 100)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
  v_actor uuid := auth.uid();
  v_match public.chaotic_match_turns%rowtype;
  v_cursor integer := 0;
  v_events jsonb;
  v_next integer;
  v_declarations jsonb;
begin
  if v_actor is null then raise exception 'Faça login' using errcode='28000'; end if;
  if p_lobby_id is null or p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'Parâmetros inválidos' using errcode='22023';
  end if;
  select * into v_match from public.chaotic_match_turns where lobby_id=p_lobby_id;
  if not found or (v_actor is distinct from v_match.host_id and v_actor is distinct from v_match.guest_id) then
    raise exception 'Partida não encontrada' using errcode='42501';
  end if;
  select coalesce(c.last_seq,0) into v_cursor
    from public.chaotic_match_read_cursors c
    where c.lobby_id=p_lobby_id and c.user_id=v_actor;
  v_cursor := coalesce(v_cursor,0);
  select coalesce(jsonb_agg(jsonb_build_object(
      'seq',e.seq,'turn_no',e.turn_no,'event_type',e.event_type,
      'actor_id',e.actor_id,'created_at',e.created_at) order by e.seq),'[]'::jsonb),
      coalesce(max(e.seq),v_cursor)
    into v_events,v_next
    from (select seq,turn_no,event_type,actor_id,created_at
          from public.chaotic_match_events
          where lobby_id=p_lobby_id and seq>v_cursor
          order by seq limit p_limit) e;
  select coalesce(jsonb_agg(jsonb_build_object(
      'turn_no',d.turn_no,'actor_id',d.actor_id,'kind',d.kind,
      'deck_slot',d.deck_slot,'card_slot',d.card_slot,
      'card_id',d.card_id,'created_at',d.created_at)
      order by d.turn_no),'[]'::jsonb)
    into v_declarations from public.chaotic_combat_declarations d
    where d.lobby_id=p_lobby_id;
  return jsonb_build_object(
    'lobby_id',p_lobby_id,'status',v_match.status,'turn_no',v_match.turn_no,
    'current_player',v_match.current_player,'host_id',v_match.host_id,
    'guest_id',v_match.guest_id,'saved_cursor',v_cursor,
    'events',v_events,'next_after_seq',v_next,
    'has_more',exists(select 1 from public.chaotic_match_events
      where lobby_id=p_lobby_id and seq>v_next),
    'declarations',v_declarations);
end;
$$;
revoke all on function public.chaotic_resume_match(uuid,integer) from public,anon,authenticated;
grant execute on function public.chaotic_resume_match(uuid,integer) to authenticated;
