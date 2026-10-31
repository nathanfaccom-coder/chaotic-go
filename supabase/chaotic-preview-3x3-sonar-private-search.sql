-- Chaotic GO v0.1.55 — private SONAR search in the experimental 3x3 hand.
-- The ORIGINAL attack card, album, decks and official inventory are untouched.
-- This RPC only moves a valid instance from the server-frozen training deck
-- into the owner's private training hand. Search is once per settled SONAR.
create table public.chaotic_preview_3x3_sonar_search_events (
 lobby_id uuid not null,
 turn_no integer not null check(turn_no between 1 and 120),
 actor_id uuid not null references auth.users(id),
 searched_card_slot smallint check(searched_card_slot between 1 and 20),
 attack_instance_id text,
 catalog_attack_id text,
 attack_name text,
 search_succeeded boolean not null,
 hand_count_after smallint not null check(hand_count_after between 0 and 5),
 training_only boolean not null default true check(training_only),
 original_card_consumed boolean not null default false check(not original_card_consumed),
 official_match_modified boolean not null default false check(not official_match_modified),
 created_at timestamptz not null default now(),
 primary key(lobby_id,turn_no),
 foreign key(lobby_id,turn_no) references
  public.chaotic_preview_3x3_training_damage_events(lobby_id,turn_no)
  on delete cascade,
 check ((search_succeeded and searched_card_slot is not null
   and attack_instance_id is not null and catalog_attack_id is not null
   and attack_name is not null)
 or (not search_succeeded and searched_card_slot is null
   and attack_instance_id is null and catalog_attack_id is null and attack_name is null))
);
alter table public.chaotic_preview_3x3_sonar_search_events enable row level security;
revoke all on public.chaotic_preview_3x3_sonar_search_events from public,anon,authenticated;
grant select on public.chaotic_preview_3x3_sonar_search_events to authenticated;
create policy chaotic_preview_3x3_sonar_search_private_actor_read
 on public.chaotic_preview_3x3_sonar_search_events
 for select to authenticated
 using ((select auth.uid())=actor_id);

-- Terminal training cannot initiate new SONAR effects; a final knockout
-- can finish its own damage transaction before creating terminal outcome.
create trigger chaotic_3x3_terminal_guard
 before insert on public.chaotic_preview_3x3_sonar_search_events
 for each row execute function public.chaotic_guard_preview_3x3_terminal_actions();

-- Deferred search is resolved separately from its damage, preserving the
-- existing 110 damage with effects_fully_resolved=false until search receipt.
alter table public.chaotic_preview_3x3_attack_spends
 drop constraint chaotic_preview_3x3_training_settlement_consistency;
alter table public.chaotic_preview_3x3_attack_spends
 add constraint chaotic_preview_3x3_training_settlement_consistency
 check((not training_damage_applied and resolution_status='paid_training_unresolved')
  or (training_damage_applied and resolution_status in (
    'training_base_damage_105_optional_reveal_pending',
    'training_base_damage_attack_lock_applied',
    'training_conditional_damage_resolved',
    'training_elemental_acid_101_native_only',
    'training_elemental_vine_107_attack_draw_lock_partial',
    'training_elemental_sonar_110_rex_immunity_search_pending',
    'training_elemental_sonar_110_search_complete')));

-- Keep the original seven attacks and the incomplete 110 state compatible.
alter table public.chaotic_preview_3x3_training_damage_events
 drop constraint chaotic_preview_3x3_training_elemental_attack_catalog_check;
alter table public.chaotic_preview_3x3_training_damage_events
 add constraint chaotic_preview_3x3_training_elemental_attack_catalog_check
 check(
  (catalog_attack_id='101' and base_damage=10 and bonus_damage=0
   and defeated_allies_count=0 and elemental_bonus_damage in(0,5,10)
   and immunity_prevented_damage=0 and not optional_reveal_pending and effects_fully_resolved)
  or (catalog_attack_id='107' and base_damage=5 and bonus_damage=0
   and defeated_allies_count=0 and elemental_bonus_damage in(0,5)
   and immunity_prevented_damage=0 and not optional_reveal_pending and not effects_fully_resolved)
  or (catalog_attack_id='110' and base_damage=0 and bonus_damage=0
   and defeated_allies_count=0
   and elemental_bonus_damage in(0,10,20)
   and immunity_prevented_damage in(0,10,20)
   and elemental_bonus_damage+immunity_prevented_damage<=20
   and not optional_reveal_pending)
  or (catalog_attack_id='105' and base_damage=5 and bonus_damage=0
   and defeated_allies_count=0 and elemental_bonus_damage=0 and immunity_prevented_damage=0
   and optional_reveal_pending and not effects_fully_resolved)
  or (catalog_attack_id='111' and base_damage=10 and bonus_damage=0
   and defeated_allies_count=0 and elemental_bonus_damage=0 and immunity_prevented_damage=0
   and not optional_reveal_pending and effects_fully_resolved)
  or (catalog_attack_id='112' and base_damage=5 and bonus_damage=0
   and defeated_allies_count=0 and elemental_bonus_damage=0 and immunity_prevented_damage=0
   and not optional_reveal_pending and effects_fully_resolved)
  or (catalog_attack_id='113' and base_damage=0 and elemental_bonus_damage=0
   and immunity_prevented_damage=0 and bonus_damage=5*defeated_allies_count
   and not optional_reveal_pending and effects_fully_resolved)
  or (catalog_attack_id='114' and base_damage=10 and elemental_bonus_damage=0
   and immunity_prevented_damage=0 and bonus_damage=5*defeated_allies_count
   and not optional_reveal_pending and effects_fully_resolved));

