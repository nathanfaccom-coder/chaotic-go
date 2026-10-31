-- Chaotic GO v0.1.87: defensively equipped Bracelet of Water (207)
-- is an offensive WATER modifier and does NOT negate neutral 105 base damage.
-- 207 grants no water element; cannot add damage to another actor's neutral hit.
alter table public.chaotic_preview_3x3_borrowed_105_equipment_audits
 drop constraint chaotic_preview_3x3_borrowed_105_equ_catalog_equipment_id_check,
 drop constraint chaotic_preview_3x3_borrowed_105_equipment_audi_rule_code_check,
 drop constraint chaotic_preview_3x3_borrowed_105_equipment_audits_check1;
alter table public.chaotic_preview_3x3_borrowed_105_equipment_audits
 add constraint chaotic_borrowed_105_supported_equipment_ids_v0187
  check(catalog_equipment_id in('202','204','207')),
 add constraint chaotic_borrowed_105_supported_rules_v0187
  check(rule_code in('immune_to_attacks_involving_air',
                     'increase_wisdom_40',
                     'increase_water_damage_5_without_granting_water')),
 add constraint chaotic_borrowed_105_equipment_id_rule_match_v0187
  check((catalog_equipment_id='202' and rule_code='immune_to_attacks_involving_air')
     or (catalog_equipment_id='204' and rule_code='increase_wisdom_40')
     or (catalog_equipment_id='207' and rule_code='increase_water_damage_5_without_granting_water'));
