-- Chaotic GO: fail-closed official verification until an authoritative engine exists.
-- Verified results must NEVER be accepted merely because a privileged caller
-- supplies the string 'official_engine_v1'. No rewards are enabled here.
begin;
create or replace function public.chaotic_reject_unproven_official_verification()
returns trigger language plpgsql set search_path = ''
as $guard$
begin
  if new.result_state = 'verified'
     or new.winner_id is not null
     or new.verified_at is not null
     or new.verification_source <> 'awaiting_official_engine'
  then
    raise exception 'Official result verification is disabled until server-authenticated combat evidence is implemented'
      using errcode = '23514';
  end if;
  return new;
end;
$guard$;
revoke all on function public.chaotic_reject_unproven_official_verification()
 from public, anon, authenticated;
create trigger chaotic_official_require_server_combat_evidence
 before insert or update on public.chaotic_official_match_results
 for each row execute function public.chaotic_reject_unproven_official_verification();
commit;
