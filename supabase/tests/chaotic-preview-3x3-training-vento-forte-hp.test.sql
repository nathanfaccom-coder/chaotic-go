-- Chaotic GO 0.1.46: transactional verification of the first persistent 3x3 training damage.
begin;
do $assert$
declare body text; policies text; constraint_text text;
begin
 if not (select relrowsecurity from pg_class
 where oid='public.chaotic_preview_3x3_training_damage_events'::regclass)
 or has_table_privilege('anon','public.chaotic_preview_3x3_training_damage_events','select')
 or has_table_privilege('authenticated','public.chaotic_preview_3x3_training_damage_events','insert')
 or has_table_privilege('authenticated','public.chaotic_preview_3x3_training_damage_events','update')
 or has_table_privilege('authenticated','public.chaotic_preview_3x3_training_damage_events','delete')
 or not has_table_privilege('authenticated','public.chaotic_preview_3x3_training_damage_events','select')
 or has_table_privilege('authenticated','public.chaotic_preview_3x3_hp_wallets','update')
 then raise exception 'Client may forge training damage or HP';end if;
 if has_function_privilege('anon','public.chaotic_apply_preview_3x3_training_base_105(uuid,integer)','execute')
 or not has_function_privilege('authenticated','public.chaotic_apply_preview_3x3_training_base_105(uuid,integer)','execute')
 then raise exception 'Training damage RPC cannot be called by intended player only';end if;
 select qual into policies from pg_policies
 where schemaname='public' and tablename='chaotic_preview_3x3_training_damage_events'
 and policyname='chaotic_preview_3x3_training_damage_members_read';
 if policies is null or position('auth.uid()' in policies)=0
 or position('chaotic_match_turns' in policies)=0
 then raise exception 'Training damage not restricted to room members';end if;
 select lower(regexp_replace(pg_get_functiondef(
 'public.chaotic_apply_preview_3x3_training_base_105(uuid,integer)'::regprocedure),
 '[[:space:]]+','','g')) into body;
 if position('actoruuid:=auth.uid()' in body)=0
 or position('m.current_playerisdistinctfromactor' in body)=0
 or position('w.status<>''defender_passed_preview''' in body)=0
 or position('chaotic_preview_3x3_private_equipment_checks' in body)=0
 or position('gear.equipment_status<>''no_equipment_in_slot''' in body)=0
 or position('proj.catalog_attack_id<>''105''' in body)=0
 or position('proj.base_damage<>5' in body)=0
 or position('meta.fire_component<>0' in body)=0
 or position('paid.training_damage_applied' in body)=0
 or position('chaotic_preview_3x3_attack_spends' in body)=0
 or position('chaotic_preview_3x3_hp_wallets' in body)=0
 or position('updatepublic.chaotic_preview_3x3_hp_wallets' in body)=0
 or position('greatest(0,before_hp-5)' in body)=0
 or position('chaotic_preview_3x3_training_damage_events' in body)=0
 or position('forupdate' in body)=0
 then raise exception 'Attack 105 HP debit lacks safeguards';end if;
 select pg_get_constraintdef(oid) into constraint_text
 from pg_constraint where conrelid='public.chaotic_preview_3x3_hp_wallets'::regclass
 and conname='chaotic_preview_3x3_training_hp_bounds';
 if constraint_text is null or position('hp_remaining' in constraint_text)=0
 or position('damage_events' in constraint_text)=0
 then raise exception 'HP table still sealed or no bounded damage progression';end if;
 if exists(select 1 from public.chaotic_preview_3x3_training_damage_events
 where official_hp_changed or official_match_modified or not training_only
 or not optional_reveal_pending or effects_fully_resolved)
 then raise exception 'Training damage crossed into official combat';end if;
 if not exists(select 1 from pg_publication_tables
 where schemaname='public' and tablename='chaotic_preview_3x3_training_damage_events'
 and pubname='supabase_realtime')
 then raise exception '3x3 damage not synchronized between participants';end if;
end $assert$;
rollback;
select 'PASS v0.1.46: server-authorized Vento Forte 5 training HP, no replay or official effects' as result;