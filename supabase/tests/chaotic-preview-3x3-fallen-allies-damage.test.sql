-- Chaotic GO v0.1.50: transactional checks for canonical conditional damage.
begin;
do $verify$
declare f text; ko text; catalog text;
begin
 select lower(regexp_replace(pg_get_functiondef(
 'public.chaotic_apply_preview_3x3_training_fallen_allies(uuid,integer)'::regprocedure),
 '[[:space:]]+','','g')) into f;
 select lower(regexp_replace(pg_get_functiondef(
 'public.chaotic_record_preview_3x3_training_knockout()'::regprocedure),
 '[[:space:]]+','','g')) into ko;
 if has_function_privilege('anon',
  'public.chaotic_apply_preview_3x3_training_fallen_allies(uuid,integer)','execute')
 or not has_function_privilege('authenticated',
  'public.chaotic_apply_preview_3x3_training_fallen_allies(uuid,integer)','execute')
 then raise exception 'RPC grants invalid';end if;
 if position('actoruuid:=auth.uid()' in f)=0
  or position('w.status<>''defender_passed_preview''' in f)=0
  or position('paid.training_damage_applied' in f)=0
  or position('proj.catalog_attack_idnotin(''113'',''114'')' in f)=0
  or position('gear.equipment_status<>''no_equipment_in_slot''' in f)=0
  or position('unit_count<>3' in f)=0
  or position('bonus_damage:=5*defeated_count' in f)=0
  or position('after_hp:=greatest(0,before_hp-damage_points-bonus_damage)' in f)=0
  or position('ifafter_hp<before_hpthen' in f)=0
  or position('training_conditional_damage_resolved' in f)=0
 then raise exception 'Canonical conditional/zero-damage server checks absent';end if;
 if position('paid.catalog_attack_idnotin(''105'',''111'',''112'',''113'',''114'')' in ko)=0
  or position('when''113''then5*dead_count' in ko)=0
  or position('when''114''then10+5*dead_count' in ko)=0
  or position('new.hp_remainingisdistinctfromgreatest(0,old.hp_remaining-expected_damage)' in ko)=0
 then raise exception 'Knockout trigger mismatches 113/114';end if;
 select pg_get_constraintdef(oid) into catalog from pg_constraint
  where conrelid='public.chaotic_preview_3x3_training_damage_events'::regclass
  and conname='chaotic_preview_3x3_training_conditional_attack_catalog_check';
 if catalog is null or position('113' in catalog)=0
  or position('114' in catalog)=0 or position('105' in catalog)=0
  or position('111' in catalog)=0 or position('112' in catalog)=0
 then raise exception 'Attack catalog constraints altered';end if;
 if not exists(select 1 from pg_constraint
  where conrelid='public.chaotic_preview_3x3_training_damage_events'::regclass
   and conname='chaotic_preview_3x3_training_conditional_hp_after')
 then raise exception 'HP calculation constraint missing';end if;
 if has_table_privilege('authenticated','public.chaotic_preview_3x3_training_damage_events','insert')
  or has_table_privilege('authenticated','public.chaotic_preview_3x3_training_knockouts','update')
 then raise exception 'Client can forge damage or knockout';end if;
 if exists(select 1 from public.chaotic_preview_3x3_training_damage_events
  where official_hp_changed or official_match_modified or not training_only)
 then raise exception 'Original combat was affected';end if;
end $verify$;
rollback;
select 'PASS 0.1.50: 113/114 original damage, 0 HP mutation skipped, KO validates, 105/111/112 preserved' as result;