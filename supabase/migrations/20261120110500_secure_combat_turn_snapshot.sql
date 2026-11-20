-- Read-only authoritative turn snapshot for authenticated lobby participants.
-- Does not settle matches or award XP/currency.
create or replace function public.chaotic_my_turn_snapshot(p_lobby_id uuid)
returns table (
  lobby_id uuid,
  mode text,
  lobby_status text,
  turn_status text,
  turn_no integer,
  current_player uuid,
  is_my_turn boolean,
  declaration_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null or p_lobby_id is null then
    raise exception 'Authentication and lobby ID required' using errcode = '28000';
  end if;

  -- A participant may inspect only their own room. No opponent account
  -- identifiers or card IDs are returned.
  if not exists (
    select 1 from public.chaotic_lobbies l
    where l.id = p_lobby_id
      and (l.host_id = v_actor or l.guest_id = v_actor)
  ) then
    raise exception 'Lobby not found or access denied' using errcode = '42501';
  end if;

  return query
  select l.id, l.mode, l.status, t.status, t.turn_no,
         t.current_player, (t.current_player = v_actor),
         (select count(*) from public.chaotic_combat_declarations d
          where d.lobby_id = l.id and d.turn_no = t.turn_no)
  from public.chaotic_lobbies l
  left join public.chaotic_match_turns t on t.lobby_id = l.id
  where l.id = p_lobby_id;
end;
$$;

revoke all on function public.chaotic_my_turn_snapshot(uuid) from public;
revoke all on function public.chaotic_my_turn_snapshot(uuid) from anon;
grant execute on function public.chaotic_my_turn_snapshot(uuid) to authenticated;
