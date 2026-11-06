-- v0.1.130 already applied to Supabase through migration
-- chaotic_official_reward_ledger_career_stats_v01130.
-- Official rewards remain disabled; this is a read-only ledger foundation.
create or replace function public.chaotic_my_training_stats()
returns table(total_matches bigint, victories bigint, defeats bigint)
language sql stable security invoker set search_path=''
as $stats$
 select count(*)::bigint,
  count(*) filter(where winner_id=(select auth.uid()))::bigint,
  count(*) filter(where defeated_id=(select auth.uid()))::bigint
 from public.chaotic_training_match_history
 where (select auth.uid()) is not null
  and ((select auth.uid())=winner_id or (select auth.uid())=defeated_id);
$stats$;
revoke all on function public.chaotic_my_training_stats() from public,anon,authenticated;
grant execute on function public.chaotic_my_training_stats() to authenticated;
create table if not exists public.chaotic_official_reward_ledger(
 id uuid primary key default pg_catalog.gen_random_uuid(),
 source_match_id uuid not null,
 player_id uuid not null references auth.users(id) on delete cascade,
 award_kind text not null check(award_kind in ('official_victory','official_participation')),
 xp_awarded integer not null default 0 check(xp_awarded between 0 and 10000),
 coins_awarded integer not null default 0 check(coins_awarded between 0 and 10000),
 reward_scope text not null default 'official_verified_only'
  check(reward_scope='official_verified_only'),
 awarded_at timestamptz not null default now(),
 constraint chaotic_official_reward_nonzero check(xp_awarded>0 or coins_awarded>0),
 constraint chaotic_official_reward_once_per_player_match unique(source_match_id,player_id)
);
create index if not exists chaotic_official_reward_player_recent
 on public.chaotic_official_reward_ledger(player_id,awarded_at desc);
alter table public.chaotic_official_reward_ledger enable row level security;
revoke all on table public.chaotic_official_reward_ledger from public,anon,authenticated;
grant select on table public.chaotic_official_reward_ledger to authenticated;
drop policy if exists chaotic_official_reward_self_read on public.chaotic_official_reward_ledger;
create policy chaotic_official_reward_self_read on public.chaotic_official_reward_ledger
 for select to authenticated using ((select auth.uid())=player_id);
create or replace function public.chaotic_guard_official_reward_source()
returns trigger language plpgsql security invoker set search_path=''
as $guard$
begin
 if exists(select 1 from public.chaotic_match_turns where lobby_id=new.source_match_id)
   or exists(select 1 from public.chaotic_training_match_history where lobby_id=new.source_match_id)
 then raise exception 'Treino DROME não pode conceder recompensa oficial';end if;
 return new;
end;
$guard$;
revoke all on function public.chaotic_guard_official_reward_source()
 from public,anon,authenticated;
drop trigger if exists chaotic_guard_official_reward_source_before_insert
 on public.chaotic_official_reward_ledger;
create trigger chaotic_guard_official_reward_source_before_insert
 before insert on public.chaotic_official_reward_ledger
 for each row execute function public.chaotic_guard_official_reward_source();
-- Intentionally no INSERT/UPDATE/DELETE for users, and no reward-awarding RPC.
