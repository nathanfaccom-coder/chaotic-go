begin;
do $audit$
declare f text; key text;
begin
 if not(select relrowsecurity from pg_class
   where oid='public.chaotic_preview_3x3_player_presence'::regclass)
 or has_table_privilege('authenticated','public.chaotic_preview_3x3_player_presence','select')
 or has_table_privilege('authenticated','public.chaotic_preview_3x3_player_presence','insert')
 or has_table_privilege('authenticated','public.chaotic_preview_3x3_player_presence','update')
 or has_table_privilege('anon','public.chaotic_preview_3x3_player_presence','select')
 then raise exception 'PvP presence is writable or visible directly by untrusted clients';end if;
 if has_function_privilege('anon',
    'public.chaotic_ping_preview_3x3_player(uuid,boolean)','execute')
 or not has_function_privilege('authenticated',
    'public.chaotic_ping_preview_3x3_player(uuid,boolean)','execute')
 then raise exception 'PvP RPC permissions unsafe';end if;
 select lower(regexp_replace(pg_get_functiondef(
  'public.chaotic_ping_preview_3x3_player(uuid,boolean)'::regprocedure),
  '[[:space:]]+','','g')) into f;
 foreach key in array array[
 'actoruuid:=auth.uid()',
 'actornotin(lobby.host_id,lobby.guest_id)',
 'lobby.mode<>''3x3''',
 'lobby.expires_at<=current_stamp',
 'fresh_cutofftimestamptz:=statement_timestamp()-interval''25seconds''',
 'last_seen_at>=fresh_cutoff',
 'last_seen_turn=excluded.last_seen_turn',
 'coalesce(self_present,false)andcoalesce(peer_present,false)',
 'training_only'',true',
 'official_match_modified'',false'
 ] loop if position(key in f)=0
 then raise exception 'Missing server membership/readiness guard: %',key;end if;
 end loop;
 if exists(select 1 from pg_publication_tables where pubname='supabase_realtime'
 and schemaname='public' and tablename='chaotic_preview_3x3_player_presence')
 then raise exception 'Private presence published on realtime';end if;
end $audit$;
rollback;
select 'PASS v0.1.61: actor-only heartbeat, 25-second freshness, no client table access, training-only' result;