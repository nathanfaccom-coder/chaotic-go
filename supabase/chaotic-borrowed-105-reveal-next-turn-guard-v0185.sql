-- v0.1.85: after paid borrowed 105 base damage, the optional effect must be
-- deliberately chosen or skipped before moving to the next training turn.
-- Does not block terminal outcomes (the training already ended).
create or replace function public.chaotic_guard_borrowed_105_optional_reveal_turn()
returns trigger language plpgsql security definer set search_path=''
as $guard$
begin
 if new.turn_no is distinct from old.turn_no
  and exists(select 1
   from public.chaotic_preview_3x3_borrowed_105_base_events paid
   where paid.lobby_id=old.lobby_id and paid.turn_no=old.turn_no
    and not exists(select 1 from public.chaotic_preview_3x3_borrowed_105_reveal_events e
     where e.lobby_id=paid.lobby_id and e.turn_no=paid.turn_no)
    and not exists(select 1 from public.chaotic_preview_3x3_training_outcomes o
     where o.lobby_id=paid.lobby_id))
 then raise exception 'Decida ou dispense a revelação opcional do Vento Forte emprestado antes de passar o turno';end if;
 return new;
end;
$guard$;
revoke all on function public.chaotic_guard_borrowed_105_optional_reveal_turn()
 from public,anon,authenticated;
create trigger chaotic_guard_borrowed_105_reveal_before_next_turn
 before update of turn_no on public.chaotic_match_turns
 for each row execute function public.chaotic_guard_borrowed_105_optional_reveal_turn();