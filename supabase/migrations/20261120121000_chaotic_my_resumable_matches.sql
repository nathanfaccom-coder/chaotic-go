-- Player-scoped, read-only resume list. Does not modify games or award rewards.
create or replace function public.chaotic_my_resumable_matches(p_limit integer default 20)
returns table (
  lobby_id uuid,
  lobby_code text,
  mode text,
  lobby_status text,
  role text,
  opponent_present boolean,
  turn_status text,
  turn_no integer,
  my_turn boolean,
  last_activity timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select l.id, l.code, l.mode, l.status,
         case when l.host_id = (select auth.uid()) then 'host' else 'guest' end,
         l.guest_id is not null,
         t.status, t.turn_no,
         coalesce(t.status = 'active' and t.current_player = (select auth.uid()), false),
         greatest(l.updated_at, coalesce(t.updated_at, l.updated_at))
    from public.chaotic_lobbies l
    left join public.chaotic_match_turns t on t.lobby_id = l.id
   where (select auth.uid()) is not null
     and (l.host_id = (select auth.uid()) or l.guest_id = (select auth.uid()))
     and l.status in ('waiting', 'ready')
     and l.expires_at > now()
     and (t.lobby_id is null or t.status = 'active')
   order by greatest(l.updated_at, coalesce(t.updated_at, l.updated_at)) desc, l.id
   limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;
revoke all on function public.chaotic_my_resumable_matches(integer) from public, anon;
grant execute on function public.chaotic_my_resumable_matches(integer) to authenticated;
comment on function public.chaotic_my_resumable_matches(integer) is
'Authenticated player-scoped resume list for waiting/active matches; no economy or official result writes.';