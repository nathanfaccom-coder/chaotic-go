-- Chaotic GO v0.1.88: add Bracelet of Crystal (206) ONLY when equipped
-- by the DEFENDER against a proven neutral borrowed Vento Forte (105).
-- 206 improves offensive EARTH damage and cures poison on its own ability;
-- neither action triggers in this passive defensive 105 resolution.
-- No poison system exists in the 3x3 training HP/gear schema.
-- Do not mint Earth damage, cure, tokens or change official match stats.
alter table public.chaotic_preview_3x3_borrowed_105_equipment_audits
  drop constraint chaotic_borrowed_105_supported_equipment_ids_v0187,
  drop constraint chaotic_borrowed_105_supported_rules_v0187,
  drop constraint chaotic_borrowed_105_equipment_id_rule_match_v0187;
alter table public.chaotic_preview_3x3_borrowed_105_equipment_audits
  add constraint chaotic_borrowed_105_supported_equipment_ids_v0188
    check(catalog_equipment_id in('202','204','206','207')),
  add constraint chaotic_borrowed_105_supported_rules_v0188
    check(rule_code in(
      'immune_to_attacks_involving_air',
      'increase_wisdom_40',
      'increase_earth_damage_5_cure_poison',
      'increase_water_damage_5_without_granting_water'
    )),
  add constraint chaotic_borrowed_105_equipment_id_rule_match_v0188
    check((catalog_equipment_id='202' and rule_code='immune_to_attacks_involving_air')
       or (catalog_equipment_id='204' and rule_code='increase_wisdom_40')
       or (catalog_equipment_id='206' and rule_code='increase_earth_damage_5_cure_poison')
       or (catalog_equipment_id='207' and rule_code='increase_water_damage_5_without_granting_water'));
