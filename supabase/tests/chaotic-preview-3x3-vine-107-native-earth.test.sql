-- Chaotic GO v0.1.53 guard audit, read-only and rolled back.
begin;
do $check$
declare fn text; ko text; trigger_fn text; c text;
begin
 select lower(regexp_replace(pg_get_functiondef(
 'public.chaotic_apply_preview_3x3_training_vine_107(uuid,integer)'::regprocedure),
 '[[:space:]]+','','g')) into fn;
 select lower(regexp_replace(pg_get_functiondef(
 'public.chaotic_record_preview_3x3_training_knockout()'::regprocedure),
 '[[:space:]]+','','g')) into ko;
 select lower(regexp_replace(pg_get_functiondef(
 'public.chaotic_guard_preview_3x3_training_attack_lock()'::regprocedure),
 '[[:space:]]+','','g')) into trigger_fn;
 if has_function_privilege('anon',
  'public.chaotic_apply_preview_3x3_training_vine_107(uuid,integer)','execute')
 or not has_function_privilege('authenticated',
  'public.chaotic_apply_preview_3x3_training_vine_107(uuid,integer)','execute')
 or has_function_privilege('authenticated',
  'public.chaotic_guard_preview_3x3_training_attack_lock()','execute')
 then raise exception 'Vine 107 authentication grants invalid';end if;
 if position('actoruuid:=auth.uid()' in fn)=0
 or position('proj.catalog_attack_id<>''107''' in fn)=0
 or position('expected_name:=''armadilhadevinha''' in fn)=0
 or position('expected_cost:=1' in fn)=0
 or position('meta.earth_component<>5' in fn)=0
 or position('gear.equipment_status<>''no_equipment_in_slot''' in fn)=0
 or position('actor_deck' in fn)=0
 or position('actual_elementsisdistinctfromcreature.attacker_base_elements' in fn)=0
 or position('elemental_bonus:=5*earth_granted::integer' in fn)=0
 or position('last_blocked_turn,blocks_draw' in fn)=0
 or position('training_elemental_vine_107_attack_draw_lock_partial' in fn)=0
 or position('effects_fully_resolved' in fn)=0
 or position('w.status<>''defender_passed_preview''' in fn)=0
 then raise exception 'Vine 107 native Earth/defense/turn/partial effect safeguards absent';end if;
 if position('paid.catalog_attack_idnotin(''101'',''105'',''107'',''111'',''112'',''113'',''114'')' in ko)=0
 or position('expected_damage:=5+5*(ref_el?''terra'')::integer' in ko)=0
 then raise exception 'KO trigger does not independently verify Vine 107 Earth';end if;
 if position('draw_inserted:=new.drew_card' in trigger_fn)=0
 or position('l.blocks_drawanddraw_inserted' in trigger_fn)=0
 then raise exception 'Vine 107 draw lock unsafe or missing';end if;
 if not exists(select 1 from pg_trigger
  where tgrelid='public.chaotic_preview_3x3_hand_draw_events'::regclass
   and tgname='chaotic_3x3_vine_draw_guard' and tgenabled='O'
   and not tgisinternal)
 then raise exception 'Cannot block next-turn draws';end if;
 select pg_get_constraintdef(oid) into c from pg_constraint
 where conrelid='public.chaotic_preview_3x3_training_damage_events'::regclass
  and conname='chaotic_preview_3x3_training_elemental_attack_catalog_check';
 if c is null or position('107' in c)=0 or position('101' in c)=0
  or position('114' in c)=0 then raise exception 'Previous six attacks not retained';end if;
 if not (select relrowsecurity from pg_class
  where oid='public.chaotic_preview_3x3_training_attack_locks'::regclass)
 or has_table_privilege('authenticated','public.chaotic_preview_3x3_training_attack_locks','insert')
 or has_table_privilege('authenticated','public.chaotic_preview_3x3_hp_wallets','update')
 then raise exception 'Training lock/HP writable by client';end if;
 if exists(select 1 from public.chaotic_preview_3x3_training_damage_events
  where official_hp_changed or official_match_modified or not training_only)
 then raise exception 'Official HP or match leaked into training';end if;
end $check$;
rollback;
select 'PASS v0.1.53: native Earth Vine 107 damage, attack/draw guard, KO, auth and prior six attacks' as result;