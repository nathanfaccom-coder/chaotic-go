-- Chaotic GO v0.1.39: transactional, non-mutating payment safety regression.
begin;
do $test$
declare body text; pol text; tbl text;
begin
 foreach tbl in array array['chaotic_preview_3x3_attack_wallets',
  'chaotic_preview_3x3_attack_hand','chaotic_preview_3x3_attack_spends'] loop
  if not (select relrowsecurity from pg_catalog.pg_class where oid=('public.'||tbl)::regclass)
   or has_table_privilege('anon','public.'||tbl,'select')
   or has_table_privilege('authenticated','public.'||tbl,'insert')
   or has_table_privilege('authenticated','public.'||tbl,'update')
   or has_table_privilege('authenticated','public.'||tbl,'delete')
  then raise exception 'Unsafe RLS or direct client mutation: %',tbl;end if;
 end loop;
 if has_function_privilege('anon','public.chaotic_spend_preview_3x3_attack(uuid,integer)','execute')
 or not has_function_privilege('authenticated','public.chaotic_spend_preview_3x3_attack(uuid,integer)','execute')
 then raise exception 'Payment RPC authorization grants invalid';end if;
 select qual into pol from pg_catalog.pg_policies
 where schemaname='public' and tablename='chaotic_preview_3x3_attack_spends'
  and policyname='chaotic_preview_3x3_attack_spend_members_read';
 if pol is null or position('auth.uid()' in pol)=0
  or position('chaotic_match_turns' in pol)=0
 then raise exception 'Payment event must be visible only to match members';end if;
 select lower(regexp_replace(pg_catalog.pg_get_functiondef(
   'public.chaotic_spend_preview_3x3_attack(uuid,integer)'::regprocedure),
   '[[:space:]]+','','g')) into body;
 if position('auth.uid()' in body)=0
 or position('m.current_playerisdistinctfromactor' in body)=0
 or position('m.turn_no<>p_expected_turn' in body)=0
 or position('l.mode<>''3x3''' in body)=0
 or position('chaotic_preview_3x3_cost_inspections' in body)=0
 or position('chaotic_preview_3x3_attack_projections' in body)=0
 or position('inspection.can_afford' in body)=0
 or position('available_pointsisdistinctfrominspection.points_available' in body)=0
 or position('card.card_state<>''hand''' in body)=0
 or position('card.attack_instance_idisdistinctfromprojection.attack_instance_id' in body)=0
 or position('chaotic_preview_3x3_attack_spends' in body)=0
 or position('forupdate' in body)=0
 or position('setspent_points=new_spent' in body)=0
 or position('setcard_state=''spent''' in body)=0
 or position('chaotic_preview_clashes' in body)=0
 or position('chaotic_preview_burst_windows' in body)=0
 then raise exception 'Required ownership, same-turn, cost, card, replay or atomic guards missing';end if;
 if not exists(select 1 from pg_catalog.pg_constraint
  where conrelid='public.chaotic_preview_3x3_attack_hand'::regclass
   and conname='chaotic_preview_3x3_attack_hand_spent_state_check')
 then raise exception 'Spent card state check is absent';end if;
 if not exists(select 1 from pg_catalog.pg_constraint
  where conrelid='public.chaotic_preview_3x3_attack_wallets'::regclass
   and conname='chaotic_preview_3x3_attack_wallets_spent_points_check'
   and pg_catalog.pg_get_constraintdef(oid) like '%65%')
 then raise exception 'Accumulated training spending is not bounded';end if;
 if not exists(select 1 from pg_catalog.pg_constraint
  where conrelid='public.chaotic_preview_3x3_attack_spends'::regclass
   and contype='p' and pg_catalog.pg_get_constraintdef(oid) like '%turn_no%')
 then raise exception 'One payment per turn is not constrained';end if;
 if exists(select 1 from public.chaotic_preview_3x3_attack_spends
  where not training_points_paid or not training_card_spent or training_damage_applied
    or official_points_changed or original_card_consumed or official_hp_changed
    or official_match_modified or points_after<>points_before-training_attack_cost)
 then raise exception 'A training payment affected official resources or the ledger is corrupt';end if;
 if exists(select 1 from public.chaotic_preview_3x3_attack_hand
 where (card_state='spent' and (spent_turn is null or spent_reason<>'attack'))
    or (card_state<>'spent' and (spent_turn is not null or spent_reason is not null)))
 then raise exception 'Hand spent state inconsistent';end if;
end $test$;
rollback;
select 'PASS v0.1.39: private hand, atomic wallet debit, one-use card, correct audit, no official state' as result;