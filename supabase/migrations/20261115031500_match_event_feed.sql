-- Incremental event feed for reconnecting authenticated combat participants.
-- Only public event metadata; no private hands, decks, rewards or results.
create or replace function public.chaotic_get_match_event_feed(
  p_lobby_id uuid, p_after_seq integer default 0, p_limit integer default 100
) returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_match public.chaotic_match_turns%rowtype;
  v_events jsonb;
  v_last_seq integer;
begin
  if v_actor is null then
    raise exception 'Faça login' using errcode='28000';
  end if;
  if p_lobby_id is null or p_after_seq is null or p_after_seq < 0
    or p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'Parâmetros inválidos' using errcode='22023';
  end if;
  select * into v_match from public.chaotic_match_turns where lobby_id = p_lobby_id;
  if not found or (v_actor is distinct from v_match.host_id
    and v_actor is distinct from v_match.guest_id) then
    raise exception 'Partida não encontrada' using errcode='42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'seq',e.seq,'turn_no',e.turn_no,'event_type',e.event_type,
    'actor_id',e.actor_id,'created_at',e.created_at) order by e.seq),'[]'::jsonb),
    coalesce(max(e.seq),p_after_seq)
    into v_events,v_last_seq
  from (select seq,turn_no,event_type,actor_id,created_at
        from public.chaotic_match_events
        where lobby_id=p_lobby_id and seq>p_after_seq
        order by seq limit p_limit) e;
  return jsonb_build_object(
    'lobby_id',p_lobby_id,'status',v_match.status,
    'turn_no',v_match.turn_no,'current_player',v_match.current_player,
    'events',v_events,'next_after_seq',v_last_seq,
    'has_more',exists(select 1 from public.chaotic_match_events
      where lobby_id=p_lobby_id and seq>v_last_seq));
end;
$$;
revoke all on function public.chaotic_get_match_event_feed(uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.chaotic_get_match_event_feed(uuid,integer,integer) to authenticated;
