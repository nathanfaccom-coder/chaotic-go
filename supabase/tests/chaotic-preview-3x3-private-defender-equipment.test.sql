-- Chaotic GO v0.1.44: private gear checks are schema-only, no reveal or HP.
begin;
do $verify$
declare fn text; owner_policy text;
begin
 if (select count(*) from public.chaotic_preview_3x3_equipment_catalog)<>7
 then raise exception '7 equipment references not installed'; end if;
 if not exists(select 1 from public.chaotic_preview_3x3_equipment_catalog
  where equipment_id='201' and equipment_name='Anel Precioso'
   and rule_code='ignore_elemental_damage_with_energy_cost')
 or not exists(select 1 from public.chaotic_preview_3x3_equipment_catalog
  where equipment_id='202' and equipment_name='Amuleto do Vácuo'
   and rule_code='immune_to_attacks_involving_air')
 or not exists(select 1 from public.chaotic_preview_3x3_equipment_catalog
  where equipment_id='207' and equipment_name='Bracelete de Água'
   and rule_code='increase_water_damage_5_without_granting_water')
 then raise exception 'Original equipment rules mismatch';end if;
 if not (select relrowsecurity from pg_class
  where oid='public.chaotic_preview_3x3_private_equipment_checks'::regclass)
 or has_table_privilege('anon','public.chaotic_preview_3x3_private_equipment_checks','select')
 or has_table_privilege('authenticated','public.chaotic_preview_3x3_private_equipment_checks','insert')
 or has_table_privilege('authenticated','public.chaotic_preview_3x3_private_equipment_checks','update')
 or has_table_privilege('authenticated','public.chaotic_preview_3x3_private_equipment_checks','delete')
 or not has_table_privilege('authenticated','public.chaotic_preview_3x3_private_equipment_checks','select')
 or has_table_privilege('authenticated','public.chaotic_preview_3x3_equipment_catalog','select')
 then raise exception 'Private reference or equipment inspection grants not secured';end if;
 if exists(select 1 from pg_publication_tables
 where pubname='supabase_realtime' and schemaname='public'
 and tablename='chaotic_preview_3x3_private_equipment_checks')
 then raise exception 'Private equipment leaked through room Realtime publication';end if;
 select qual into owner_policy from pg_policies where schemaname='public'
  and tablename='chaotic_preview_3x3_private_equipment_checks'
  and policyname='chaotic_preview_3x3_equipment_owner_only';
 if owner_policy is null
  or position('defender_id' in owner_policy)=0
  or position('auth.uid()' in owner_policy)=0
  or position('chaotic_match_turns' in owner_policy)=0
 then raise exception 'Private equipment RLS must require defender identity';end if;
 if has_function_privilege('anon','public.chaotic_inspect_preview_3x3_private_defender_equipment(uuid,integer)','execute')
 or not has_function_privilege('authenticated','public.chaotic_inspect_preview_3x3_private_defender_equipment(uuid,integer)','execute')
 then raise exception 'Equipment inspector RPC grants invalid';end if;
 select lower(regexp_replace(pg_get_functiondef(
 'public.chaotic_inspect_preview_3x3_private_defender_equipment(uuid,integer)'::regprocedure),
 '[[:space:]]+','','g')) into fn;
 if position('actoruuid:=auth.uid()' in fn)=0
 or position('w.status<>''awaiting_defender''' in fn)=0
 or position('w.defender_idisdistinctfromactor' in fn)=0
 or position('chaotic_preview_3x3_creature_element_checks' in fn)=0
 or position('chaotic_preview_3x3_elemental_inspections' in fn)=0
 or position('chaotic_game_nodes' in fn)=0
 or position('chaotic_preview_3x3_hp_wallets' in fn)=0
 or position('x.value->>''tipocarta''=''equipamento''' in fn)=0
 then raise exception 'Owner/card/deck/HP checks missing from private inspector';end if;
 if exists(select 1 from public.chaotic_preview_3x3_private_equipment_checks
 where equipment_effect_applied or equipment_publicly_revealed
  or training_hp_changed or official_hp_changed
  or official_match_modified or final_damage_calculated)
 then raise exception 'Private inspection improperly modified gameplay';end if;
end $verify$;
rollback;
select 'PASS v0.1.44: 7 original equipments, owner-only RLS, no Realtime reveal, no damage' as result;