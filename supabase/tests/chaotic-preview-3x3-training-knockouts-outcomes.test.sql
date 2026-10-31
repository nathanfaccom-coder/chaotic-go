-- Chaotic GO v0.1.47: transactional read-only audit for training KO/outcome guards.
begin;
do $verify$
declare fn text; tbl text;
begin
 for tbl in select unnest(array[
  'chaotic_preview_3x3_training_knockouts',
  'chaotic_preview_3x3_training_outcomes'
 ]) loop
  if not (select relrowsecurity from pg_class where oid=('public.'||tbl)::regclass)
    or has_table_privilege('anon',('public.'||tbl),'select')
    or not has_table_privilege('authenticated',('public.'||tbl),'select')
    or has_table_privilege('authenticated',('public.'||tbl),'insert')
    or has_table_privilege('authenticated',('public.'||tbl),'update')
    or has_table_privilege('authenticated',('public.'||tbl),'delete')
  then raise exception 'Unauthorized KO/outcome table access: %',tbl;end if;
 end loop;
 if exists(select 1 from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='chaotic_record_preview_3x3_training_knockout'
  and has_function_privilege('authenticated',p.oid,'execute'))
 then raise exception 'Trigger function accidentally callable by a client';end if;
 if (select count(*) from pg_trigger
 where tgrelid='public.chaotic_preview_3x3_hp_wallets'::regclass
   and tgname='chaotic_preview_3x3_training_knockout_after_hp'
   and tgenabled='O' and not tgisinternal)<>1
 then raise exception 'Training KO trigger missing';end if;
 select lower(regexp_replace(pg_get_functiondef(
 'public.chaotic_record_preview_3x3_training_knockout()'::regprocedure),
 '[[:space:]]+','','g')) into fn;
 if position('actoruuid:=auth.uid()' in fn)=0
 or position('m.current_playerisdistinctfromactor' in fn)=0
 or position('w.status<>''defender_passed_preview''' in fn)=0
 or position('paid.catalog_attack_id<>''105''' in fn)=0
 or position('paid.training_damage_applied' in fn)=0
 or position('old.hp_remaining-5' in fn)=0
 or position('new.damage_eventsisdistinctfromold.damage_events+1' in fn)=0
 or position('chaotic_preview_3x3_training_knockouts' in fn)=0
 or position('ifn=3anddead_count=3then' in fn)=0
 or position('chaotic_preview_3x3_training_outcomes' in fn)=0
 then raise exception 'KO guard or exact three-creature win condition missing';end if;
 if exists(select 1 from public.chaotic_preview_3x3_training_knockouts
 where hp_after<>0 or not training_only or official_hp_changed or official_match_modified)
 or exists(select 1 from public.chaotic_preview_3x3_training_outcomes
 where defeated_team_size<>3 or outcome_scope<>'training_only_no_official_victory'
  or official_match_ended or official_match_modified
  or experience_awarded or currency_awarded)
 then raise exception 'Official result or rewards were unexpectedly changed';end if;
 if (select count(*) from pg_publication_tables
 where pubname='supabase_realtime' and schemaname='public'
  and tablename in ('chaotic_preview_3x3_training_knockouts',
   'chaotic_preview_3x3_training_outcomes'))<>2
 then raise exception 'KO/outcome live synchronization missing';end if;
end $verify$;
rollback;
select 'PASS v0.1.47: automatic knockout trigger, 3-HP-zero preview outcome, RLS, no official effects' as result;