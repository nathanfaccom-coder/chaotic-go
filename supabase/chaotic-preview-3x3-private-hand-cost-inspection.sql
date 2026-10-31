-- Chaotic GO 0.1.38 — PRIVATE experimental hand and ATTACK-COST ELIGIBILITY for 3x3.
-- Uses frozen formation and original saved deck/album. No official hand, real
-- attacks, original cards, HP, points or rewards are changed.
-- The 3x3 training wallet has a 3-point initial budget and +1 per player's
-- later turn, but NO SPENDING YET; affordability is a nonmutating inspection.

create table if not exists public.chaotic_preview_3x3_attack_wallets (
 lobby_id uuid not null references public.chaotic_match_turns(lobby_id) on delete cascade,
 actor_id uuid not null references auth.users(id),
 deck_slot smallint not null check(deck_slot between 1 and 3),
 prepared_turn integer not null check(prepared_turn between 1 and 120),
 last_draw_turn integer not null check(last_draw_turn between 1 and 120),
 total_cards smallint not null check(total_cards between 3 and 20),
 spent_points integer not null default 0 check(spent_points=0),
 official_points_changed boolean not null default false check(official_points_changed=false),
 official_match_modified boolean not null default false check(official_match_modified=false),
 created_at timestamptz not null default now(),
 primary key(lobby_id,actor_id)
);
create table if not exists public.chaotic_preview_3x3_attack_hand (
 lobby_id uuid not null,
 actor_id uuid not null,
 card_slot smallint not null check(card_slot between 1 and 20),
 attack_instance_id text not null check(length(attack_instance_id) between 1 and 48),
 draw_position smallint not null check(draw_position between 1 and 20),
 card_state text not null check(card_state in ('hand','deck')),
 original_card_consumed boolean not null default false check(original_card_consumed=false),
 created_at timestamptz not null default now(),
 primary key(lobby_id,actor_id,card_slot),
 unique(lobby_id,actor_id,draw_position),
 unique(lobby_id,actor_id,attack_instance_id),
 foreign key(lobby_id,actor_id) references public.chaotic_preview_3x3_attack_wallets(lobby_id,actor_id) on delete cascade
);
create table if not exists public.chaotic_preview_3x3_cost_inspections (
 lobby_id uuid not null,
 turn_no integer not null check(turn_no between 1 and 120),
 actor_id uuid not null references auth.users(id),
 attack_instance_id text not null check(length(attack_instance_id) between 1 and 48),
 card_slot smallint not null check(card_slot between 1 and 20),
 catalog_attack_id text not null,
 attack_cost integer not null check(attack_cost between 0 and 50),
 points_available integer not null check(points_available between 0 and 65),
 can_afford boolean not null,
 points_after_if_paid integer,
 hand_verified boolean not null default true check(hand_verified=true),
 actual_attack_cost_paid boolean not null default false check(actual_attack_cost_paid=false),
 original_card_consumed boolean not null default false check(original_card_consumed=false),
 training_hp_changed boolean not null default false check(training_hp_changed=false),
 official_match_modified boolean not null default false check(official_match_modified=false),
 created_at timestamptz not null default now(),
 primary key(lobby_id,turn_no),
 foreign key(lobby_id,turn_no)
  references public.chaotic_preview_3x3_attack_projections(lobby_id,turn_no) on delete cascade,
 check(can_afford=(points_available>=attack_cost)),
 check(points_after_if_paid is not distinct from
   case when points_available>=attack_cost then points_available-attack_cost else null end)
);
alter table public.chaotic_preview_3x3_attack_wallets enable row level security;
alter table public.chaotic_preview_3x3_attack_hand enable row level security;
alter table public.chaotic_preview_3x3_cost_inspections enable row level security;
revoke all on public.chaotic_preview_3x3_attack_wallets,public.chaotic_preview_3x3_attack_hand,public.chaotic_preview_3x3_cost_inspections
 from public,anon,authenticated;
grant select on public.chaotic_preview_3x3_attack_wallets,public.chaotic_preview_3x3_attack_hand,public.chaotic_preview_3x3_cost_inspections to authenticated;
create policy chaotic_preview_3x3_wallet_owner on public.chaotic_preview_3x3_attack_wallets for select to authenticated
 using(actor_id=(select auth.uid()));
