-- Chaotic GO v0.1.45: inspect dynamic Guru/Naty candidates without effects.
begin;
do $verify$
declare fn text; policy_text text;
begin
 if not exists(select 1 from public.chaotic_preview_card_reference
  where kind='creature' and card_id='8' and card_name='Guru'
   and creature_elements ? 'ar')
 or not exists(select 1 from public.chaotic_preview_card_reference
  where kind='creature' and card_id='12' and card_name='Naty')
 then raise exception 'Canonical Guru and Naty references missing';end if;
 if not (select relrowsecurity from pg_class
  where oid='public.chaotic_preview_3x3_dynamic_element_checks'::regclass)
 or has_table_privilege('anon','public.chaotic_preview_3x3_dynamic_element_checks','select')
 or has_table_privilege('authenticated','public.chaotic_preview_3x3_dynamic_element_checks','insert')
 or has_table_privilege('authenticated','public.chaotic_preview_3x3_dynamic_element_checks','update')
 or has_table_privilege('authenticated','public.chaotic_preview_3x3_dynamic_element_checks','delete')
 or not has_table_privilege('authenticated','public.chaotic_preview_3x3_dynamic_element_checks','select')
 then raise exception 'Dynamic candidates not protected against forgery';end if;
 if has_function_privilege('anon','public.chaotic_inspect_preview_3x3_dynamic_elements(uuid,integer)','execute')
 or not has_function_privilege('authenticated','public.chaotic_inspect_preview_3x3_dynamic_elements(uuid,integer)','execute')
 then raise exception 'Dynamic inspector invocation grants incorrect';end if;
 select qual into policy_text from pg_policies where schemaname='public'
 and tablename='chaotic_preview_3x3_dynamic_element_checks'
 and policyname='chaotic_preview_3x3_dynamic_member_read';
 if policy_text is null or position('auth.uid()' in policy_text)=0
   or position('chaotic_match_turns' in policy_text)=0
 then raise exception 'Only participants may read candidate sources';end if;
 select lower(regexp_replace(pg_get_functiondef(
 'public.chaotic_inspect_preview_3x3_dynamic_elements(uuid,integer)'::regprocedure),
 '[[:space:]]+','','g')) into fn;
 if position('actoruuid:=auth.uid()' in fn)=0
  or position('w.defender_idisdistinctfromactor' in fn)=0
  or position('w.status<>''awaiting_defender''' in fn)=0
  or position('chaotic_preview_3x3_elemental_inspections' in fn)=0
  or position('chaotic_preview_3x3_creature_element_checks' in fn)=0
  or position('chaotic_preview_3x3_allies' in fn)=0
  or position('chaotic_preview_3x3_hp_wallets' in fn)=0
  or position('x.position<>w.attacker_slot' in fn)=0
  or position('x.position<>w.defender_slot' in fn)=0
  or position('x.creature_name=''guru''' in fn)=0
  or position('own_a.creature_name=''naty''' in fn)=0
  or position('own_d.creature_name=''naty''' in fn)=0
  or position('forupdate' in fn)=0
 then raise exception 'Dynamic element origin, ownership or life-state check missing';end if;
 if exists(select 1 from public.chaotic_preview_3x3_dynamic_element_checks
  where dynamic_elements_resolved or air_bonus_applied or effect_activated
   or defensive_immunity_applied or final_damage_calculated
   or training_hp_changed or official_hp_changed or official_match_modified)
 then raise exception 'Candidate inspection applied damage or effects';end if;
 if not exists(select 1 from pg_publication_tables
 where pubname='supabase_realtime' and schemaname='public'
 and tablename='chaotic_preview_3x3_dynamic_element_checks')
 then raise exception '3x3 candidate history not syncable';end if;
end $verify$;
rollback;
select 'PASS v0.1.45: Guru/Naty verified, defender-only, no applied elements or HP' as result;