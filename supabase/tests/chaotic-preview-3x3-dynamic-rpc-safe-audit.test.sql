-- Chaotic GO v0.1.60: the canonical dynamic inspector previously
-- leaked a face-down opposing Guru count in its RAW RPC response.
-- It must no longer be executable by clients; only the filtered wrapper is.
begin;
do $audit$
declare f text; safe text;
begin
 if has_function_privilege('anon',
  'public.chaotic_inspect_preview_3x3_dynamic_elements(uuid,integer)','execute')
 or has_function_privilege('authenticated',
  'public.chaotic_inspect_preview_3x3_dynamic_elements(uuid,integer)','execute')
 or has_function_privilege('anon',
  'public.chaotic_inspect_preview_3x3_dynamic_elements_safe(uuid,integer)','execute')
 or not has_function_privilege('authenticated',
  'public.chaotic_inspect_preview_3x3_dynamic_elements_safe(uuid,integer)','execute')
 then raise exception 'Raw dynamic inspector exposed, or safe wrapper grant wrong';end if;
 select lower(regexp_replace(pg_get_functiondef(
 'public.chaotic_inspect_preview_3x3_dynamic_elements_safe(uuid,integer)'::regprocedure),
 '[[:space:]]+','','g')) into f;
 foreach safe in array array[
 'actoruuid:=auth.uid()',
 'p_expected_turnnotbetween1and120',
 'performpublic.chaotic_inspect_preview_3x3_dynamic_elements(',
 'safe_state:=public.chaotic_get_preview_3x3_safe_inspections(p_lobby_id)',
 'jsonb_array_elements(safe_state->''dynamic_checks'')',
 'where(x.value->>''turn_no'')::integer=p_expected_turn',
 'iffilteredisnullthen',
 'returnfiltered'
 ] loop
  if position(safe in f)=0 then
   raise exception 'Safe 3x3 dynamic inspection invariant absent: %',safe;end if;
 end loop;
 if has_table_privilege('authenticated',
  'public.chaotic_preview_3x3_dynamic_element_checks','select')
 or has_table_privilege('anon',
  'public.chaotic_preview_3x3_dynamic_element_checks','select')
 then raise exception 'Raw dynamic inspection table still exposed';end if;
 if exists(select 1 from pg_publication_tables
  where pubname='supabase_realtime' and schemaname='public'
   and tablename='chaotic_preview_3x3_dynamic_element_checks')
 then raise exception 'Raw dynamic inspection still published to realtime';end if;
end $audit$;
rollback;
select 'PASS v0.1.60: direct Guru-leaking inspector revoked; safe authenticated wrapper and private table retained' as result;