create policy chaotic_preview_3x3_hand_owner on public.chaotic_preview_3x3_attack_hand for select to authenticated
 using(actor_id=(select auth.uid()));
create policy chaotic_preview_3x3_cost_members on public.chaotic_preview_3x3_cost_inspections for select to authenticated
 using(exists(select 1 from public.chaotic_match_turns m where m.lobby_id=chaotic_preview_3x3_cost_inspections.lobby_id
   and (m.host_id=(select auth.uid()) or m.guest_id=(select auth.uid()))));

create or replace function public.chaotic_prepare_preview_3x3_hand(
 p_lobby_id uuid,p_expected_turn integer
) returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 slot_choice smallint;
 deck jsonb;
 album jsonb;
 records jsonb;
 c record;
 n integer:=0;
 matched integer;
 n_model integer;
begin
 if actor is null then raise exception 'Faça login';end if;
 if p_lobby_id is null or p_expected_turn is null or p_expected_turn not between 1 and 120
 then raise exception 'Turno inválido para mão 3x3';end if;
 select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id for update;
 if not found or m.status<>'active' or m.turn_no<>p_expected_turn
 or m.current_player is distinct from actor or actor not in(m.host_id,m.guest_id)
 then raise exception 'Só pode preparar a própria mão na sua vez';end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.mode<>'3x3' or l.status<>'ready' or l.expires_at<=now()
  or l.host_id is distinct from m.host_id or l.guest_id is distinct from m.guest_id
 then raise exception 'Sala de treino 3x3 indisponível';end if;
 if (select count(*) from public.chaotic_preview_3x3_allies
  where lobby_id=p_lobby_id and actor_id=actor)<>3
 then raise exception 'Prepare as três criaturas do Deck 3x3 primeiro';end if;
 select min(deck_slot) into slot_choice from public.chaotic_preview_3x3_allies
  where lobby_id=p_lobby_id and actor_id=actor;
 if (select max(deck_slot) from public.chaotic_preview_3x3_allies
  where lobby_id=p_lobby_id and actor_id=actor)<>slot_choice
 then raise exception 'Formação 3x3 contém mais de um Deck';end if;
 if exists(select 1 from public.chaotic_preview_3x3_attack_wallets
  where lobby_id=p_lobby_id and actor_id=actor)
 then raise exception 'Mão já embaralhada nesta sala; não pode sortear novamente';end if;
 select g.data into deck from public.chaotic_game_nodes g
  where g.user_id=actor and g.node_path in (
   'decks/3x3_slot_'||slot_choice::text,'decks/3x3_'||slot_choice::text)
  order by (g.node_path='decks/3x3_slot_'||slot_choice::text) desc limit 1;
 if deck is null or pg_catalog.jsonb_typeof(deck->'ataques')<>'array'
  or pg_catalog.jsonb_array_length(deck->'ataques') not between 3 and 20
 then raise exception 'O Deck 3x3 precisa ter de três a vinte ataques';end if;
 if exists(select 1 from public.chaotic_preview_3x3_allies ally
   where ally.lobby_id=p_lobby_id and ally.actor_id=actor
    and deck->'criaturas'->>(ally.position-1) is distinct from ally.creature_instance_id)
 then raise exception 'Deck alterado desde o congelamento das criaturas';end if;
 select g.data into album from public.chaotic_game_nodes g
 where g.user_id=actor and g.node_path='album';
 if pg_catalog.jsonb_typeof(album)='array' then records:=album;
 elsif pg_catalog.jsonb_typeof(album)='object' then
   select coalesce(pg_catalog.jsonb_agg(x.value),'[]'::jsonb) into records
   from pg_catalog.jsonb_each(album) x;
 else raise exception 'Álbum inválido';end if;
 -- Validate the entire deck before drawing three cards.
 for c in select e.val card_id,e.idx::integer slot
 from pg_catalog.jsonb_array_elements_text(deck->'ataques') with ordinality e(val,idx) order by e.idx loop
  if c.card_id is null or c.card_id='' or c.card_id='null'
   or length(c.card_id)>48 or c.card_id !~ '^[A-Za-z0-9_-]+$'
  then raise exception 'Ataque inválido na posição %',c.slot;end if;
  select count(*) into matched from pg_catalog.jsonb_array_elements(records) x(card)
  where x.card->>'id'=c.card_id and x.card->>'tipoCarta'='Ataque';
  if matched<>1 then raise exception 'Ataque do Deck não pertence exclusivamente ao álbum';end if;
  select count(*) into n_model from public.chaotic_preview_card_reference ref
   join pg_catalog.jsonb_array_elements(records) x(card)
    on x.card->>'id'=c.card_id
   where ref.kind='attack' and ref.card_name=x.card->>'nome'
    and ref.card_id ~ '^1(0[1-9]|1[0-5])$';
  if n_model<>1 then raise exception 'Ataque fora do catálogo original';end if;
  n:=n+1;
 end loop;
 if (select count(distinct x.val) from pg_catalog.jsonb_array_elements_text(deck->'ataques') x(val))<>n
 then raise exception 'Deck 3x3 contém instâncias repetidas';end if;
 insert into public.chaotic_preview_3x3_attack_wallets(
  lobby_id,actor_id,deck_slot,prepared_turn,last_draw_turn,total_cards
 ) values(p_lobby_id,actor,slot_choice,p_expected_turn,p_expected_turn,n);
 for c in
 select e.val card_id,e.idx::integer slot,
   row_number() over(order by pg_catalog.gen_random_uuid())::integer shuffled
 from pg_catalog.jsonb_array_elements_text(deck->'ataques') with ordinality e(val,idx)
 loop
 insert into public.chaotic_preview_3x3_attack_hand(
   lobby_id,actor_id,card_slot,attack_instance_id,draw_position,card_state
 ) values(p_lobby_id,actor,c.slot,c.card_id,c.shuffled,
   case when c.shuffled<=3 then 'hand' else 'deck' end);
 end loop;
 return pg_catalog.jsonb_build_object('state','3x3_private_shuffled_training_hand',
  'cards_in_hand',3,'cards_in_deck',n-3,'points_available',3,
  'official_match_modified',false);
