-- Chaotic GO v0.1.37: no-write check of original Attack catalog and hypothetical HP projection.
begin;
do $t$
declare f text; p text;
begin
 if not (select relrowsecurity from pg_class where oid='public.chaotic_preview_3x3_attack_projections'::regclass)
 or has_table_privilege('anon','public.chaotic_preview_3x3_attack_projections','select')
 or has_table_privilege('authenticated','public.chaotic_preview_3x3_attack_projections','insert')
 or has_table_privilege('authenticated','public.chaotic_preview_3x3_attack_projections','update')
 then raise exception 'Private training attack projection grants invalid';end if;
 if has_function_privilege('anon','public.chaotic_prepare_preview_3x3_base_attack(uuid,integer,integer)','execute')
 or not has_function_privilege('authenticated','public.chaotic_prepare_preview_3x3_base_attack(uuid,integer,integer)','execute')
 then raise exception 'Attack RPC grants unsafe';end if;
 select qual into p from pg_policies where schemaname='public'
 and tablename='chaotic_preview_3x3_attack_projections'
 and policyname='chaotic_preview_3x3_attack_projection_members_read';
 if p is null or position('auth.uid()' in p)=0
 or position('chaotic_match_turns' in p)=0
 then raise exception 'Private match reader policy missing';end if;
 select lower(regexp_replace(pg_get_functiondef(
 'public.chaotic_prepare_preview_3x3_base_attack(uuid,integer,integer)'::regprocedure),
 '[[:space:]]+','','g')) into f;
 if position('auth.uid()' in f)=0
 or position('m.current_playerisdistinctfromactor' in f)=0
 or position('encounter.attacker_idisdistinctfromactor' in f)=0
 or position('chaotic_preview_3x3_contact_intents' in f)=0
 or position('chaotic_preview_3x3_hp_wallets' in f)=0
 or position('hp.hp_remainingisdistinctfromencounter.defender_hp_at_contact' in f)=0
 or position('decks/3x3_slot_' in f)=0
 or position('pg_catalog.jsonb_array_elements' in f)=0
 or position('x.value->>''tipocarta''=''ataque''' in f)=0
 or position('chaotic_preview_card_reference' in f)=0
 or position('model_count<>1' in f)=0
 or position('chaotic_preview_clashes' in f)=0
 or position('chaotic_preview_burst_windows' in f)=0
 or position('forupdate' in f)=0
 then raise exception 'Attack ownership, turn, catalog or HP guards missing';end if;
 if not exists(select 1 from pg_constraint
 where conrelid='public.chaotic_preview_3x3_attack_projections'::regclass
 and contype='c' and pg_get_constraintdef(oid) ilike '%greatest%')
 then raise exception 'Defender HP projection arithmetic not constrained';end if;
 if exists(select 1 from public.chaotic_preview_3x3_attack_projections
 where attack_in_hand_verified or attack_cost_paid or elemental_damage_applied
 or defensive_effects_resolved or training_hp_changed or official_hp_changed
 or original_card_consumed or official_match_modified
 or defender_hp_projected<>greatest(0,defender_hp_before-base_damage))
 then raise exception 'Hypothetical attack falsely changed official or training state';end if;
end $t$;
rollback;
select 'PASS v0.1.37: attack catalog ownership, RLS, projected base HP and no real effect' result;