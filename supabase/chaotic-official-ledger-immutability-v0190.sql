-- Chaotic GO: tamper-evident, append-only official reward accounting.
-- No reward creation or official victory verification is enabled by this migration.
-- The existing authenticated-only reads and source verification remain intact.
begin;

create or replace function public.chaotic_guard_official_reward_immutability()
returns trigger language plpgsql set search_path = ''
as $$
begin
  raise exception 'Official reward entries are immutable; use a separately audited compensating entry'
    using errcode = '23514';
end;
$$;

revoke all on function public.chaotic_guard_official_reward_immutability()
  from public, anon, authenticated;

create trigger chaotic_official_reward_immutable
  before update or delete on public.chaotic_official_reward_ledger
  for each row execute function public.chaotic_guard_official_reward_immutability();

create or replace function public.chaotic_guard_verified_official_result_immutability()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if old.result_state = 'verified' then
    raise exception 'Verified official match results cannot be edited or deleted'
      using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and old.result_state <> 'verified'
     and new.id is distinct from old.id then
    raise exception 'Official match identity cannot be changed'
      using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and old.result_state <> 'verified'
     and (new.host_id is distinct from old.host_id
       or new.guest_id is distinct from old.guest_id
       or new.mode is distinct from old.mode) then
    raise exception 'Official match participants and mode are immutable'
      using errcode = '23514';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.chaotic_guard_verified_official_result_immutability()
  from public, anon, authenticated;

create trigger chaotic_verified_official_result_immutable
  before update or delete on public.chaotic_official_match_results
  for each row execute function public.chaotic_guard_verified_official_result_immutability();

commit;
