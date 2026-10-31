-- Chaotic GO v0.1.59: Alakazaz-only transfer history must not reveal
-- a facedown donor by event existence or changed timestamps.
begin;
do $audit$
declare f text;
begin
 select lower(regexp_replace(pg_get_functiondef(
 'public.chaotic_get_preview_3x3_safe_state(uuid)'::regprocedure),
 '[[:space:]]+','','g')) into f;
 if position('actornotin(host_user,guest_user)' in f)=0
 or position('wheret.actor_id=actororcoalesce(fd.face_up,false)' in f)=0
 or position('coalesce(fd.face_up,false)andcoalesce(fr.face_up,false)' in f)=0
 or position('''donor_creature_instance_id'',null' in f)=0
 or position('''receiver_creature_instance_id'',null' in f)=0
 or position('''created_at'',null,''updated_at'',null' in f)=0
 then raise exception 'Alakazaz transfer secrecy or actor gating missing';end if;
 if has_function_privilege('anon',
 'public.chaotic_get_preview_3x3_safe_state(uuid)','execute')
 or not has_function_privilege('authenticated',
 'public.chaotic_get_preview_3x3_safe_state(uuid)','execute')
 then raise exception 'Unsafe RPC execution grant';end if;
 if has_table_privilege('anon','public.chaotic_preview_3x3_token_transfers','select')
 then raise exception 'Anonymous can read Alakazaz events';end if;
 if exists(select 1 from pg_policies where schemaname='public'
 and tablename='chaotic_preview_3x3_token_transfers' and cmd='SELECT'
 and position('actor_id' in qual)=0)
 then raise exception 'Non-owner can read transfer through RLS';end if;
 if exists(select 1 from pg_publication_tables
 where pubname='supabase_realtime' and schemaname='public'
 and tablename='chaotic_preview_3x3_token_transfers')
 then raise exception 'Alakazaz events published through Realtime';end if;
end $audit$;
rollback;
select 'PASS v0.1.59: private Alakazaz event-existence, facedown metadata and owner-only RLS' as result;