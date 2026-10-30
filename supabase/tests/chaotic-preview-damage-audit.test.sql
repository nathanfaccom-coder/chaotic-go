begin;
do $$
declare
 codes text[];
 n integer;
begin
 codes:=public.chaotic_preview_resolution_blockers(
  '105','Johnes','Rex',null,null,501,'partial_estimate',5);
 if not('burst_unresolved'=any(codes)) or
  not('hidden_creature_reveal_unresolved'=any(codes))
  or cardinality(codes)<5 then raise exception 'Missing mandatory blockers: %',codes;end if;
 codes:=public.chaotic_preview_resolution_blockers(
  '107','Johnes','Leona',null,null,503,'partial_estimate',10);
 if not('vine_turn_skip_requires_final_damage'=any(codes)) then
  raise exception 'Vinha requires final damage: %',codes;end if;
 codes:=public.chaotic_preview_resolution_blockers(
  '111','Johnes','Leona',null,null,502,'partial_estimate',10);
 if not('electronic_attack_lock_requires_final_damage'=any(codes)) then
  raise exception 'Electronic hand effect missing: %',codes;end if;
 codes:=public.chaotic_preview_resolution_blockers(
  '112','Johnes','Leona',null,null,501,'partial_estimate',5);
 if not('hand_attack_lock_requires_final_damage'=any(codes)) then
  raise exception 'Mao Mao blocker missing: %',codes;end if;
 codes:=public.chaotic_preview_resolution_blockers(
  '104','Johnes','Leona','Bracelete de Cristal',null,null,
  'special_resolution_required',null);
 if not('die_roll_or_special_resolution'=any(codes))
  or not('equipment_full_effects_unresolved'=any(codes))
  or not('damage_formula_incomplete'=any(codes))
  or not('location_not_selected'=any(codes))
 then raise exception 'Unresolved card missing blockers: %',codes;end if;
 codes:=public.chaotic_preview_resolution_blockers(
  '108','Johnes','Leona',null,null,501,'partial_estimate',0);
 if not('hand_draw_heal_or_other_action_unresolved'=any(codes))
 then raise exception 'Non-damage card incorrectly cleared: %',codes;end if;
 if not (select relrowsecurity from pg_class
  where oid='public.chaotic_preview_resolution_audits'::regclass)
 then raise exception 'RLS missing';end if;
 if has_table_privilege('authenticated','public.chaotic_preview_resolution_audits','insert')
  or has_table_privilege('authenticated','public.chaotic_preview_resolution_audits','update')
  or has_table_privilege('authenticated','public.chaotic_preview_resolution_audits','delete')
 then raise exception 'Players can forge verified damage';end if;
 if has_function_privilege('anon','public.chaotic_audit_preview_damage(uuid,integer)','execute')
 then raise exception 'Anonymous final audit access';end if;
 if not has_function_privilege('authenticated','public.chaotic_audit_preview_damage(uuid,integer)','execute')
 then raise exception 'Authenticated preview audit blocked';end if;
 if exists(select 1 from public.chaotic_preview_resolution_audits
  where final_damage_verified or applied_to_official_match
   or review_status<>'incomplete')
 then raise exception 'Found prematurely finalized attack';end if;
 select count(*) into n from pg_policies
  where schemaname='public' and tablename='chaotic_preview_resolution_audits'
  and cmd='SELECT';
 if n<>1 then raise exception 'Unexpected audit read policies: %',n;end if;
end $$;
rollback;
select 'PASS: attack-specific blockers, zero-damage effects, Burst, equipment, RLS, no final damage' as result;