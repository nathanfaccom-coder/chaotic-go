-- Reject turn history that attributes the previous move to a third-party account.
-- This does not change combat rules, existing cards, rewards or authentication.
alter table public.chaotic_match_turns
  add constraint chaotic_match_last_player_member
  check (last_player is null or last_player = host_id or last_player = guest_id);