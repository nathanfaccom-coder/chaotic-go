-- Chaotic GO 0.1.29: SQL regression of read-only Mugic counterplan.
begin;
do $test$
declare f text; policy_def text;
begin
 if not (select relrowsecurity from pg_catalog.pg_class
   where oid='public.chaotic_preview_burst_mugic_counterplans'::regclass)
 then raise exception 'LIFO counterplan must be protected by RLS';end if;
 if has_table_privilege('anon','public.chaotic_preview_burst_mugic_counterplans','select')
  or has_table_privilege('authenticated','public.chaotic_preview_burst_mugic_counterplans','insert')
  or has_table_privilege('authenticated','public.chaotic_preview_burst_mugic_counterplans','update')
  or has_table_privilege('authenticated','public.chaotic_preview_burst_mugic_counterplans','delete')
 then raise exception 'Unauthorized user can read or forge the review';end if;
 if not has_table_privilege('authenticated','public.chaotic_preview_burst_mugic_counterplans','select')
 then raise exception 'Participants cannot read LIFO review';end if;
 select qual into policy_def from pg_catalog.pg_policies
  where schemaname='public' and tablename='chaotic_preview_burst_mugic_counterplans'
    and policyname='chaotic_burst_counterplan_member_read';
 if policy_def is null or position('auth.uid()' in policy_def)=0
   or position('chaotic_match_turns' in policy_def)=0
 then raise exception 'Counterplan member-only policy missing';end if;
 if has_function_privilege('anon','public.chaotic_prepare_preview_mugic_counterplan(uuid,integer)','execute')
  or not has_function_privilege('authenticated','public.chaotic_prepare_preview_mugic_counterplan(uuid,integer)','execute')
 then raise exception 'RPC grants invalid';end if;
 select pg_get_functiondef('public.chaotic_prepare_preview_mugic_counterplan(uuid,integer)'::regprocedure)
  into f;
 if position('auth.uid()' in f)=0
  or position('m.current_player is distinct from actor' in f)=0
  or position('pr.priority_status<>' in f)=0
  or position('pass_seq=1 and actor_id=actor' in f)=0
  or position('pass_seq=2 and actor_id=w.defender_id' in f)=0
  or position('creation.catalog_mugic_id<>' in f)=0
  or position('rejection.catalog_mugic_id<>' in f)=0
  or position('creation.card_instance_id' in f)=0
  or position('rejection.card_instance_id' in f)=0
  or position('creation.created_at' in f)=0
  or position('chaotic_preview_individual_damage' in f)=0
 then raise exception 'LIFO review lacks turn, passes, identity, order or damage guard';end if;
 if exists(select 1 from public.chaotic_preview_burst_mugic_counterplans
   where consumes_tokens or consumes_cards or effect_executed
     or official_match_modified or final_damage_verified or token_balance_verified)
 then raise exception 'A review incorrectly changed official or resource status';end if;
 if not exists(select 1 from pg_catalog.pg_constraint
  where conrelid='public.chaotic_preview_burst_mugic_counterplans'::regclass
    and pg_catalog.pg_get_constraintdef(oid) like '%inspection_steps%')
 then raise exception 'Inspection array is not schema constrained';end if;
end;
$test$;
rollback;
select 'PASS v0.1.29: authenticated attacker, two passes, original Mugic pair, private RLS, LIFO without cost or official effects' result;