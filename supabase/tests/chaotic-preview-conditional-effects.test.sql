-- 0.1.17: transactional verification of conditional status mappings.
begin;
do $$
declare
 vine jsonb;
 hack jsonb;
 punch jsonb;
 invalid jsonb;
 n integer;
begin
 vine:=public.chaotic_preview_effect_spec('107',5,'partial_estimate');
 if (vine->>'eligible')::boolean is not true
   or vine->>'code'<>'vine_skip'
   or vine->>'scope'<>'full_turn_no_draw_no_points'
   or (vine->>'target_turns')::integer<>1
   or (vine->>'applies_now')::boolean is not false then
    raise exception 'Vinha mapping unsafe %',vine;end if;
 hack:=public.chaotic_preview_effect_spec('111',10,'partial_estimate');
 if hack->>'code'<>'electronic_attack_lock'
   or hack->>'scope'<>'attack_only'
   or (hack->>'target_turns')::integer<>2 then
   raise exception 'Mão Eletrônica mapping unsafe %',hack;end if;
 punch:=public.chaotic_preview_effect_spec('112',5,'partial_estimate');
 if punch->>'code'<>'hand_attack_lock'
   or punch->>'scope'<>'attack_only'
   or (punch->>'target_turns')::integer<>1 then
   raise exception 'Mão Mão mapping unsafe %',punch;end if;
 invalid:=public.chaotic_preview_effect_spec('107',0,'partial_estimate');
 if (invalid->>'eligible')::boolean is not false then
   raise exception 'Zero damage triggered a Vinha effect';end if;
 invalid:=public.chaotic_preview_effect_spec('111',null,'special_resolution_required');
 if (invalid->>'eligible')::boolean is not false then
   raise exception 'Unknown final damage triggered a lock';end if;
 invalid:=public.chaotic_preview_effect_spec('112',5,'special_resolution_required');
 if (invalid->>'eligible')::boolean is not false then
   raise exception 'Unresolved damage was treated as final';end if;
 invalid:=public.chaotic_preview_effect_spec('105',20,'partial_estimate');
 if (invalid->>'eligible')::boolean is not false then
   raise exception 'Unrelated attack triggered a lock';end if;
 if not (select relrowsecurity from pg_class
   where oid='public.chaotic_preview_effect_candidates'::regclass)
 then raise exception 'Effect candidate RLS disabled';end if;
 if has_table_privilege('authenticated','public.chaotic_preview_effect_candidates','insert')
   or has_table_privilege('authenticated','public.chaotic_preview_effect_candidates','update')
   or has_table_privilege('authenticated','public.chaotic_preview_effect_candidates','delete')
 then raise exception 'Clients can forge or activate effect candidates';end if;
 if has_function_privilege('anon','public.chaotic_capture_preview_effect_candidate(uuid,integer)','execute')
 then raise exception 'Anonymous users can register candidate';end if;
 if not has_function_privilege('authenticated','public.chaotic_capture_preview_effect_candidate(uuid,integer)','execute')
 then raise exception 'Authenticated user cannot run allowed RPC';end if;
 if not has_table_privilege('authenticated','public.chaotic_preview_effect_candidates','select')
 then raise exception 'Authorized readers lack table select';end if;
 if not exists(select 1 from pg_policies
   where schemaname='public' and tablename='chaotic_preview_effect_candidates'
   and cmd='SELECT') then raise exception 'RLS read policy missing';end if;
 select count(*) into n from public.chaotic_preview_effect_candidates
   where applied_to_match<>false;
 if n<>0 then raise exception 'Found applied candidate';end if;
end $$;
rollback;
select 'PASS: Vinha 1 turn, Electronic 2, Mão Mão 1, zero/unknown rejected, RLS, no live status' as result;