-- Chaotic GO v0.1.60: the old security-definer dynamic inspection
-- RETURNS the FULL DB row to a defender. That row includes counts of hidden
-- opposing Guru and Naty flags, bypassing the safe historical reader.
-- A new authenticated endpoint runs the existing canonical inspection but
-- returns ONLY the same member-filtered projection as historical reads.
-- Internal original function is retained for mechanics and past SQL clients,
-- but its EXECUTE privilege is revoked from browser-facing roles.

create or replace function public.chaotic_inspect_preview_3x3_dynamic_elements_safe(
 p_lobby_id uuid, p_expected_turn integer
) returns jsonb
language plpgsql
security definer
set search_path=''
as $safe$
declare
 actor uuid:=auth.uid();
 safe_state jsonb;
 filtered jsonb;
begin
 if actor is null or p_lobby_id is null
   or p_expected_turn is null or p_expected_turn not between 1 and 120
 then raise exception 'Inspeção dinâmica autenticada inválida';end if;
 -- The canonical inspection performs its own checks:
 -- actor must be the pending defender, correct match turn and room,
 -- original attack + creature + HP snapshots, no replay, etc.
 perform public.chaotic_inspect_preview_3x3_dynamic_elements(
   p_lobby_id,p_expected_turn
 );
 -- The safe reader verifies room membership, masks still-hidden rival
 -- teammates (including former Guru) and whitelist-serializes fields.
 safe_state:=public.chaotic_get_preview_3x3_safe_inspections(p_lobby_id);
 select x.value into filtered
 from pg_catalog.jsonb_array_elements(safe_state->'dynamic_checks') x(value)
 where (x.value->>'turn_no')::integer=p_expected_turn
 limit 1;
 if filtered is null then
  raise exception 'Resultado dinâmico filtrado indisponível';end if;
 return filtered;
end;
$safe$;

revoke all on function public.chaotic_inspect_preview_3x3_dynamic_elements(uuid,integer)
 from public,anon,authenticated;
revoke all on function public.chaotic_inspect_preview_3x3_dynamic_elements_safe(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_inspect_preview_3x3_dynamic_elements_safe(uuid,integer)
 to authenticated;
