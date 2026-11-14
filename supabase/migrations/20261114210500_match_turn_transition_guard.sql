-- Enforce server turn progression even if a future RPC accidentally skips or rewinds.
-- Existing pass_turn advances by one and alternates participants.
create or replace function public.chaotic_guard_turn_transition()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.turn_no is distinct from old.turn_no then
    if old.status <> 'active' then
      raise exception 'Cannot advance a non-active match' using errcode='23514';
    end if;
    if new.turn_no <> old.turn_no + 1 then
      raise exception 'Match turn must advance exactly once' using errcode='23514';
    end if;
    if new.last_player is distinct from old.current_player then
      raise exception 'Last player must be the previous active player' using errcode='23514';
    end if;
    if new.current_player is distinct from
      (case when old.current_player = old.host_id then old.guest_id else old.host_id end) then
      raise exception 'Match turn must alternate participants' using errcode='23514';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists chaotic_match_turn_transition_guard on public.chaotic_match_turns;
create trigger chaotic_match_turn_transition_guard
before update on public.chaotic_match_turns
for each row execute function public.chaotic_guard_turn_transition();