-- Chaotic GO: fail-closed official-result verification gate.
-- No authenticated or privileged caller may mark a result verified until a
-- separate audited server-side combat-verification migration replaces this gate.
-- Pending result creation remains possible for trusted server workflows.
begin;

create or replace function public.chaotic_block_unverified_official_settlement()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.result_state = 'verified' then
    raise exception 'Official result verification is disabled until the authoritative combat engine is deployed'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.chaotic_block_unverified_official_settlement()
  from public, anon, authenticated;

drop trigger if exists chaotic_block_unverified_official_settlement
  on public.chaotic_official_match_results;

create trigger chaotic_block_unverified_official_settlement
  before insert or update on public.chaotic_official_match_results
  for each row execute function public.chaotic_block_unverified_official_settlement();

-- No payout RPC, no new grants and no changes to existing rows.
commit;
