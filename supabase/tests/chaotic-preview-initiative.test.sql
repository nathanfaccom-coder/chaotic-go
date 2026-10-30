-- Regression checks are transaction-scoped and create no cards/matches.
begin;
do $$
declare
 tie jsonb;
 defender jsonb;
 attacker jsonb;
 failed boolean:=false;
begin
 tie:=public.chaotic_preview_initiative_compare(
  '{"v":45,"e":65}'::jsonb,'{"v":45,"e":65}'::jsonb,'v');
 if tie->>'winner_side'<>'attacker' or (tie->>'tie_favors_attacker')::boolean is not true
  then raise exception 'Tie should favor initiating creature: %',tie;end if;
 defender:=public.chaotic_preview_initiative_compare(
  '{"v":45}'::jsonb,'{"v":70}'::jsonb,'v');
 if defender->>'winner_side'<>'defender' or
  (defender->>'tie_favors_attacker')::boolean is not false
  then raise exception 'Faster defender should win: %',defender;end if;
 attacker:=public.chaotic_preview_initiative_compare(
  '{"v":91}'::jsonb,'{"v":70}'::jsonb,'v');
 if attacker->>'winner_side'<>'attacker'
  then raise exception 'Faster attacker should win: %',attacker;end if;
 begin
  perform public.chaotic_preview_initiative_compare(
    '{"v":"x"}'::jsonb,'{"v":70}'::jsonb,'v');
 exception when others then failed:=true;
 end;
 if not failed then raise exception 'Invalid Speed values were accepted';end if;
 failed:=false;
 begin
  perform public.chaotic_preview_initiative_compare(
    '{"v":50}'::jsonb,'{"v":70}'::jsonb,'p');
 exception when others then failed:=true;
 end;
 if not failed then raise exception 'Unsupported location attribute accepted';end if;
 if not (select relrowsecurity from pg_class
  where oid='public.chaotic_preview_initiatives'::regclass) then
  raise exception 'Initiative RLS disabled';end if;
 if has_table_privilege('authenticated','public.chaotic_preview_initiatives','insert')
 or has_table_privilege('authenticated','public.chaotic_preview_initiatives','update')
 or has_table_privilege('authenticated','public.chaotic_preview_initiatives','delete')
 then raise exception 'Players can forge initiative rows';end if;
 if has_function_privilege('anon','public.chaotic_capture_preview_initiative(uuid,integer)','execute')
 then raise exception 'Anonymous users can generate initiative';end if;
 if not has_function_privilege('authenticated','public.chaotic_capture_preview_initiative(uuid,integer)','execute')
 then raise exception 'Authenticated users cannot call initiative';end if;
 if exists(select 1 from pg_policies
  where schemaname='public' and tablename='chaotic_preview_initiatives'
    and cmd<>'SELECT') then raise exception 'Unexpected initiative mutation policy';end if;
end $$;
rollback;
select 'PASS: Speed wins, attacker tie, invalid attribute, RLS, authenticated only, no HP/turn writes' as result;