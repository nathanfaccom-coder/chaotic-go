-- Chaotic GO 0.1.42: immutable canonical Attack metadata and defender-only review.
begin;
do $test$
declare fn text; policy text;
begin
 if (select count(*) from public.chaotic_preview_3x3_element_catalog)<>15
 or (select count(distinct attack_id) from public.chaotic_preview_3x3_element_catalog)<>15
 then raise exception 'Original 15 Attack reference entries incomplete';end if;
 if not exists(select 1 from public.chaotic_preview_3x3_element_catalog
   where attack_id='101' and attack_name='Ácido Gástrico'
   and element_fire=5 and element_water=5 and element_earth=0 and element_air=0
   and element_data_shape='danoElemental' and special_resolution='none')
 or not exists(select 1 from public.chaotic_preview_3x3_element_catalog
   where attack_id='104' and attack_name='Fogo Primordial 2.0'
   and element_fire=5 and element_data_shape='flat_fire_fields'
   and special_resolution='six_sided_base_multiplier')
 or not exists(select 1 from public.chaotic_preview_3x3_element_catalog
   where attack_id='107' and element_earth=5)
 or not exists(select 1 from public.chaotic_preview_3x3_element_catalog
   where attack_id='110' and element_earth=10 and element_air=10)
 then raise exception 'Key elemental or special attack numbers no longer match cartas.js';end if;
 if not (select relrowsecurity from pg_class
   where oid='public.chaotic_preview_3x3_element_catalog'::regclass)
  or has_table_privilege('authenticated','public.chaotic_preview_3x3_element_catalog','select')
  or has_table_privilege('authenticated','public.chaotic_preview_3x3_element_catalog','insert')
  or has_table_privilege('anon','public.chaotic_preview_3x3_element_catalog','select')
 then raise exception 'Original attack reference is client-forgeable/exposed';end if;
 if not (select relrowsecurity from pg_class
   where oid='public.chaotic_preview_3x3_elemental_inspections'::regclass)
  or has_table_privilege('anon','public.chaotic_preview_3x3_elemental_inspections','select')
  or has_table_privilege('authenticated','public.chaotic_preview_3x3_elemental_inspections','insert')
  or has_table_privilege('authenticated','public.chaotic_preview_3x3_elemental_inspections','update')
  or has_table_privilege('authenticated','public.chaotic_preview_3x3_elemental_inspections','delete')
 then raise exception 'Defender review could be forged by browser';end if;
 if not has_table_privilege('authenticated','public.chaotic_preview_3x3_elemental_inspections','select')
 or has_function_privilege('anon','public.chaotic_inspect_preview_3x3_elemental_defense(uuid,integer)','execute')
 or not has_function_privilege('authenticated','public.chaotic_inspect_preview_3x3_elemental_defense(uuid,integer)','execute')
 then raise exception 'Defender review auth grants invalid';end if;
 select qual into policy from pg_policies where schemaname='public'
 and tablename='chaotic_preview_3x3_elemental_inspections'
 and policyname='chaotic_preview_3x3_element_inspection_members_read';
 if policy is null or position('auth.uid()' in policy)=0
  or position('chaotic_match_turns' in policy)=0
 then raise exception 'Review must be visible to match participants only';end if;
 select lower(regexp_replace(pg_get_functiondef(
  'public.chaotic_inspect_preview_3x3_elemental_defense(uuid,integer)'::regprocedure),
  '[[:space:]]+','','g')) into fn;
 if position('auth.uid()' in fn)=0
  or position('m.turn_no<>p_expected_turn' in fn)=0
  or position('l.mode<>''3x3''' in fn)=0
  or position('w.defender_idisdistinctfromactor' in fn)=0
  or position('w.attacker_idisdistinctfromm.current_player' in fn)=0
  or position('w.status<>''awaiting_defender''' in fn)=0
  or position('chaotic_preview_3x3_attack_spends' in fn)=0
  or position('chaotic_preview_3x3_attack_projections' in fn)=0
  or position('chaotic_preview_3x3_element_catalog' in fn)=0
  or position('source_card.attack_nameisdistinctfromattack.attack_name' in fn)=0
  or position('defense_hp.hp_remainingisdistinctfromcontact.defender_hp_at_contact' in fn)=0
  or position('attack_hp.hp_remainingisdistinctfromcontact.attacker_hp_at_contact' in fn)=0
  or position('forupdate' in fn)=0
 then raise exception 'Element inspector lacks original Attack, ownership or HP checks';end if;
 if exists(select 1 from public.chaotic_preview_3x3_elemental_inspections
  where elemental_eligibility_verified or special_effect_executed
  or defender_equipment_verified or final_damage_calculated
  or training_hp_changed or official_hp_changed or official_match_modified)
 then raise exception 'A metadata inspection falsely executed an effect or changed HP';end if;
end $test$;
rollback;
select 'PASS v0.1.42: 15 original attacks, defender-only safe elemental review, no dice/effects/HP' result;