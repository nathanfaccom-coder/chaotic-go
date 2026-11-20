-- Read acknowledgement is monotonic, bounded by persisted events, and participant-only.
-- No combat outcome or reward state is modified.
create or replace function public.chaotic_acknowledge_match_events(
  p_lobby_id uuid,
  p_last_seq integer
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_max_seq integer;
  v_cursor integer;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_lobby_id is null or p_last_seq is null or p_last_seq < 0 then
    raise exception 'Invalid cursor' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.chaotic_lobbies l
    where l.id = p_lobby_id and (l.host_id = v_user or l.guest_id = v_user)
  ) then
    raise exception 'Match not accessible' using errcode = '42501';
  end if;

  select coalesce(max(e.seq), 0) into v_max_seq
  from public.chaotic_match_events e where e.lobby_id = p_lobby_id;

  insert into public.chaotic_match_read_cursors
    (lobby_id, user_id, last_seq, updated_at)
  values (p_lobby_id, v_user, least(p_last_seq, v_max_seq), now())
  on conflict (lobby_id, user_id) do update
    set last_seq = greatest(public.chaotic_match_read_cursors.last_seq, excluded.last_seq),
        updated_at = case
          when excluded.last_seq > public.chaotic_match_read_cursors.last_seq
          then now()
          else public.chaotic_match_read_cursors.updated_at
        end
  returning last_seq into v_cursor;
  return v_cursor;
end;
$$;
revoke all on function public.chaotic_acknowledge_match_events(uuid, integer) from public, anon;
grant execute on function public.chaotic_acknowledge_match_events(uuid, integer) to authenticated;
