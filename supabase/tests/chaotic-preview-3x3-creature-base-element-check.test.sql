-- Chaotic GO v0.1.43 — transactional schema/auth and no-effect regression
begin;
do $test$
declare fn text; pol text;
begin
 if (select count(*) from public.chaotic_preview_card_reference where kind='creature')<>16
 then raise exception 'Original 16 creature definitions missing';end if;
 if (select count(*) from public.chaotic_preview_3x3_element_catalog)<>15
 then raise exception 'Original 15 attack entries missing';end if;
 if not ('["fogo","terra"]'::jsonb ? 'fogo')
   or ('["fogo","terra"]'::jsonb ? 'agua')
   or ('[]'::jsonb ? 'ar')
 then raise exception 'Canonical JSONB elemental membership semantics broken';end if;
 if not (select relrowsecurity from pg_class where oid=
   'public.chaotic_preview_3x3_creature_element_checks'::regclass)
   or has_table_privilege('anon','public.chaotic_preview_3x3_creature_element_checks','select')
   or has_table_privilege('authenticated','public.chaotic_preview_3x3_creature_element_checks','insert')
   or has_table_privilege('authenticated','public.chaotic_preview_3x3_creature_element_checks','update')
   or has_table_privilege('authenticated','public.chaotic_preview_3x3_creature_element_checks','delete')
   or not has_table_privilege('authenticated','public.chaotic_preview_3x3_creature_element_checks','select')
 then raise exception 'Client can forge creature checks or read private data';end if;
 if has_function_privilege('anon','public.chaotic_inspect_preview_3x3_creature_elements(uuid,integer)','execute')
  or not has_function_privilege('authenticated','public.chaotic_inspect_preview_3x3_creature_elements(uuid,integer)','execute')
 then raise exception 'RPC grants invalid';end if;
 select qual into pol from pg_policies where schemaname='public'
 and tablename='chaotic_preview_3x3_creature_element_checks'
 and policyname='chaotic_preview_3x3_creature_check_member_read';
 if pol is null or position('auth.uid()' in pol)=0
  or position('chaotic_match_turns' in pol)=0
 then raise exception 'RLS not restricted to participants';end if;
 select lower(regexp_replace(pg_get_functiondef(
 'public.chaotic_inspect_preview_3x3_creature_elements(uuid,integer)'::regprocedure),
 '[[:space:]]+','','g')) into fn;
 if position('actoruuid:=auth.uid()' in fn)=0
  or position('w.status<>''awaiting_defender''' in fn)=0
  or position('w.defender_idisdistinctfromactor' in fn)=0
  or position('chaotic_preview_3x3_elemental_inspections' in fn)=0
  or position('chaotic_preview_3x3_hp_wallets' in fn)=0
  or position('chaotic_preview_card_reference' in fn)=0
  or position('forupdate' in fn)=0
 then raise exception 'Server-side creature review lacks preconditions';end if;
 if exists(select 1 from public.chaotic_preview_3x3_creature_element_checks
  where effective_elements_verified or dynamic_effects_verified
   or defender_equipment_verified or final_damage_calculated
   or training_hp_changed or official_hp_changed or official_match_modified)
 then raise exception 'Preview falsely applied effects or HP changes';end if;
end $test$;
rollback;
select 'PASS v0.1.43: canonical 16 creatures, defender-only inspection, zero damage' as result;