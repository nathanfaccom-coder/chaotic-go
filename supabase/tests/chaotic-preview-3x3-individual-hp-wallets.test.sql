-- Chaotic GO v0.1.34 — no-write regression: 3x3 private independent HP wallets.
begin;
do $test$
declare body text; rule text; n integer;
begin
 if not (select relrowsecurity from pg_class
  where oid='public.chaotic_preview_3x3_hp_wallets'::regclass)
 then raise exception '3x3 HP is not protected by RLS';end if;
 if has_table_privilege('anon','public.chaotic_preview_3x3_hp_wallets','select')
  or has_table_privilege('authenticated','public.chaotic_preview_3x3_hp_wallets','insert')
  or has_table_privilege('authenticated','public.chaotic_preview_3x3_hp_wallets','update')
  or has_table_privilege('authenticated','public.chaotic_preview_3x3_hp_wallets','delete')
 then raise exception 'Unauthorized 3x3 HP access or direct mutation enabled';end if;
 if not has_table_privilege('authenticated','public.chaotic_preview_3x3_hp_wallets','select')
 then raise exception 'Participants cannot read training HP';end if;
 if has_function_privilege('anon','public.chaotic_prepare_preview_3x3_hp(uuid,integer)','execute')
  or not has_function_privilege('authenticated','public.chaotic_prepare_preview_3x3_hp(uuid,integer)','execute')
 then raise exception '3x3 HP RPC privilege mistake';end if;
 select qual into rule from pg_policies
 where schemaname='public' and tablename='chaotic_preview_3x3_hp_wallets'
  and policyname='chaotic_preview_3x3_hp_members_read';
 if rule is null or position('auth.uid()' in rule)=0
   or position('chaotic_match_turns' in rule)=0
 then raise exception 'RLS should limit reads to match participants';end if;
 select lower(regexp_replace(pg_get_functiondef(
  'public.chaotic_prepare_preview_3x3_hp(uuid,integer)'::regprocedure
 ),'[[:space:]]+','','g')) into body;
 if position('auth.uid()' in body)=0
  or position('m.current_playerisdistinctfromactor' in body)=0
  or position('m.turn_no<>p_expected_turn' in body)=0
  or position('l.mode<>''3x3''' in body)=0
  or position('chaotic_preview_3x3_allies' in body)=0
  or position('chaotic_game_nodes' in body)=0
  or position('decks/3x3_slot_' in body)=0
  or position('pg_catalog.jsonb_array_elements' in body)=0
  or position('original->''stats''->>''e''' in body)=0
  or position('forupdate' in body)=0
  or position('forslot_noin4..6loop' in body)=0
  or position('hp_3x3_training_seeded' in body)=0
 then raise exception 'Missing server authorization, deck DNA, or atomic HP preparation guard';end if;
 if not exists(select 1 from pg_constraint
  where conrelid='public.chaotic_preview_3x3_hp_wallets'::regclass
    and pg_get_constraintdef(oid) like '%hp_initial = hp_max%')
 then raise exception 'Initial HP ceiling mismatch not constrained';end if;
 if exists(select 1 from public.chaotic_preview_3x3_hp_wallets
  where official_match_modified or official_hp_changed or location_bonuses_applied
   or damage_events<>0 or healing_events<>0 or hp_remaining<>hp_initial)
 then raise exception 'Preview HP claims damage, healing or official effects';end if;
 select count(*) into n from public.chaotic_preview_3x3_hp_wallets;
 if n>0 and exists(select 1 from public.chaotic_preview_3x3_hp_wallets hp
   where not exists(select 1 from public.chaotic_preview_3x3_allies ally
    where ally.lobby_id=hp.lobby_id and ally.actor_id=hp.actor_id
      and ally.position=hp.position and ally.creature_instance_id=hp.creature_instance_id))
 then raise exception 'HP snapshot not aligned to frozen individual creature';end if;
end;
$test$;
rollback;
select 'PASS v0.1.34: 3x3 independently validated saved card energy, private RLS, no HP reset or official effects' as result;