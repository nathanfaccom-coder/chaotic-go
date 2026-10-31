-- Chaotic GO v0.1.52: protect native-only Acid 101 settlement and original card data.
begin;
do $verify$
declare fn text; knock text; c text; n integer;
begin
 select lower(regexp_replace(pg_get_functiondef(
  'public.chaotic_apply_preview_3x3_training_acid_101(uuid,integer)'::regprocedure),
  '[[:space:]]+','','g')) into fn;
 select lower(regexp_replace(pg_get_functiondef(
  'public.chaotic_record_preview_3x3_training_knockout()'::regprocedure),
  '[[:space:]]+','','g')) into knock;
 if has_function_privilege('anon','public.chaotic_apply_preview_3x3_training_acid_101(uuid,integer)','execute')
 or not has_function_privilege('authenticated','public.chaotic_apply_preview_3x3_training_acid_101(uuid,integer)','execute')
 then raise exception 'Acid 101 RPC authorization invalid';end if;
 if position('actoruuid:=auth.uid()' in fn)=0
 or position('m.current_playerisdistinctfromactor' in fn)=0
 or position('w.status<>''defender_passed_preview''' in fn)=0
 or position('paid.training_damage_applied' in fn)=0
 or position('proj.catalog_attack_id<>''101''' in fn)=0
 or position('expected_name:=''ácidogástrico''' in fn)=0
 or position('expected_cost:=3' in fn)=0
 or position('meta.fire_component<>5ormeta.water_component<>5' in fn)=0
 or position('gear.equipment_status<>''no_equipment_in_slot''' in fn)=0
 or position('actor_deck' in fn)=0
 or position('actor_ally.creature_name=''naty''' in fn)=0
 or position('element_count<>1' in fn)=0
 or position('actual_elementsisdistinctfromcreature.attacker_base_elements' in fn)=0
 or position('elemental_bonus:=5*fire_granted::integer+5*water_granted::integer' in fn)=0
 or position('after_hp:=greatest(0,before_hp-damage_points-elemental_bonus)' in fn)=0
 or position('training_elemental_acid_101_native_only' in fn)=0
 then raise exception 'Acid 101 does not safely constrain native elemental damage';end if;
 if position('paid.catalog_attack_idnotin(''101'',''105'',''111'',''112'',''113'',''114'')' in knock)=0
 or position('expected_damage:=10+5*(ref_el?''fogo'')::integer' in knock)=0
 then raise exception 'Acid 101 knockout verification incomplete';end if;
 select pg_get_constraintdef(oid) into c from pg_constraint
  where conrelid='public.chaotic_preview_3x3_training_damage_events'::regclass
   and conname='chaotic_preview_3x3_training_elemental_attack_catalog_check';
 if c is null or position('101' in c)=0 or position('114' in c)=0
 or position('elemental_bonus_damage' in c)=0
 then raise exception 'Damage event catalog invalid';end if;
 if not exists(select 1 from pg_constraint where conrelid=
  'public.chaotic_preview_3x3_training_damage_events'::regclass
   and conname='chaotic_preview_3x3_training_elemental_hp_after')
 then raise exception 'HP event does not enforce elemental bonus';end if;
 if has_table_privilege('authenticated','public.chaotic_preview_3x3_training_damage_events','insert')
 or has_table_privilege('authenticated','public.chaotic_preview_3x3_hp_wallets','update')
 then raise exception 'Client is able to forge damage or HP';end if;
 if exists(select 1 from public.chaotic_preview_3x3_training_damage_events
  where official_hp_changed or official_match_modified or not training_only)
 then raise exception 'Elemental resolution modified official match';end if;
end $verify$;
rollback;
select 'PASS 0.1.52: Acid 101 native Fire/Water only, equipment blocked, KO+HP constrained, official untouched' as result;