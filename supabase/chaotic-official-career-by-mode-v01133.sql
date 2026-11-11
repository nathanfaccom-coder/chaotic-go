-- Chaotic GO v0.1.133: official career by mode (read-only, RLS-scoped).
-- Already applied through migration chaotic_official_career_by_mode_readonly_v01133.
-- No official match settlement, payouts, or client writes are enabled.
create or replace function public.chaotic_my_official_career_by_mode()
returns table(mode text, victories bigint, defeats bigint, pending bigint)
language sql stable security invoker set search_path=''
as $career$
  with modes(mode) as (values ('1x1'::text),('3x3'::text),('6x6'::text))
  select modes.mode,
    count(r.id) filter(where r.result_state='verified'
      and r.verification_source='official_engine_v1'
      and r.verified_at is not null
      and r.winner_id=(select auth.uid()))::bigint,
    count(r.id) filter(where r.result_state='verified'
      and r.verification_source='official_engine_v1'
      and r.verified_at is not null
      and r.winner_id is distinct from (select auth.uid()))::bigint,
    count(r.id) filter(where r.result_state='pending_engine_verification')::bigint
  from modes left join public.chaotic_official_match_results r
    on r.mode=modes.mode and (select auth.uid()) is not null
    and ((select auth.uid())=r.host_id or (select auth.uid())=r.guest_id)
  group by modes.mode
  order by modes.mode;
$career$;
revoke all on function public.chaotic_my_official_career_by_mode() from public,anon,authenticated;
grant execute on function public.chaotic_my_official_career_by_mode() to authenticated;
