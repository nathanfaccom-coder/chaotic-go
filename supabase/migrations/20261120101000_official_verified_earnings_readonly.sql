-- Read-only official earnings. Never awards currency or XP.
-- Only verified server-authenticated results may contribute.
create or replace function public.chaotic_my_verified_earnings()
returns table(total_xp bigint, total_coins bigint, rewarded_matches bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    coalesce(sum(r.xp_awarded), 0)::bigint,
    coalesce(sum(r.coins_awarded), 0)::bigint,
    count(*)::bigint
  from public.chaotic_official_reward_ledger r
  join public.chaotic_official_match_results m
    on m.id = r.source_match_id
  where r.player_id = (select auth.uid())
    and m.result_state = 'verified'
    and m.verification_source = 'official_engine_v1'
    and m.verified_at is not null
    and r.reward_scope = 'official_verified_only';
$$;

revoke all on function public.chaotic_my_verified_earnings() from public;
revoke all on function public.chaotic_my_verified_earnings() from anon;
grant execute on function public.chaotic_my_verified_earnings() to authenticated;
