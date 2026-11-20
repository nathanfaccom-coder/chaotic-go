-- Chaotic GO: reject all non-pending official outcomes until a server-authenticated engine exists.
-- This migration deliberately does not grant any reward or result-settlement permission.
-- Fail closed even for new result_state values added in future schema revisions.
begin;
create or replace function public.chaotic_reject_unproven_official_verification()
returns trigger language plpgsql set search_path = ''
as $guard$
begin
  if new.result_state is distinct from 'pending_engine_verification'
     or new.winner_id is not null
     or new.verified_at is not null
     or new.verification_source is distinct from 'awaiting_official_engine'
  then
    raise exception 'Official result verification is disabled until server-authenticated combat evidence is implemented'
      using errcode = '23514';
  end if;
  return new;
end;
$guard$;
revoke all on function public.chaotic_reject_unproven_official_verification()
  from public, anon, authenticated;
commit;
