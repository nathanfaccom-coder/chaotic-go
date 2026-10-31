-- Chaotic GO 0.1.31: read-only security and effect checks for training abilities.
begin;
do $$
declare f text; p text;
begin
 if not (select relrowsecurity from pg_class where oid='public.chaotic_preview_ability_heal_events'::regclass)
 or has_table_privilege('anon','public.chaotic_preview_ability_heal_events','select')
 or has_table_privilege('authenticated','public.chaotic_preview_ability_heal_events','insert')
 or has_table_privilege('authenticated','public.chaotic_preview_ability_heal_events','update')
 or has_table_privilege('authenticated','public.chaotic_preview_ability_heal_events','delete')
 then raise exception 'Training journal has unsafe RLS/grants';end if;
 if has_function_privilege('anon','public.chaotic_apply_preview_ability_heal(uuid,integer,uuid)','execute')
 or not has_function_privilege('authenticated','public.chaotic_apply_preview_ability_heal(uuid,integer,uuid)','execute')
 then raise exception 'Ability RPC privilege is wrong';end if;
 select lower(regexp_replace(pg_get_functiondef('public.chaotic_apply_preview_ability_heal(uuid,integer,uuid)'::regprocedure),'[[:space:]]+','','g')) into f;
 if position('m.current_playerisdistinctfromactor' in f)=0
 or position('p_target_actor_idnotin(m.host_id,m.guest_id)' in f)=0
 or position('chaotic_preview_burst_windows' in f)=0
 or position('chaotic_preview_clashes' in f)=0
 or position('wallet.remaining_tokens<1' in f)=0
 or position('hp.creature_instance_idisdistinctfromdst.card_instance_id' in f)=0
 or position('forupdate' in f)=0
 or position('src.creature_name=''lion''' in f)=0
 or position('src.creature_name=''vidal''' in f)=0
 or position('src.creature_name=''xamã''' in f)=0
 or position('new_hp:=least(hp.hp_remaining+15,hp.hp_max)' in f)=0
 or position('new_hp:=least(hp.hp_remaining+10,hp.hp_max)' in f)=0
 or position('new_max:=hp.hp_max+10' in f)=0
 then raise exception 'Training RPC authorization or canonical effect missing';end if;
 select qual into p from pg_policies where schemaname='public'
 and tablename='chaotic_preview_ability_heal_events' and policyname='chaotic_preview_ability_heal_members';
 if p is null or position('auth.uid()' in p)=0 or position('chaotic_match_turns' in p)=0
 then raise exception 'Journal read policy not limited to participants';end if;
 if not exists(select 1 from pg_constraint where conrelid='public.chaotic_preview_ability_heal_events'::regclass
 and pg_get_constraintdef(oid) like '%lion_energy_10%')
 then raise exception 'Database numeric checks absent';end if;
 if exists(select 1 from public.chaotic_preview_ability_heal_events
  where official_match_modified or official_hp_changed or official_tokens_consumed
  or tokens_after<>tokens_before-1 or hp_after>hp_max_after)
 then raise exception 'Official state leak detected';end if;
end $$;
rollback;
select 'PASS: Lion Vidal Xamã one-token training-only HP rules, member RLS, replay and Burst guards' as result;