-- Chaotic GO v0.1.131 — provenance for official match results.
-- Already applied to the connected project through migration
-- chaotic_official_reward_provenance_v01131.
-- No client write and NO payout RPC are enabled by these changes.

create table if not exists public.chaotic_official_match_results (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  host_id uuid not null references auth.users(id) on delete cascade,
  guest_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('1x1','3x3','6x6')),
  winner_id uuid references auth.users(id) on delete cascade,
  result_state text not null default 'pending_engine_verification'
    check (result_state in ('pending_engine_verification','verified')),
  verification_source text not null default 'awaiting_official_engine',
  created_at timestamptz not null default pg_catalog.now(),
  verified_at timestamptz,
  constraint chaotic_official_match_different_players check(host_id<>guest_id),
  constraint chaotic_official_match_provenance check (
    (result_state='pending_engine_verification'
      and winner_id is null and verified_at is null
      and verification_source='awaiting_official_engine')
    or
    (result_state='verified'
      and winner_id is not null and winner_id in (host_id,guest_id)
      and verified_at is not null
      and verification_source='official_engine_v1')
  )
);
create index if not exists chaotic_official_match_host_recent
 on public.chaotic_official_match_results(host_id,created_at desc);
create index if not exists chaotic_official_match_guest_recent
 on public.chaotic_official_match_results(guest_id,created_at desc);
alter table public.chaotic_official_match_results enable row level security;
revoke all on table public.chaotic_official_match_results from public,anon,authenticated;
grant select on table public.chaotic_official_match_results to authenticated;
drop policy if exists chaotic_official_match_members_read
 on public.chaotic_official_match_results;
create policy chaotic_official_match_members_read
 on public.chaotic_official_match_results
 for select to authenticated
 using ((select auth.uid())=host_id or (select auth.uid())=guest_id);

-- The ledger was empty at installation. The FK makes an invented source ID
-- impossible even if a future privileged writer mistakenly tries it.
alter table public.chaotic_official_reward_ledger
 add constraint chaotic_official_reward_verified_match_fkey
 foreign key(source_match_id)
 references public.chaotic_official_match_results(id) on delete cascade;

create or replace function public.chaotic_guard_official_reward_source()
returns trigger language plpgsql security invoker set search_path=''
as $guard$
declare
 source public.chaotic_official_match_results;
begin
 if exists(select 1 from public.chaotic_match_turns
           where lobby_id=new.source_match_id)
   or exists(select 1 from public.chaotic_training_match_history
           where lobby_id=new.source_match_id)
 then raise exception 'Treino DROME não pode conceder recompensa oficial';
 end if;
 select * into source from public.chaotic_official_match_results
   where id=new.source_match_id for share;
 if source.id is null or source.result_state<>'verified'
   or source.verification_source<>'official_engine_v1'
   or source.verified_at is null
 then raise exception 'Recompensa exige resultado oficial verificado pelo servidor';
 end if;
 if new.player_id not in (source.host_id,source.guest_id)
   or (new.award_kind='official_victory'
       and new.player_id is distinct from source.winner_id)
   or (new.award_kind='official_participation'
       and new.player_id is not distinct from source.winner_id)
 then raise exception 'Destinatário ou tipo de recompensa não corresponde ao resultado';
 end if;
 return new;
end;
$guard$;
revoke all on function public.chaotic_guard_official_reward_source()
 from public,anon,authenticated;
-- Existing BEFORE INSERT trigger is kept and calls this updated function.

create or replace function public.chaotic_my_official_reward_totals()
returns table(total_xp bigint,total_coins bigint,settled_matches bigint)
language sql stable security invoker set search_path=''
as $totals$
 select coalesce(sum(xp_awarded),0)::bigint,
        coalesce(sum(coins_awarded),0)::bigint,
        count(*)::bigint
 from public.chaotic_official_reward_ledger
 where (select auth.uid()) is not null
   and player_id=(select auth.uid());
$totals$;
revoke all on function public.chaotic_my_official_reward_totals()
 from public,anon,authenticated;
grant execute on function public.chaotic_my_official_reward_totals()
 to authenticated;
-- Official wins and payouts remain DISABLED until an official combat engine
-- can verify end states, card ownership and turn/KO provenance end to end.
