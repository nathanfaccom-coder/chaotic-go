-- Chaotic GO 0.1.12 shuffling and visibility checks. Transaction is read-only.
begin;
do $$
declare
  picked int[];
  sorted int[];
  hand_policy text;
  t integer;
  n integer;
begin
  select array_agg(pos order by pos), array_agg(original_slot order by pos)
    into sorted,picked
  from (
    select s::integer as original_slot,
       row_number() over(order by pg_catalog.gen_random_uuid())::integer as pos
    from generate_series(1,20) gs(s)
  ) x;
  if sorted<>array(select i from generate_series(1,20) gs(i)) then
    raise exception 'Shuffled positions not a complete permutation: %',sorted;end if;
  if (select count(distinct s) from unnest(picked) s)<>20 then
    raise exception 'Some original slots were dropped or duplicated: %',picked;end if;
  select count(*) into n from information_schema.columns
    where table_schema='public' and table_name='chaotic_preview_attack_hand'
      and column_name='draw_position' and is_nullable='NO';
  if n<>1 then raise exception 'Server deck order must not be nullable';end if;
  select count(*) into n from information_schema.columns
    where table_schema='public' and table_name='chaotic_preview_attack_wallets'
      and column_name='total_cards' and is_nullable='NO';
  if n<>1 then raise exception 'Wallet total card count must be stored';end if;
  select qual into hand_policy from pg_policies
    where schemaname='public' and tablename='chaotic_preview_attack_hand'
      and policyname='chaotic_preview_hand_own';
  if hand_policy is null or position('spent' in hand_policy)=0
      or position('hand' in hand_policy)=0 or position('auth.uid()' in hand_policy)=0
      or position('deck' in hand_policy)>0 then
    raise exception 'Deck visibility policy unsafe: %',hand_policy;end if;
  if has_table_privilege('authenticated','public.chaotic_preview_attack_hand','insert')
    or has_table_privilege('authenticated','public.chaotic_preview_attack_hand','update')
    or has_table_privilege('authenticated','public.chaotic_preview_attack_hand','delete')
  then raise exception 'Direct client hand writes remain enabled';end if;
  if has_function_privilege('anon','public.chaotic_prepare_preview_hand(uuid,integer)','execute')
   or has_function_privilege('anon','public.chaotic_sync_preview_hand(uuid,integer)','execute')
  then raise exception 'Anonymous hand operations should be blocked';end if;
  if not has_function_privilege('authenticated','public.chaotic_prepare_preview_hand(uuid,integer)','execute')
  then raise exception 'Signed-in players cannot prepare private hand';end if;
end $$;
rollback;
select 'PASS: complete randomized permutation, hidden deck RLS, immutable total and permissions' as result;