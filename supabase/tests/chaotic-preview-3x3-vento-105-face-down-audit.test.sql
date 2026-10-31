-- Chaotic GO 0.1.56 server-side face-down and Vento Forte reveal audit.
begin;
do $audit$
declare fn text; constraint_def text; val text;
begin
 if not (select relrowsecurity from pg_class
  where oid='public.chaotic_preview_3x3_face_states'::regclass)
 or not (select relrowsecurity from pg_class
  where oid='public.chaotic_preview_3x3_vento_reveal_events'::regclass)
 then raise exception 'Face-down/reveal tables do not use RLS';end if;
 for val in select unnest(array['chaotic_preview_3x3_face_states',
                              'chaotic_preview_3x3_vento_reveal_events']) loop
  if has_table_privilege('anon','public.'||val,'select')
   or not has_table_privilege('authenticated','public.'||val,'select')
   or has_table_privilege('authenticated','public.'||val,'insert')
   or has_table_privilege('authenticated','public.'||val,'update')
  then raise exception 'Unsafe client grants on %',val;end if;
 end loop;
 if has_function_privilege('anon',
  'public.chaotic_resolve_preview_3x3_vento_reveal(uuid,integer,integer,boolean)','execute')
 or not has_function_privilege('authenticated',
  'public.chaotic_resolve_preview_3x3_vento_reveal(uuid,integer,integer,boolean)','execute')
 then raise exception 'Optional reveal RPC grants invalid';end if;
 select lower(regexp_replace(pg_get_functiondef(
  'public.chaotic_resolve_preview_3x3_vento_reveal(uuid,integer,integer,boolean)'::regprocedure),
  '[[:space:]]+','','g')) into fn;
 foreach val in array array[
  'actoruuid:=auth.uid()','m.current_playerisdistinctfromactor',
  'spent.catalog_attack_id<>''105''','dmg.catalog_attack_id<>''105''',
  'dmg.damage_dealt<=0','spent.training_damage_applied',
  'training_base_damage_105_optional_reveal_pending',
  'chaotic_preview_3x3_training_outcomes','notp_skipthen',
  'chosen.face_up','h.hp_remaining>0','actor_id=opponent',
  'training_base_damage_105_reveal_resolved','optional_reveal_pending=false',
  'effects_fully_resolved=true'
 ] loop
  if position(val in fn)=0 then raise exception 'Vento Forte invariant missing: %',val;end if;
 end loop;
 if not exists(select 1 from pg_trigger where
  tgrelid='public.chaotic_preview_3x3_allies'::regclass
  and tgname='chaotic_3x3_initialize_face_down' and tgenabled='O')
 or not exists(select 1 from pg_trigger where
  tgrelid='public.chaotic_preview_3x3_contact_intents'::regclass
  and tgname='chaotic_3x3_contact_reveals_participants' and tgenabled='O')
 then raise exception 'Contact/formation face-down lifecycle trigger missing';end if;
 select pg_get_constraintdef(oid) into constraint_def from pg_constraint
  where conrelid='public.chaotic_preview_3x3_training_damage_events'::regclass
  and conname='chaotic_preview_3x3_training_elemental_attack_catalog_check';
 if constraint_def is null or position('105' in constraint_def)=0
  or position('114' in constraint_def)=0 or position('110' in constraint_def)=0
 then raise exception 'Attack catalog lost prior allowed effects';end if;
 if exists(select 1 from public.chaotic_preview_3x3_training_damage_events
  where official_match_modified or official_hp_changed or not training_only)
 then raise exception 'Official game modified by experimental reveal';end if;
end $audit$;
rollback;
select 'PASS v0.1.56: Vento Forte 105 optional reveal, face-up contact, no client writes, attack safeguards intact' as result;