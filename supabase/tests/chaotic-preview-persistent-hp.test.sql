-- Chaotic GO 0.1.18: test pure HP maths, schema, private RLS, and immutable
-- safety markers. No real users, matches or HP are modified.
begin;
do $$
declare v integer;
begin
 v:=public.chaotic_preview_hp_seed('{"e":65}'::jsonb,'Azul',501);
 if v<>75 then raise exception 'Kiru Azul should start 75: %',v;end if;
 v:=public.chaotic_preview_hp_seed('{"e":65}'::jsonb,'Vermelho',501);
 if v<>65 then raise exception 'Kiru must not boost Vermelho: %',v;end if;
 v:=public.chaotic_preview_hp_seed('{"e":500}'::jsonb,'Azul',501);
 if v<>510 then raise exception '500+10 overflow/preview cap: %',v;end if;
 v:=public.chaotic_preview_hp_seed('{"e":65}'::jsonb,'Azul',502);
 if v<>65 then raise exception 'Tunnel cannot boost energy: %',v;end if;
 v:=public.chaotic_preview_hp_remainder(75,6);
 if v<>69 then raise exception 'HP remaining after 6: %',v;end if;
 v:=public.chaotic_preview_hp_remainder(69,8);
 if v<>61 then raise exception 'Accumulating second damage: %',v;end if;
 v:=public.chaotic_preview_hp_remainder(10,50);
 if v<>0 then raise exception 'Overkill must clamp to zero';end if;
 v:=public.chaotic_preview_hp_remainder(61,0);
 if v<>61 then raise exception 'Zero damage cannot change energy';end if;
 begin
   perform public.chaotic_preview_hp_seed('{"e":"invalid"}'::jsonb,'Azul',501);
   raise exception 'Incorrect creature energy accepted';
 exception when raise_exception then
   if sqlerrm='Incorrect creature energy accepted' then raise;end if;
 end;
 begin
   perform public.chaotic_preview_hp_remainder(55,-1);
   raise exception 'Negative damage was accepted';
 exception when raise_exception then
   if sqlerrm='Negative damage was accepted' then raise;end if;
 end;
 if not (select relrowsecurity from pg_class
   where oid='public.chaotic_preview_hp_wallets'::regclass)
   or not (select relrowsecurity from pg_class
   where oid='public.chaotic_preview_hp_events'::regclass)
 then raise exception 'HP RLS must be enabled';end if;
 if has_table_privilege('authenticated','public.chaotic_preview_hp_wallets','insert')
  or has_table_privilege('authenticated','public.chaotic_preview_hp_wallets','update')
  or has_table_privilege('authenticated','public.chaotic_preview_hp_wallets','delete')
  or has_table_privilege('authenticated','public.chaotic_preview_hp_events','insert')
  or has_table_privilege('authenticated','public.chaotic_preview_hp_events','update')
 then raise exception 'Clients can forge test HP';end if;
 if has_function_privilege('anon','public.chaotic_prepare_preview_hp(uuid,integer)','execute')
  or has_function_privilege('anon','public.chaotic_apply_preview_hp_projection(uuid,integer)','execute')
 then raise exception 'Anonymous HP RPC access';end if;
 if not has_function_privilege('authenticated','public.chaotic_apply_preview_hp_projection(uuid,integer)','execute')
 then raise exception 'Signed-in players cannot use HP preview RPC';end if;
 if exists(select 1 from pg_policies
  where schemaname='public' and tablename in('chaotic_preview_hp_wallets','chaotic_preview_hp_events')
  and cmd<>'SELECT') then raise exception 'Found HP mutation policy';end if;
end $$;
rollback;
select 'PASS: Kiru seed, multi-turn cumulative loss, overkill, bad data, RLS, RPC roles and no official HP' as result;