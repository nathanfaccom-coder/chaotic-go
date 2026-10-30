begin;
do $$
declare
 pol text;
 n integer;
begin
 select count(*) into n from information_schema.columns
 where table_schema='public' and table_name='chaotic_preview_attack_hand'
 and column_name in ('spent_reason','draw_cycle','recycle_priority');
 if n<>3 then raise exception 'Three recycle fields missing: %',n;end if;
 select count(*) into n from information_schema.columns
 where table_schema='public' and table_name='chaotic_preview_attack_wallets'
 and column_name='recycle_cycles';
 if n<>1 then raise exception 'Recycle counter missing';end if;
 if not (select relrowsecurity from pg_class
  where oid='public.chaotic_preview_attack_hand'::regclass)
 then raise exception 'Hand RLS disabled';end if;
 select qual into pol from pg_policies
  where schemaname='public' and tablename='chaotic_preview_attack_hand'
  and policyname='chaotic_preview_hand_own';
 if pol is null or position('auth.uid()' in pol)=0 or position('spent' in pol)=0
 or position('deck' in pol)>0 then raise exception 'RLS leaks deck: %',pol;end if;
 if has_table_privilege('authenticated','public.chaotic_preview_attack_hand','insert')
 or has_table_privilege('authenticated','public.chaotic_preview_attack_hand','update')
 or has_table_privilege('authenticated','public.chaotic_preview_attack_hand','delete')
 then raise exception 'Client can write card states';end if;
 if has_function_privilege('anon','public.chaotic_discard_preview_attack(uuid,integer,smallint)','execute')
 then raise exception 'Anon can discard';end if;
 if not has_function_privilege('authenticated','public.chaotic_discard_preview_attack(uuid,integer,smallint)','execute')
 then raise exception 'Signed-in player cannot discard';end if;
 select count(*) into n from pg_get_functiondef(
  'public.chaotic_calculate_individual_preview(uuid,integer)'::regprocedure
 ) as fn(t) where fn.t like '%spent_reason=''attack''%';
 if n<>1 then raise exception 'Discard can falsely authorize damage';end if;
 select count(*) into n from pg_get_functiondef(
  'public.chaotic_sync_preview_hand(uuid,integer)'::regprocedure
 ) as fn(t) where fn.t like '%recycle_cycles%' and fn.t like '%gen_random_uuid%';
 if n<>1 then raise exception 'Recycler is not server-shuffled';end if;
end $$;
rollback;
select 'PASS: recycle fields, authenticated discard, hidden pile, no direct write, paid-attack guard' as result;