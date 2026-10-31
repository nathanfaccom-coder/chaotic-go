-- 0.1.11: no real accounts, matches or cards needed; all checks are read-only.
begin;
do $$
declare
 n integer;
begin
 n:=public.chaotic_preview_points_available(1,1,0);
 if n<>3 then raise exception 'Starting balance should be 3, got %',n;end if;
 n:=public.chaotic_preview_points_available(3,1,1);
 if n<>3 then raise exception 'Spent 1 after turn 3 should be 3, got %',n;end if;
 n:=public.chaotic_preview_points_available(5,1,1);
 if n<>4 then raise exception 'Next turn should earn 1 point, got %',n;end if;
 begin
   perform public.chaotic_preview_points_available(4,1,0);
   raise exception 'An opponent turn must fail';
 exception when raise_exception then
   if sqlerrm='An opponent turn must fail' then raise;end if;
 end;
 if not (select relrowsecurity from pg_class
   where oid='public.chaotic_preview_attack_wallets'::regclass) then
   raise exception 'Wallet RLS disabled';end if;
 if not (select relrowsecurity from pg_class
   where oid='public.chaotic_preview_attack_hand'::regclass) then
   raise exception 'Hand RLS disabled';end if;
 if has_table_privilege('authenticated','public.chaotic_preview_attack_wallets','insert')
  or has_table_privilege('authenticated','public.chaotic_preview_attack_wallets','update')
  or has_table_privilege('authenticated','public.chaotic_preview_attack_wallets','delete')
  or has_table_privilege('authenticated','public.chaotic_preview_attack_hand','insert')
  or has_table_privilege('authenticated','public.chaotic_preview_attack_hand','update')
  or has_table_privilege('authenticated','public.chaotic_preview_attack_hand','delete')
 then raise exception 'Direct writes should be blocked';end if;
 if has_function_privilege('anon','public.chaotic_prepare_preview_hand(uuid,integer)','execute')
  or has_function_privilege('anon','public.chaotic_sync_preview_hand(uuid,integer)','execute')
  or has_function_privilege('anon','public.chaotic_spend_preview_attack(uuid,integer)','execute')
 then raise exception 'Anonymous calls should not work';end if;
 if not has_function_privilege('authenticated','public.chaotic_spend_preview_attack(uuid,integer)','execute')
 then raise exception 'Authenticated members need RPC entrypoint';end if;
end $$;
rollback;
select 'PASS: points by turn, input checks, RLS, RPC permissions, no data changed' as result;