-- Chaotic GO 0.1.11: SERVER-OWNED PREVIEW hand and attack points for 1x1 only.
-- Deterministic deck slots, NOT randomized official draws. No modification to real battle or album.
-- Player's existing album remains writable: this preview is NOT competitive anti-cheat.

create table if not exists public.chaotic_preview_attack_wallets (
 lobby_id uuid not null references public.chaotic_match_turns(lobby_id) on delete cascade,
 actor_id uuid not null references auth.users(id) on delete cascade,
 deck_slot smallint not null check(deck_slot between 1 and 3),
 prepared_turn integer not null check(prepared_turn between 1 and 120),
 last_draw_turn integer not null check(last_draw_turn between 1 and 120),
 spent_points integer not null default 0 check(spent_points between 0 and 300),
 created_at timestamptz not null default now(),
 primary key(lobby_id,actor_id)
);
create table if not exists public.chaotic_preview_attack_hand (
 lobby_id uuid not null,
 actor_id uuid not null,
 card_slot smallint not null check(card_slot between 1 and 20),
 attack_instance_id text not null check(length(attack_instance_id) between 1 and 48),
 card_state text not null default 'deck' check(card_state in ('deck','hand','spent')),
 spent_turn integer check(spent_turn between 1 and 120),
 primary key(lobby_id,actor_id,card_slot),
 unique(lobby_id,actor_id,attack_instance_id),
 foreign key(lobby_id,actor_id)
  references public.chaotic_preview_attack_wallets(lobby_id,actor_id) on delete cascade,
 check ((card_state='spent')=(spent_turn is not null))
);

alter table public.chaotic_preview_attack_wallets enable row level security;
alter table public.chaotic_preview_attack_hand enable row level security;
revoke all on public.chaotic_preview_attack_wallets,public.chaotic_preview_attack_hand
 from public,anon,authenticated;
grant select on public.chaotic_preview_attack_wallets,public.chaotic_preview_attack_hand to authenticated;

drop policy if exists chaotic_preview_wallet_own on public.chaotic_preview_attack_wallets;
create policy chaotic_preview_wallet_own on public.chaotic_preview_attack_wallets
 for select to authenticated using (actor_id=(select auth.uid()));
drop policy if exists chaotic_preview_hand_own on public.chaotic_preview_attack_hand;
create policy chaotic_preview_hand_own on public.chaotic_preview_attack_hand
 for select to authenticated using (actor_id=(select auth.uid()));

-- Server-only math, not a finalized turn and initiative rule.
create or replace function public.chaotic_preview_points_available(
 p_turn integer,p_prepared_turn integer,p_spent integer
) returns integer language plpgsql immutable security invoker set search_path=''
as $fn$
begin
 if p_turn is null or p_prepared_turn is null or p_spent is null
    or p_prepared_turn not between 1 and 120
    or p_turn not between p_prepared_turn and 120
    or (p_turn-p_prepared_turn)%2<>0
    or p_spent<0 then
  raise exception 'Turnos ou saldo inválidos'; end if;
 return 3+((p_turn-p_prepared_turn)/2)-p_spent;
end;
$fn$;
revoke all on function public.chaotic_preview_points_available(integer,integer,integer)
 from public,anon,authenticated;

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
 hand_count integer:=0;
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
  (lobby_id,actor_id,deck_slot,prepared_turn,last_draw_turn)
 values(p_lobby_id,actor,player.deck_slot,p_expected_turn,p_expected_turn);

 for c in
  select e.val as card_id,e.idx::integer as slot
   from jsonb_array_elements_text(deck->'ataques') with ordinality as e(val,idx)
   where e.val is not null and e.val<>'' and e.val<>'null'
   order by e.idx
 loop
  hand_count:=hand_count+1;
  insert into public.chaotic_preview_attack_hand
   (lobby_id,actor_id,card_slot,attack_instance_id,card_state)
  values(p_lobby_id,actor,c.slot,c.card_id,
   case when hand_count<=3 then 'hand' else 'deck' end);
 end loop;
 return jsonb_build_object('cards_in_hand',3,'cards_in_deck',count_cards-3,
  'points',3,'state','prepared');
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
       order by card_slot limit 1;
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

