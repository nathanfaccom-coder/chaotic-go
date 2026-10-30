-- Chaotic GO 0.1.12: server-shuffled experimental attack deck, private unrevealed order.
-- Existing preview hands (if present) retain their original order. No album, deck,
-- official battle, points or card models are modified.
alter table public.chaotic_preview_attack_wallets
  add column if not exists total_cards smallint not null default 0
    check (total_cards between 0 and 20);
update public.chaotic_preview_attack_wallets w
 set total_cards=(select count(*) from public.chaotic_preview_attack_hand h
  where h.lobby_id=w.lobby_id and h.actor_id=w.actor_id)
 where total_cards=0;
alter table public.chaotic_preview_attack_hand
  add column if not exists draw_position smallint
    check (draw_position between 1 and 20);
update public.chaotic_preview_attack_hand
  set draw_position=card_slot where draw_position is null;
alter table public.chaotic_preview_attack_hand
  alter column draw_position set not null;
create unique index if not exists chaotic_preview_draw_position_unique
 on public.chaotic_preview_attack_hand(lobby_id,actor_id,draw_position);

drop policy if exists chaotic_preview_hand_own on public.chaotic_preview_attack_hand;
create policy chaotic_preview_hand_own on public.chaotic_preview_attack_hand
 for select to authenticated
 using (actor_id=(select auth.uid()) and card_state in ('hand','spent'));

create or replace function public.chaotic_prepare_preview_hand(
 p_lobby_id uuid,p_expected_turn integer
) returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 player public.chaotic_preview_loadouts;
 deck jsonb;
 album jsonb;
 cards jsonb;
 c record;
 count_cards integer:=0;
 matched integer;
begin
 if actor is null then raise exception 'Faça login'; end if;
 select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id for update;
 if not found or p_expected_turn is null or p_expected_turn<>m.turn_no
   or m.status<>'active' or m.current_player<>actor
   or actor not in (m.host_id,m.guest_id) then
   raise exception 'Partida ou turno não autorizado'; end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.mode<>'1x1' or l.status<>'ready' or l.expires_at<=now()
   or l.host_id<>m.host_id or l.guest_id is distinct from m.guest_id then
   raise exception 'Sala 1x1 não está pronta'; end if;
 select * into player from public.chaotic_preview_loadouts
  where lobby_id=p_lobby_id and actor_id=actor;
 if not found then raise exception 'Prepare a criatura antes da mão de teste';end if;
 if exists(select 1 from public.chaotic_preview_attack_wallets
  where lobby_id=p_lobby_id and actor_id=actor) then
  raise exception 'Mão já preparada nesta partida';end if;
 select data into deck from public.chaotic_game_nodes
  where user_id=actor and node_path in (
   'decks/1x1_slot_'||player.deck_slot::text,
   'decks/1x1_'||player.deck_slot::text)
  order by (node_path='decks/1x1_slot_'||player.deck_slot::text) desc limit 1;
 if deck is null or jsonb_typeof(deck->'ataques')<>'array'
   or jsonb_array_length(deck->'ataques')>20 then
   raise exception 'Deck não contém uma lista de até 20 ataques';end if;
 select data into album from public.chaotic_game_nodes
  where user_id=actor and node_path='album';
 if jsonb_typeof(album)='array' then cards:=album;
 elsif jsonb_typeof(album)='object' then
   select coalesce(jsonb_agg(e.value),'[]'::jsonb) into cards from jsonb_each(album) e;
 else raise exception 'Álbum não encontrado';end if;

 -- Validate each listed instance before snapshotting, not just the chosen attack.
 for c in
  select e.val as card_id,e.idx::integer as slot
    from jsonb_array_elements_text(deck->'ataques') with ordinality as e(val,idx)
    where e.val is not null and e.val<>'' and e.val<>'null'
    order by e.idx
 loop
  if length(c.card_id)>48 then raise exception 'Identificador inválido no deck';end if;
  select count(*) into matched from jsonb_array_elements(cards) e(card)
    where e.card->>'id'=c.card_id and e.card->>'tipoCarta'='Ataque';
  if matched<>1 then raise exception 'Ataque não é único no álbum: %',c.card_id;end if;
  count_cards:=count_cards+1;
 end loop;
 if count_cards<3 then raise exception 'O deck precisa conter pelo menos 3 ataques distintos';end if;
 insert into public.chaotic_preview_attack_wallets
  (lobby_id,actor_id,deck_slot,prepared_turn,last_draw_turn,total_cards)
 values(p_lobby_id,actor,player.deck_slot,p_expected_turn,p_expected_turn,count_cards);

 for c in
  select e.val as card_id,e.idx::integer as slot,
         row_number() over(order by pg_catalog.gen_random_uuid())::integer as shuffled_slot
   from jsonb_array_elements_text(deck->'ataques') with ordinality as e(val,idx)
   where e.val is not null and e.val<>'' and e.val<>'null'
   order by shuffled_slot
 loop
  insert into public.chaotic_preview_attack_hand
   (lobby_id,actor_id,card_slot,attack_instance_id,draw_position,card_state)
  values(p_lobby_id,actor,c.slot,c.card_id,c.shuffled_slot,
   case when c.shuffled_slot<=3 then 'hand' else 'deck' end);
 end loop;
 return jsonb_build_object('cards_in_hand',3,'cards_in_deck',count_cards-3,
  'points',3,'state','shuffled_on_server');
