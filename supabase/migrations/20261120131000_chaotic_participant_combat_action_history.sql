-- Read-only, participant-scoped combat action history for reconnecting clients.
-- Does not resolve combat, modify legacy data, or award rewards.
create or replace function public.chaotic_my_combat_action_history(
  p_lobby_id uuid,
  p_limit integer default 50
)
returns table (
  turn_no integer,
  actor_id uuid,
  action_kind text,
  deck_slot smallint,
  card_slot smallint,
  card_id text,
  declared_at timestamptz
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_lobby_id is null then
    raise exception 'Lobby is required' using errcode = '22023';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'Limit must be between 1 and 100' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.chaotic_lobbies l
    where l.id = p_lobby_id
      and (l.host_id = auth.uid() or l.guest_id = auth.uid())
  ) then
    raise exception 'Match unavailable' using errcode = '42501';
  end if;
  return query
  select d.turn_no, d.actor_id, d.kind, d.deck_slot, d.card_slot,
         d.card_id, d.created_at
    from public.chaotic_combat_declarations d
   where d.lobby_id = p_lobby_id
   order by d.turn_no desc, d.created_at desc, d.actor_id
   limit p_limit;
end;
$$;
revoke all on function public.chaotic_my_combat_action_history(uuid, integer) from public, anon;
grant execute on function public.chaotic_my_combat_action_history(uuid, integer) to authenticated;
comment on function public.chaotic_my_combat_action_history(uuid, integer)
is 'Participant-only read of combat declarations for reconnect/replay UI. Subject to underlying RLS; never settles official outcomes or rewards.';