create or replace function public.chaotic_resolve_preview_3x3_sonar_search(
 p_lobby_id uuid,p_expected_turn integer,p_card_slot integer default null,
 p_lookup_only boolean default true
) returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 spent public.chaotic_preview_3x3_attack_spends;
 dmg public.chaotic_preview_3x3_training_damage_events;
 wallet public.chaotic_preview_3x3_attack_wallets;
 deck jsonb;
 album jsonb;
 records jsonb;
 choice public.chaotic_preview_3x3_attack_hand;
 card_row record;
 n integer;
 match_count integer;
 cost_value integer;
 catalog_id text;
 catalog_name text;
 count_hand integer;
 candidates jsonb:='[]'::jsonb;
 chosen_name text;
 chosen_model text;
 chosen_cost integer;
 chosen_instance text;
 chosen boolean:=false;
 event_row public.chaotic_preview_3x3_sonar_search_events;
begin
 if actor is null then raise exception 'Faça login';end if;
 if p_lobby_id is null or p_expected_turn is null
  or p_expected_turn not between 1 and 120
  or p_lookup_only is null
  or (p_card_slot is not null and p_card_slot not between 1 and 20)
 then raise exception 'Busca SONAR inválida';end if;
 select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id for update;
 if not found or m.status<>'active'
   or m.turn_no<>p_expected_turn or m.current_player is distinct from actor
   or actor not in(m.host_id,m.guest_id)
 then raise exception 'Somente o atacante do turno pode buscar carta pelo SONAR';end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.mode<>'3x3' or l.status<>'ready' or l.expires_at<=now()
  or l.host_id is distinct from m.host_id or l.guest_id is distinct from m.guest_id
 then raise exception 'Sala de treino 3x3 indisponível';end if;
 if exists(select 1 from public.chaotic_preview_3x3_training_outcomes
   where lobby_id=p_lobby_id)
 then raise exception 'Treino concluído: nenhuma nova busca permitida';end if;
 select * into spent from public.chaotic_preview_3x3_attack_spends
  where lobby_id=p_lobby_id and turn_no=p_expected_turn for update;
 select * into dmg from public.chaotic_preview_3x3_training_damage_events
  where lobby_id=p_lobby_id and turn_no=p_expected_turn for update;
 if spent.lobby_id is null or dmg.lobby_id is null
  or spent.actor_id is distinct from actor or dmg.attacker_id is distinct from actor
  or spent.catalog_attack_id<>'110' or dmg.catalog_attack_id<>'110'
  or spent.attack_instance_id is distinct from dmg.attack_instance_id
  or not spent.training_points_paid or not spent.training_card_spent
  or not spent.training_damage_applied
  or spent.resolution_status<>'training_elemental_sonar_110_rex_immunity_search_pending'
  or dmg.effects_fully_resolved or dmg.official_match_modified
 then raise exception 'O SONAR precisa ser pago e resolver o dano de treino primeiro';end if;
 if exists(select 1 from public.chaotic_preview_3x3_sonar_search_events
  where lobby_id=p_lobby_id and turn_no=p_expected_turn)
 then raise exception 'Busca do SONAR já utilizada neste turno';end if;
 select * into wallet from public.chaotic_preview_3x3_attack_wallets
  where lobby_id=p_lobby_id and actor_id=actor for update;
 if wallet.lobby_id is null or wallet.prepared_turn>p_expected_turn
  or wallet.last_draw_turn<>p_expected_turn
  or (p_expected_turn-wallet.prepared_turn)%2<>0
 then raise exception 'Mão de treino não sincronizada neste turno';end if;
 select g.data into deck from public.chaotic_game_nodes g
  where g.user_id=actor and g.node_path in(
   'decks/3x3_slot_'||wallet.deck_slot::text,
   'decks/3x3_'||wallet.deck_slot::text)
  order by(g.node_path='decks/3x3_slot_'||wallet.deck_slot::text) desc
  limit 1 for update;
 if deck is null or pg_catalog.jsonb_typeof(deck->'ataques')<>'array'
  or pg_catalog.jsonb_array_length(deck->'ataques')<>wallet.total_cards
 then raise exception 'Deck de ataques original alterado ou ausente';end if;
 select g.data into album from public.chaotic_game_nodes g
  where g.user_id=actor and g.node_path='album' for update;
 if pg_catalog.jsonb_typeof(album)='array' then records:=album;
 elsif pg_catalog.jsonb_typeof(album)='object' then
  select coalesce(pg_catalog.jsonb_agg(x.value),'[]'::jsonb) into records
  from pg_catalog.jsonb_each(album) x;
 else raise exception 'Álbum original ausente ou inválido';end if;
 select count(*) into n from public.chaotic_preview_3x3_attack_hand
  where lobby_id=p_lobby_id and actor_id=actor;
 if n<>wallet.total_cards or exists(
  select 1 from public.chaotic_preview_3x3_attack_hand h
  where h.lobby_id=p_lobby_id and h.actor_id=actor
   and deck->'ataques'->>(h.card_slot-1) is distinct from h.attack_instance_id)
 then raise exception 'Baralho de treino divergiu das instâncias originais';end if;
 select count(*) into count_hand from public.chaotic_preview_3x3_attack_hand
 where lobby_id=p_lobby_id and actor_id=actor and card_state='hand';
 if count_hand>5 then raise exception 'Mão excede o limite de cinco';end if;
 if count_hand<5 then
  for card_row in
   select h.card_slot,h.attack_instance_id from public.chaotic_preview_3x3_attack_hand h
   where h.lobby_id=p_lobby_id and h.actor_id=actor and h.card_state='deck'
   order by h.draw_position
  loop
   select count(*),min(c.attack_cost),min(c.card_id),min(c.card_name)
    into match_count,cost_value,catalog_id,catalog_name
   from public.chaotic_preview_card_reference c
   join pg_catalog.jsonb_array_elements(records) x(card)
    on x.card->>'id'=card_row.attack_instance_id
     and x.card->>'tipoCarta'='Ataque'
     and x.card->>'nome'=c.card_name
   where c.kind='attack' and c.card_id ~ '^1(0[1-9]|1[0-5])$';
   if match_count<>1 then
    raise exception 'Ataque de monte não corresponde a uma carta original do álbum';end if;
   if cost_value<=1 then
    candidates:=candidates||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'card_slot',card_row.card_slot,'attack_name',catalog_name,
      'catalog_attack_id',catalog_id,'attack_cost',cost_value));
    if p_card_slot=card_row.card_slot then
     chosen:=true;chosen_name:=catalog_name;chosen_model:=catalog_id;
     chosen_cost:=cost_value;chosen_instance:=card_row.attack_instance_id;
    end if;
   end if;
  end loop;
 end if;
 if p_lookup_only then
  return pg_catalog.jsonb_build_object('choices',candidates,'hand_count',count_hand,
   'hand_limit',5,'search_pending',true,'private_training_only',true);
 end if;
 if pg_catalog.jsonb_array_length(candidates)>0 and not chosen
 then raise exception 'Selecione uma carta elegível de custo até 1';end if;
 if pg_catalog.jsonb_array_length(candidates)=0 and p_card_slot is not null
 then raise exception 'Não há carta elegível ou espaço na mão';end if;
 if chosen then
  update public.chaotic_preview_3x3_attack_hand
   set card_state='hand'
   where lobby_id=p_lobby_id and actor_id=actor
     and card_slot=p_card_slot and card_state='deck';
  if not found then raise exception 'Carta de busca não está mais no monte';end if;
 end if;
 insert into public.chaotic_preview_3x3_sonar_search_events(
  lobby_id,turn_no,actor_id,searched_card_slot,attack_instance_id,
  catalog_attack_id,attack_name,search_succeeded,hand_count_after)
 values(p_lobby_id,p_expected_turn,actor,
  case when chosen then p_card_slot else null end,
  case when chosen then chosen_instance else null end,
  case when chosen then chosen_model else null end,
  case when chosen then chosen_name else null end,
  chosen,count_hand+case when chosen then 1 else 0 end)
 returning * into event_row;
 update public.chaotic_preview_3x3_training_damage_events
  set effects_fully_resolved=true
 where lobby_id=p_lobby_id and turn_no=p_expected_turn and catalog_attack_id='110';
 update public.chaotic_preview_3x3_attack_spends
  set resolution_status='training_elemental_sonar_110_search_complete'
 where lobby_id=p_lobby_id and turn_no=p_expected_turn
  and catalog_attack_id='110' and training_damage_applied;
 return pg_catalog.jsonb_build_object(
  'search_succeeded',event_row.search_succeeded,
  'searched_card_slot',event_row.searched_card_slot,
  'attack_name',event_row.attack_name,
  'hand_count_after',event_row.hand_count_after,
  'effects_fully_resolved',true,
  'training_only',true,'original_card_consumed',false);
end;
$fn$;
revoke all on function public.chaotic_resolve_preview_3x3_sonar_search(uuid,integer,integer,boolean)
 from public,anon,authenticated;
grant execute on function public.chaotic_resolve_preview_3x3_sonar_search(uuid,integer,integer,boolean)
 to authenticated;
