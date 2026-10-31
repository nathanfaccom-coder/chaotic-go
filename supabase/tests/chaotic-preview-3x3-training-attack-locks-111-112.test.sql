-- Chaotic GO 0.1.49: transactional read-only verification.
begin;
do $verify$
declare fn text; ko text; guard text; c text;
begin
 if not (select relrowsecurity from pg_class
  where oid='public.chaotic_preview_3x3_training_attack_locks'::regclass)
 or has_table_privilege('anon','public.chaotic_preview_3x3_training_attack_locks','select')
 or not has_table_privilege('authenticated','public.chaotic_preview_3x3_training_attack_locks','select')
 or has_table_privilege('authenticated','public.chaotic_preview_3x3_training_attack_locks','insert')
 or has_table_privilege('authenticated','public.chaotic_preview_3x3_training_attack_locks','update')
 or has_table_privilege('authenticated','public.chaotic_preview_3x3_training_attack_locks','delete')
 then raise exception 'Attack lock table ownership, RLS or grants invalid';end if;
 if has_function_privilege('anon','public.chaotic_apply_preview_3x3_training_attack_lock(uuid,integer)','execute')
 or not has_function_privilege('authenticated','public.chaotic_apply_preview_3x3_training_attack_lock(uuid,integer)','execute')
 or has_function_privilege('authenticated','public.chaotic_guard_preview_3x3_training_attack_lock()','execute')
 then raise exception 'Public callable attack lock guard or RPC anonymous grant';end if;
 if (select count(*) from pg_trigger
  where tgname='chaotic_3x3_attack_lock_guard' and tgenabled='O' and not tgisinternal)<>3
 then raise exception 'Attack lock does not guard contact, projection and spend';end if;
 if not exists(select 1 from pg_trigger where tgname='chaotic_3x3_terminal_guard'
  and tgrelid='public.chaotic_preview_3x3_training_attack_locks'::regclass
  and not tgisinternal)
 then raise exception 'Training outcome guard missing from attack lock creation';end if;
 if not exists(select 1 from pg_publication_tables where schemaname='public'
  and tablename='chaotic_preview_3x3_training_attack_locks'
  and pubname='supabase_realtime')
 then raise exception 'Attack locks not synchronized with both clients';end if;
 select lower(regexp_replace(pg_get_functiondef(
  'public.chaotic_apply_preview_3x3_training_attack_lock(uuid,integer)'::regprocedure),
  '[[:space:]]+','','g')) into fn;
 if position('actoruuid:=auth.uid()' in fn)=0
  or position('m.current_playerisdistinctfromactor' in fn)=0
  or position('w.status<>''defender_passed_preview''' in fn)=0
  or position('paid.training_damage_applied' in fn)=0
  or position('proj.catalog_attack_idnotin(''111'',''112'')' in fn)=0
  or position('casewhenproj.catalog_attack_id=''111''then10else5end' in fn)=0
  or position('casewhenproj.catalog_attack_id=''111''then2else1end' in fn)=0
  or position('gear.equipment_status<>''no_equipment_in_slot''' in fn)=0
  or position('after_hp:=greatest(0,before_hp-damage_points)' in fn)=0
  or position('chaotic_preview_3x3_training_attack_locks' in fn)=0
  or position('training_damage_applied=true' in fn)=0
 then raise exception 'Canonical attack damage, lock duration or payment safeguards missing';end if;
 select lower(regexp_replace(pg_get_functiondef(
  'public.chaotic_record_preview_3x3_training_knockout()'::regprocedure),
  '[[:space:]]+','','g')) into ko;
 if position('paid.catalog_attack_idnotin(''105'',''111'',''112'')' in ko)=0
  or position('paid.catalog_attack_id,old.hp_remaining' in ko)=0
 then raise exception 'KO trigger does not recognize 111/112';end if;
 select lower(regexp_replace(pg_get_functiondef(
  'public.chaotic_guard_preview_3x3_training_attack_lock()'::regprocedure),
  '[[:space:]]+','','g')) into guard;
 if position('turn_num>l.inflicted_turn' in guard)=0
 or position('turn_num<=l.last_blocked_turn' in guard)=0
 or position('l.defender_id=actor' in guard)=0
 then raise exception 'Blocked actor or turn range invalid';end if;
 select pg_get_constraintdef(oid) into c from pg_constraint
 where conrelid='public.chaotic_preview_3x3_training_damage_events'::regclass
 and conname='chaotic_preview_3x3_training_attack_catalog_check';
 if position('111' in c)=0 or position('112' in c)=0
 or position('105' in c)=0 then raise exception 'Old Vento Forte or new attacks not allowed';end if;
 if exists(select 1 from public.chaotic_preview_3x3_training_attack_locks
  where not training_only or official_match_modified)
 then raise exception 'Official combat affected by training locks';end if;
end $verify$;
rollback;
select 'PASS v0.1.49: safe canonical 111/112 HP, one/two-turn locks, 105 preserved' as result;