end;
$fn$;
revoke all on function public.chaotic_prepare_preview_3x3_hand(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_prepare_preview_3x3_hand(uuid,integer) to authenticated;

create or replace function public.chaotic_sync_preview_3x3_hand(
 p_lobby_id uuid,p_expected_turn integer
) returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 w public.chaotic_preview_3x3_attack_wallets;
 next_card public.chaotic_preview_3x3_attack_hand;
 n_hand integer;
 draw_one boolean:=false;
 available integer;
begin
 if actor is null then raise exception 'Faça login';end if;
 select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id for update;
 if not found or p_expected_turn is null or m.status<>'active'
  or m.turn_no<>p_expected_turn or m.current_player is distinct from actor
  or actor not in (m.host_id,m.guest_id)
 then raise exception 'Turno 3x3 não autorizado';end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.mode<>'3x3' or l.status<>'ready' or l.expires_at<=now()
 then raise exception 'Sala 3x3 não está pronta';end if;
 select * into w from public.chaotic_preview_3x3_attack_wallets
  where lobby_id=p_lobby_id and actor_id=actor for update;
 if not found then raise exception 'Prepare a mão de treino primeiro';end if;
 if p_expected_turn<w.last_draw_turn or (p_expected_turn-w.prepared_turn)%2<>0
 then raise exception 'Progressão de turnos inválida';end if;
 available:=3+(p_expected_turn-w.prepared_turn)/2-w.spent_points;
 if available<0 or available>65 then raise exception 'Pontos de treino fora do limite';end if;
 if w.last_draw_turn<p_expected_turn then
  select count(*) into n_hand from public.chaotic_preview_3x3_attack_hand
   where lobby_id=p_lobby_id and actor_id=actor and card_state='hand';
  if n_hand<5 then
   select * into next_card from public.chaotic_preview_3x3_attack_hand
   where lobby_id=p_lobby_id and actor_id=actor and card_state='deck'
   order by draw_position limit 1;
   if found then
    update public.chaotic_preview_3x3_attack_hand set card_state='hand'
    where lobby_id=p_lobby_id and actor_id=actor and card_slot=next_card.card_slot;
    draw_one:=true;
   end if;
  end if;
  update public.chaotic_preview_3x3_attack_wallets
   set last_draw_turn=p_expected_turn where lobby_id=p_lobby_id and actor_id=actor;
 end if;
 return pg_catalog.jsonb_build_object('available_points',available,
   'drew_card',draw_one,'turn_no',p_expected_turn,'cost_not_paid',true);
end;
$fn$;
revoke all on function public.chaotic_sync_preview_3x3_hand(uuid,integer) from public,anon,authenticated;
grant execute on function public.chaotic_sync_preview_3x3_hand(uuid,integer) to authenticated;

create or replace function public.chaotic_inspect_preview_3x3_hand_cost(
 p_lobby_id uuid,p_expected_turn integer
) returns public.chaotic_preview_3x3_cost_inspections
language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 w public.chaotic_preview_3x3_attack_wallets;
 projected public.chaotic_preview_3x3_attack_projections;
 item public.chaotic_preview_3x3_attack_hand;
 encounter public.chaotic_preview_3x3_contact_intents;
 available integer;
 out_row public.chaotic_preview_3x3_cost_inspections;
begin
 if actor is null then raise exception 'Faça login';end if;
 if p_expected_turn is null or p_expected_turn not between 1 and 120
 then raise exception 'Turno inválido';end if;
 select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id for update;
 if not found or m.status<>'active' or m.turn_no<>p_expected_turn
  or m.current_player is distinct from actor or actor not in (m.host_id,m.guest_id)
 then raise exception 'Só atacante na própria vez pode conferir mão e custo';end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.status<>'ready' or l.mode<>'3x3' or l.expires_at<=now()
 then raise exception 'Sala 3x3 não está pronta';end if;
 select * into projected from public.chaotic_preview_3x3_attack_projections
  where lobby_id=p_lobby_id and turn_no=p_expected_turn for update;
 if not found or projected.actor_id is distinct from actor
  or projected.attack_cost_paid or projected.training_hp_changed or projected.official_match_modified
 then raise exception 'A projeção de ataque não pertence ao atacante';end if;
 select * into encounter from public.chaotic_preview_3x3_contact_intents
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 if not found or encounter.attacker_id is distinct from actor
  or encounter.attacker_slot is distinct from projected.attacker_slot
  or encounter.defender_id is distinct from projected.defender_id
  or encounter.defender_slot is distinct from projected.defender_slot
 then raise exception 'Contato e projeção divergiram';end if;
 if exists(select 1 from public.chaotic_preview_3x3_cost_inspections
  where lobby_id=p_lobby_id and turn_no=p_expected_turn)
 then raise exception 'Mão e custo já conferidos neste turno';end if;
 select * into w from public.chaotic_preview_3x3_attack_wallets
  where lobby_id=p_lobby_id and actor_id=actor for update;
 if not found or w.deck_slot<>projected.attack_deck_slot
  or w.last_draw_turn<>p_expected_turn
  or (p_expected_turn-w.prepared_turn)%2<>0
 then raise exception 'Sincronize a mão de treinamento neste turno';end if;
 select * into item from public.chaotic_preview_3x3_attack_hand
 where lobby_id=p_lobby_id and actor_id=actor
  and card_slot=projected.attack_card_slot for update;
 if not found or item.attack_instance_id is distinct from projected.attack_instance_id
  or item.card_state<>'hand'
 then raise exception 'A carta de Ataque não está na sua mão privada';end if;
 available:=3+(p_expected_turn-w.prepared_turn)/2-w.spent_points;
 if available not between 0 and 65 then raise exception 'Saldo de ataque inválido';end if;
 insert into public.chaotic_preview_3x3_cost_inspections(
 lobby_id,turn_no,actor_id,attack_instance_id,card_slot,catalog_attack_id,
 attack_cost,points_available,can_afford,points_after_if_paid
 ) values(
 p_lobby_id,p_expected_turn,actor,projected.attack_instance_id,projected.attack_card_slot,
 projected.catalog_attack_id,projected.attack_cost,available,
 available>=projected.attack_cost,
 case when available>=projected.attack_cost then available-projected.attack_cost else null end
 ) returning * into out_row;
 return out_row;
end;
$fn$;
revoke all on function public.chaotic_inspect_preview_3x3_hand_cost(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_inspect_preview_3x3_hand_cost(uuid,integer) to authenticated;

do $pub$
begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public'
  and tablename='chaotic_preview_3x3_cost_inspections')
 then alter publication supabase_realtime add table public.chaotic_preview_3x3_cost_inspections;end if;
end $pub$;