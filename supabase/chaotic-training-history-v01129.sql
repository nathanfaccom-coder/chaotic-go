-- Chaotic GO v0.1.129. Already installed as migration
-- chaotic_training_result_history_v01129 on the connected Supabase project.
-- Stores results only after the original verified 3x3 training outcome.
create table if not exists public.chaotic_training_match_history (
  lobby_id uuid primary key,
  winner_id uuid not null references auth.users(id) on delete cascade,
  defeated_id uuid not null references auth.users(id) on delete cascade,
  decided_turn integer not null check (decided_turn between 1 and 120),
  recorded_at timestamptz not null,
  outcome_scope text not null default 'training_only_no_official_victory'
    check (outcome_scope='training_only_no_official_victory'),
  constraint chaotic_training_history_distinct_players check (winner_id<>defeated_id)
);
create index if not exists chaotic_training_history_winner_recent
 on public.chaotic_training_match_history(winner_id,recorded_at desc);
create index if not exists chaotic_training_history_defeated_recent
 on public.chaotic_training_match_history(defeated_id,recorded_at desc);
alter table public.chaotic_training_match_history enable row level security;
revoke all on table public.chaotic_training_match_history from public,anon,authenticated;
grant select on public.chaotic_training_match_history to authenticated;
drop policy if exists chaotic_training_history_participants_read
 on public.chaotic_training_match_history;
create policy chaotic_training_history_participants_read
 on public.chaotic_training_match_history for select to authenticated
 using ((select auth.uid())=winner_id or (select auth.uid())=defeated_id);

create or replace function public.chaotic_archive_verified_training_result()
returns trigger language plpgsql security definer set search_path=''
as $archive$
begin
 if new.outcome_scope<>'training_only_no_official_victory'
  or new.official_match_ended or new.official_match_modified
  or new.experience_awarded or new.currency_awarded
  or new.defeated_team_size<>3 or new.winner_id=new.defeated_id
 then raise exception 'Only server-verified training outcomes can be archived';end if;
 insert into public.chaotic_training_match_history(
  lobby_id,winner_id,defeated_id,decided_turn,recorded_at,outcome_scope)
 values(new.lobby_id,new.winner_id,new.defeated_id,new.decided_turn,
  new.created_at,new.outcome_scope)
 on conflict(lobby_id) do nothing;
 return new;
end;
$archive$;
revoke all on function public.chaotic_archive_verified_training_result()
 from public,anon,authenticated;
drop trigger if exists chaotic_archive_verified_training_result_after_insert
 on public.chaotic_preview_3x3_training_outcomes;
create trigger chaotic_archive_verified_training_result_after_insert
 after insert on public.chaotic_preview_3x3_training_outcomes
 for each row execute function public.chaotic_archive_verified_training_result();
insert into public.chaotic_training_match_history(
 lobby_id,winner_id,defeated_id,decided_turn,recorded_at,outcome_scope)
select lobby_id,winner_id,defeated_id,decided_turn,created_at,outcome_scope
from public.chaotic_preview_3x3_training_outcomes
where outcome_scope='training_only_no_official_victory'
 and not official_match_ended and not official_match_modified
 and not experience_awarded and not currency_awarded
 and defeated_team_size=3 and winner_id<>defeated_id
on conflict(lobby_id) do nothing;