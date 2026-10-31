-- Chaotic GO v0.1.54 — SQL regression of native SONAR and Rex original immunity.
begin;
do $audit$
declare resolver text; knock text; check_body text; term text;
begin
 if has_function_privilege('anon',
   'public.chaotic_apply_preview_3x3_training_sonar_110(uuid,integer)','execute')
 or not has_function_privilege('authenticated',
   'public.chaotic_apply_preview_3x3_training_sonar_110(uuid,integer)','execute')
 then raise exception 'SONAR RPC permission mismatch';end if;
 select lower(regexp_replace(pg_get_functiondef(
 'public.chaotic_apply_preview_3x3_training_sonar_110(uuid,integer)'::regprocedure),
 '[[:space:]]+','','g')) into resolver;
 foreach term in array array['actoruuid:=auth.uid()','m.current_playerisdistinctfromactor','w.status<>''defender_passed_preview''','proj.catalog_attack_id<>''110''','expected_name:=''sonar''','expected_cost:=2','meta.earth_component<>10ormeta.air_component<>10','gear.equipment_status<>''no_equipment_in_slot''','actor_deck','actor_ally.creature_name=''naty''','a.creature_name=''guru''','h.hp_remaining>0','rex_immune:=defender_ally.creature_name=''rex''','c.card_id=''13''andc.card_name=''rex''','potential_damage:=10*earth_granted::integer+10*air_granted::integer','blocked_damage:=casewhenrex_immunethenpotential_damageelse0end','ifafter_hp<before_hpthen','immunity_prevented_damage','training_elemental_sonar_110_rex_immunity_search_pending','false,false'] loop
  if position(term in resolver)=0 then
   raise exception 'SONAR guard absent: %',term;
  end if;
 end loop;
 select lower(regexp_replace(pg_get_functiondef(
 'public.chaotic_record_preview_3x3_training_knockout()'::regprocedure),
 '[[:space:]]+','','g')) into knock;
 if position('paid.catalog_attack_idnotin(''101'',''105'',''107'',''110'',''111'',''112'',''113'',''114'')' in knock)=0
 or position('whennew.creature_name=''rex''then0' in knock)=0
 or position('10*(ref_el?''terra'')::integer+' in knock)=0
 then raise exception 'KO trigger ignores Rex immunity or previous attacks';end if;
 select pg_get_constraintdef(oid) into check_body from pg_constraint
 where conrelid='public.chaotic_preview_3x3_training_damage_events'::regclass
  and conname='chaotic_preview_3x3_training_elemental_attack_catalog_check';
 if check_body is null
 or position('110' in check_body)=0
 or position('105' in check_body)=0
 or position('114' in check_body)=0
 or position('immunity_prevented_damage' in check_body)=0
 then raise exception 'Damage event catalog lost previous attacks';end if;
 if not exists(select 1 from pg_constraint
 where conrelid='public.chaotic_preview_3x3_training_damage_events'::regclass
  and conname='chaotic_preview_3x3_training_elemental_bonus_bounds')
 then raise exception 'SONAR 20-damage bound missing';end if;
 if has_table_privilege('authenticated','public.chaotic_preview_3x3_hp_wallets','update')
  or has_table_privilege('authenticated','public.chaotic_preview_3x3_training_damage_events','insert')
 then raise exception 'Client could forge damage';end if;
 if exists(select 1 from public.chaotic_preview_3x3_training_damage_events
  where official_hp_changed or official_match_modified or not training_only)
 then raise exception 'Official combat affected';end if;
end $audit$;
rollback;
select 'PASS v0.1.54: SONAR natural Earth/Air, Rex full damage immunity, pending search and prior attacks' as result;