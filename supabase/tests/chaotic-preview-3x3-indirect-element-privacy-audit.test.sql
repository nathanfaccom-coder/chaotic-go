-- Chaotic GO 0.1.58: verify raw elemental inspections are client-private.
begin;
do $audit$
declare body text; table_name text; must_have text;
begin
 if has_function_privilege('anon',
   'public.chaotic_get_preview_3x3_safe_inspections(uuid)','execute')
 or not has_function_privilege('authenticated',
   'public.chaotic_get_preview_3x3_safe_inspections(uuid)','execute')
 then raise exception 'Inspection RPC grants unsafe';end if;
 foreach table_name in array array[
  'chaotic_preview_3x3_creature_element_checks',
  'chaotic_preview_3x3_dynamic_element_checks'
 ] loop
  if has_table_privilege('authenticated','public.'||table_name,'select')
    or has_table_privilege('anon','public.'||table_name,'select')
   then raise exception 'Raw historical card fingerprint accessible: %',table_name;end if;
  if exists(select 1 from pg_publication_tables
   where pubname='supabase_realtime' and schemaname='public'
     and tablename=table_name)
   then raise exception 'Raw historical card fingerprint still published: %',table_name;end if;
  if not (select relrowsecurity from pg_class where oid=('public.'||table_name)::regclass)
   then raise exception 'RLS disabled on %',table_name;end if;
 end loop;
 select lower(regexp_replace(pg_get_functiondef(
  'public.chaotic_get_preview_3x3_safe_inspections(uuid)'::regprocedure),
  '[[:space:]]+','','g')) into body;
 foreach must_have in array array[
  'actoruuid:=auth.uid()',
  'actornotin(actor_host,actor_guest)',
  'coalesce(fa.face_up,false)',
  'coalesce(fd.face_up,false)',
  '''attacker_creature_name'',case',
  '''defender_creature_name'',case',
  '''attacker_base_elements'',case',
  '''defender_base_elements'',case',
  '''rex_air_immunity_candidate'',case',
  '''attacker_guru_support_count'',case',
  '''defender_guru_support_count'',case',
  '''attacker_naty_variable_candidate'',case',
  '''defender_naty_variable_candidate'',case',
  'notcoalesce(f.face_up,false)'
 ] loop
  if position(must_have in body)=0 then
   raise exception 'Masked inspection invariant missing: %',must_have;end if;
 end loop;
 if position('h.hp_remaining>0' in body)>0
 then raise exception 'Knocked-out but still-facedown Guru support leaked from history';end if;
end $audit$;
rollback;
select 'PASS v0.1.58: hidden Guru/Naty/creature-element metadata restricted to safe authenticated room RPC; no Realtime' as result;