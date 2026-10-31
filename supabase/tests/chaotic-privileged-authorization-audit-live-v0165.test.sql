-- Chaotic GO v0.1.65 — read-only authorization regression.
-- Execute against the configured Supabase project with no production mutations.
begin;
do $audit$
declare
  leaked integer;
  no_uid integer;
  broken integer;
  t text;
begin
  select count(*) into leaked
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname like 'chaotic_%'
    and p.prosecdef and has_function_privilege('anon',p.oid,'execute');
  if leaked<>0 then
    raise exception 'SECURITY: % exposed privileged Chaotic RPCs callable by anon',leaked;
  end if;
  -- A textual check is defense-in-depth, not a proof of correct authorization.
  select count(*) into no_uid
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname like 'chaotic_%'
    and p.prosecdef and has_function_privilege('authenticated',p.oid,'execute')
    and position('auth.uid()' in pg_get_functiondef(p.oid))=0;
  if no_uid<>0 then
    raise exception 'SECURITY: % privileged RPCs lack visible auth.uid() check',no_uid;
  end if;
  for t in select unnest(array[
    'chaotic_preview_3x3_creature_element_checks',
    'chaotic_preview_3x3_dynamic_element_checks',
    'chaotic_preview_3x3_element_catalog',
    'chaotic_preview_3x3_equipment_catalog',
    'chaotic_preview_3x3_player_presence',
    'chaotic_preview_card_reference',
    'chaotic_preview_mugic_token_catalog'
  ]) loop
    if not (select c.relrowsecurity from pg_class c
      where c.oid=('public.'||t)::regclass)
      or has_table_privilege('anon',('public.'||t)::regclass,'select')
      or has_table_privilege('authenticated',('public.'||t)::regclass,'select')
      or exists(select 1 from pg_policies where schemaname='public' and tablename=t)
    then raise exception 'SECURITY: internal reference/presence table not private: %',t;
    end if;
  end loop;
  if has_function_privilege('anon','public.chaotic_ping_preview_3x3_player(uuid,boolean)','execute')
    or not has_function_privilege('authenticated','public.chaotic_ping_preview_3x3_player(uuid,boolean)','execute')
    or position('both_synced_current_turn' in
       pg_get_functiondef('public.chaotic_ping_preview_3x3_player(uuid,boolean)'::regprocedure))=0
  then raise exception 'SECURITY: two-player per-turn diagnostic permissions changed';
  end if;
end $audit$;
rollback;
select 'PASS v0.1.65: anonymous RPC access closed, seven internal tables private, member-only turn synchronization' as result;