create or replace function public.chaotic_spend_preview_attack(
 p_lobby_id uuid,p_expected_turn integer
) returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 wallet public.chaotic_preview_attack_wallets;
 attack public.chaotic_preview_attack_instances;
 hand public.chaotic_preview_attack_hand;
 available integer;
begin
 if actor is null then raise exception 'Faça login';end if;
 select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id for update;
 if not found or p_expected_turn is null or m.status<>'active'
   or m.turn_no<>p_expected_turn or m.current_player<>actor
   or actor not in (m.host_id,m.guest_id) then
   raise exception 'Turno não autorizado';end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.mode<>'1x1' or l.status<>'ready' or l.expires_at<=now() then
   raise exception 'Sala indisponível';end if;
 select * into wallet from public.chaotic_preview_attack_wallets
   where lobby_id=p_lobby_id and actor_id=actor;
 if not found or wallet.last_draw_turn<>p_expected_turn then
   raise exception 'Sincronize sua mão no turno atual';end if;
 select * into attack from public.chaotic_preview_attack_instances
   where lobby_id=p_lobby_id and turn_no=p_expected_turn and actor_id=actor;
 if not found then raise exception 'Valide a carta individual antes de gastar';end if;
 select * into hand from public.chaotic_preview_attack_hand
   where lobby_id=p_lobby_id and actor_id=actor and card_slot=attack.card_slot;
 if not found or hand.attack_instance_id<>attack.attack_instance_id
   or hand.card_state<>'hand' then
   raise exception 'Ataque não está disponível na mão de teste';end if;
 if not exists(select 1 from public.chaotic_preview_clashes
   where lobby_id=p_lobby_id and turn_no=p_expected_turn and attacker_id=actor
    and attack_card=attack.attack_instance_id) then
   raise exception 'Registre o confronto antes de gastar pontos';end if;
 available:=public.chaotic_preview_points_available(
  p_expected_turn,wallet.prepared_turn,wallet.spent_points);
 if available<attack.attack_cost then raise exception 'Pontos de ataque insuficientes';end if;

 update public.chaotic_preview_attack_hand set card_state='spent',spent_turn=p_expected_turn
  where lobby_id=p_lobby_id and actor_id=actor and card_slot=attack.card_slot;
 update public.chaotic_preview_attack_wallets
  set spent_points=spent_points+attack.attack_cost
  where lobby_id=p_lobby_id and actor_id=actor;
 return jsonb_build_object('attack_instance_id',attack.attack_instance_id,
  'attack_name',attack.attack_name,'spent_cost',attack.attack_cost,
  'points_left',available-attack.attack_cost,'turn_no',p_expected_turn);
end;
$fn$;

revoke all on function public.chaotic_prepare_preview_hand(uuid,integer)
 from public,anon,authenticated;
revoke all on function public.chaotic_sync_preview_hand(uuid,integer)
 from public,anon,authenticated;
revoke all on function public.chaotic_spend_preview_attack(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_prepare_preview_hand(uuid,integer) to authenticated;
grant execute on function public.chaotic_sync_preview_hand(uuid,integer) to authenticated;
grant execute on function public.chaotic_spend_preview_attack(uuid,integer) to authenticated;

do $$
begin
 if not exists(select 1 from pg_publication_tables
  where pubname='supabase_realtime' and schemaname='public' and
  tablename='chaotic_preview_attack_wallets') then
  alter publication supabase_realtime add table public.chaotic_preview_attack_wallets;
 end if;
 if not exists(select 1 from pg_publication_tables
  where pubname='supabase_realtime' and schemaname='public' and
  tablename='chaotic_preview_attack_hand') then
  alter publication supabase_realtime add table public.chaotic_preview_attack_hand;
 end if;
end $$;