end;
$fn$;


create or replace function public.chaotic_sync_preview_hand(
 p_lobby_id uuid,p_expected_turn integer
) returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 wallet public.chaotic_preview_attack_wallets;
 next_card record;
 n_hand integer;
 points integer;
 drawn boolean:=false;
begin
 if actor is null then raise exception 'Faça login';end if;
 select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id for update;
 if not found or p_expected_turn is null or m.status<>'active' or
  m.current_player<>actor or m.turn_no<>p_expected_turn
  or actor not in(m.host_id,m.guest_id) then raise exception 'Turno não autorizado';end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.mode<>'1x1' or l.status<>'ready' or l.expires_at<=now() then
  raise exception 'Sala indisponível';end if;
 select * into wallet from public.chaotic_preview_attack_wallets
  where lobby_id=p_lobby_id and actor_id=actor;
 if not found then raise exception 'Prepare a mão de teste primeiro';end if;
 points:=public.chaotic_preview_points_available(
  p_expected_turn,wallet.prepared_turn,wallet.spent_points);
 if wallet.last_draw_turn>p_expected_turn then raise exception 'Turno antigo';end if;
 if wallet.last_draw_turn<p_expected_turn then
   select count(*) into n_hand from public.chaotic_preview_attack_hand
     where lobby_id=p_lobby_id and actor_id=actor and card_state='hand';
   if n_hand<5 then
     select card_slot,attack_instance_id into next_card
       from public.chaotic_preview_attack_hand
       where lobby_id=p_lobby_id and actor_id=actor and card_state='deck'
       order by draw_position limit 1;
     if found then
       update public.chaotic_preview_attack_hand set card_state='hand'
        where lobby_id=p_lobby_id and actor_id=actor and card_slot=next_card.card_slot;
       drawn:=true;
     end if;
   end if;
   update public.chaotic_preview_attack_wallets set last_draw_turn=p_expected_turn
    where lobby_id=p_lobby_id and actor_id=actor;
 end if;
 return jsonb_build_object('available_points',points,'drew_card',drawn,'synced_turn',p_expected_turn);
end;
$fn$;


revoke all on function public.chaotic_prepare_preview_hand(uuid,integer)
 from public,anon,authenticated;
revoke all on function public.chaotic_sync_preview_hand(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_prepare_preview_hand(uuid,integer) to authenticated;
grant execute on function public.chaotic_sync_preview_hand(uuid,integer) to authenticated;
