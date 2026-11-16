-- Preserve participant identity in existing matches without changing combat logic.
create or replace function public.chaotic_guard_match_turn_participants()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.host_id is distinct from old.host_id
     or new.guest_id is distinct from old.guest_id
     or new.lobby_id is distinct from old.lobby_id then
    raise exception 'Match participants and lobby are immutable' using errcode = '23514';
  end if;
  if new.current_player is not null
     and new.current_player is distinct from new.host_id
     and new.current_player is distinct from new.guest_id then
    raise exception 'Current player must be a match participant' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists chaotic_match_turn_participants_guard on public.chaotic_match_turns;
create trigger chaotic_match_turn_participants_guard
before update on public.chaotic_match_turns
for each row execute function public.chaotic_guard_match_turn_participants();
revoke all on function public.chaotic_guard_match_turn_participants() from public, anon, authenticated;