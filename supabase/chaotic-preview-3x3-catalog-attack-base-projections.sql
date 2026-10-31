-- Chaotic GO v0.1.37 — attack catalog validation and BASE-DAMAGE PROJECTION
-- for a 3x3 two-side contact already captured by the server.
-- WARNING: only deck/album match and catalog reference are validated. The
-- album is player-editable; hand, payment, elements, defensive effects and
-- initiative remain NOT VERIFIED. No training or official HP is updated.

create table if not exists public.chaotic_preview_3x3_attack_projections (
 lobby_id uuid not null,
 turn_no integer not null check(turn_no between 1 and 120),
 actor_id uuid not null references auth.users(id),
 attack_deck_slot smallint not null check(attack_deck_slot between 1 and 3),
 attack_card_slot smallint not null check(attack_card_slot between 1 and 20),
 attack_instance_id text not null check(length(attack_instance_id) between 1 and 48),
 catalog_attack_id text not null check(catalog_attack_id ~ '^1(0[1-9]|1[0-5])$'),
 attack_name text not null check(length(attack_name) between 1 and 120),
 base_damage integer not null check(base_damage between 0 and 500),
 attack_cost integer not null check(attack_cost between 0 and 50),
 attacker_slot smallint not null check(attacker_slot between 4 and 6),
 defender_id uuid not null references auth.users(id),
 defender_slot smallint not null check(defender_slot between 4 and 6),
 defender_hp_before integer not null check(defender_hp_before between 1 and 500),
 defender_hp_projected integer not null check(defender_hp_projected between 0 and 500),
 projected_hp_loss integer not null check(projected_hp_loss between 0 and 500),
 hypothetical_knockout boolean not null,
 attack_in_hand_verified boolean not null default false check(attack_in_hand_verified=false),
 attack_cost_paid boolean not null default false check(attack_cost_paid=false),
 elemental_damage_applied boolean not null default false check(elemental_damage_applied=false),
 defensive_effects_resolved boolean not null default false check(defensive_effects_resolved=false),
 training_hp_changed boolean not null default false check(training_hp_changed=false),
 official_hp_changed boolean not null default false check(official_hp_changed=false),
 original_card_consumed boolean not null default false check(original_card_consumed=false),
 official_match_modified boolean not null default false check(official_match_modified=false),
 calculation_scope text not null default 'base_only_unresolved' check(calculation_scope='base_only_unresolved'),
 created_at timestamptz not null default now(),
 primary key(lobby_id,turn_no),
 foreign key(lobby_id,turn_no)
  references public.chaotic_preview_3x3_contact_intents(lobby_id,turn_no)
  on delete cascade,
 check(actor_id<>defender_id),
 check(defender_hp_projected=greatest(0,defender_hp_before-base_damage)),
 check(projected_hp_loss=defender_hp_before-defender_hp_projected),
 check(hypothetical_knockout=(defender_hp_projected=0))
);
alter table public.chaotic_preview_3x3_attack_projections enable row level security;
revoke all on public.chaotic_preview_3x3_attack_projections from public,anon,authenticated;
grant select on public.chaotic_preview_3x3_attack_projections to authenticated;
create policy chaotic_preview_3x3_attack_projection_members_read
 on public.chaotic_preview_3x3_attack_projections for select to authenticated
 using (exists(select 1 from public.chaotic_match_turns m
  where m.lobby_id=chaotic_preview_3x3_attack_projections.lobby_id
   and ((select auth.uid())=m.host_id or (select auth.uid())=m.guest_id)));

create or replace function public.chaotic_prepare_preview_3x3_base_attack(
 p_lobby_id uuid,p_expected_turn integer,p_attack_card_slot integer
) returns public.chaotic_preview_3x3_attack_projections
language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 encounter public.chaotic_preview_3x3_contact_intents;
 ally public.chaotic_preview_3x3_allies;
 my_board public.chaotic_preview_3x3_board_positions;
 other_board public.chaotic_preview_3x3_board_positions;
 hp public.chaotic_preview_3x3_hp_wallets;
 deck jsonb;
 album jsonb;
 records jsonb;
 owned_card jsonb;
 card_instance text;
 card_count integer;
 model_count integer;
 model_id text;
 model_name text;
 model_base integer;
 model_cost integer;
 input_attr text;
 raw_text text;
 expected_damage integer;
 output_row public.chaotic_preview_3x3_attack_projections;
begin
 if actor is null then raise exception 'Faça login';end if;
 if p_lobby_id is null or p_expected_turn is null or p_expected_turn not between 1 and 120
   or p_attack_card_slot is null or p_attack_card_slot not between 1 and 20
 then raise exception 'Turno ou slot da carta de ataque inválidos';end if;
 select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id for update;
 if not found or m.status<>'active' or m.turn_no<>p_expected_turn
   or m.current_player is distinct from actor
   or actor not in (m.host_id,m.guest_id)
 then raise exception 'Somente atacante na própria vez pode preparar a projeção';end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.mode<>'3x3' or l.status<>'ready' or l.expires_at<=now()
  or l.host_id is distinct from m.host_id or l.guest_id is distinct from m.guest_id
 then raise exception 'Sala 3x3 de treinamento inválida';end if;
 select * into encounter from public.chaotic_preview_3x3_contact_intents
 where lobby_id=p_lobby_id and turn_no=p_expected_turn for update;
 if not found or encounter.attacker_id is distinct from actor
  or encounter.defender_id is distinct from
   (case when m.host_id=actor then m.guest_id else m.host_id end)
  or encounter.contact_status<>'awaiting_validated_attack_preview'
  or encounter.attack_card_validated or encounter.damage_applied
  or encounter.official_match_modified or encounter.official_hp_changed
 then raise exception 'Contato 3x3 não pertence ao atacante, mudou ou já foi resolvido';end if;
 if exists(select 1 from public.chaotic_preview_3x3_attack_projections
  where lobby_id=p_lobby_id and turn_no=p_expected_turn)
 then raise exception 'Ataque-base já conferido para este turno';end if;
 if exists(select 1 from public.chaotic_preview_clashes
  where lobby_id=p_lobby_id and turn_no=p_expected_turn)
  or exists(select 1 from public.chaotic_preview_burst_windows
   where lobby_id=p_lobby_id and turn_no=p_expected_turn)
 then raise exception 'Outro Clash ou Burst está aberto neste turno';end if;
 select * into ally from public.chaotic_preview_3x3_allies
 where lobby_id=p_lobby_id and actor_id=actor and position=encounter.attacker_slot;
 if not found or ally.creature_instance_id is distinct from encounter.attacker_creature_instance_id
 then raise exception 'Criatura atacante do Deck divergiu do contato';end if;
 select * into my_board from public.chaotic_preview_3x3_board_positions
 where lobby_id=p_lobby_id and actor_id=actor
   and formation_slot=encounter.attacker_slot;
 select * into other_board from public.chaotic_preview_3x3_board_positions
 where lobby_id=p_lobby_id and actor_id=encounter.defender_id
   and formation_slot=encounter.defender_slot;
 if my_board.creature_instance_id is distinct from encounter.attacker_creature_instance_id
  or my_board.hex_position is distinct from encounter.attacker_hex
  or other_board.creature_instance_id is distinct from encounter.defender_creature_instance_id
  or other_board.hex_position is distinct from encounter.defender_hex
 then raise exception 'As criaturas se moveram ou não correspondem ao contato';end if;
 select * into hp from public.chaotic_preview_3x3_hp_wallets
 where lobby_id=p_lobby_id and actor_id=encounter.defender_id
   and position=encounter.defender_slot;
 if not found or hp.creature_instance_id is distinct from encounter.defender_creature_instance_id
  or hp.hp_remaining is distinct from encounter.defender_hp_at_contact
  or hp.hp_remaining<1
 then raise exception 'HP individual do defensor mudou desde o contato';end if;
 if not exists(select 1 from public.chaotic_preview_3x3_hp_wallets own_hp
   where own_hp.lobby_id=p_lobby_id and own_hp.actor_id=actor
   and own_hp.position=encounter.attacker_slot
   and own_hp.creature_instance_id=encounter.attacker_creature_instance_id
   and own_hp.hp_remaining=encounter.attacker_hp_at_contact
   and own_hp.hp_remaining>0)
 then raise exception 'HP individual do atacante mudou desde o contato';end if;
 select g.data into deck from public.chaotic_game_nodes g
 where g.user_id=actor and g.node_path in (
 'decks/3x3_slot_'||ally.deck_slot::text,
 'decks/3x3_'||ally.deck_slot::text)
 order by (g.node_path='decks/3x3_slot_'||ally.deck_slot::text) desc limit 1;
 if deck is null or pg_catalog.jsonb_typeof(deck->'ataques')<>'array'
  or pg_catalog.jsonb_array_length(deck->'ataques')<p_attack_card_slot
 then raise exception 'Slot de ataque ausente no Deck 3x3 da criatura';end if;
 if deck->'criaturas'->>(encounter.attacker_slot-1)
    is distinct from encounter.attacker_creature_instance_id
 then raise exception 'Deck não corresponde mais à criatura atacante';end if;
 card_instance:=deck->'ataques'->>(p_attack_card_slot-1);
 if card_instance is null or card_instance='' or card_instance='null'
  or length(card_instance)>48 or card_instance !~ '^[a-zA-Z0-9_-]+$'
 then raise exception 'Slot do Deck sem instância de ataque válida';end if;
 select g.data into album from public.chaotic_game_nodes g
  where g.user_id=actor and g.node_path='album';
 if pg_catalog.jsonb_typeof(album)='array' then records:=album;
 elsif pg_catalog.jsonb_typeof(album)='object' then
  select coalesce(pg_catalog.jsonb_agg(x.value),'[]'::jsonb) into records
  from pg_catalog.jsonb_each(album) x;
 else raise exception 'Álbum do atacante inválido ou inexistente';end if;
 select count(*),min(x.value::text)::jsonb into card_count,owned_card
 from pg_catalog.jsonb_array_elements(records) x(value)
 where x.value->>'id'=card_instance and x.value->>'tipoCarta'='Ataque';
 if card_count<>1 or nullif(owned_card->>'nome','') is null
  or length(owned_card->>'nome')>120
 then raise exception 'Ataque original não localizado unicamente no álbum particular';end if;
 if owned_card ? 'quantidade' then
  raw_text:=owned_card->>'quantidade';
  if raw_text is null or raw_text !~ '^[0-9]{1,5}$' or raw_text::integer<1
  then raise exception 'Ataque não possui cópias disponíveis no álbum';end if;
 end if;
 select count(*),min(ref.card_id),min(ref.card_name),min(ref.base_damage),
   min(ref.attack_cost) into model_count,model_id,model_name,model_base,model_cost
 from public.chaotic_preview_card_reference ref
 where ref.kind='attack' and ref.card_name=owned_card->>'nome'
  and ref.card_id ~ '^1(0[1-9]|1[0-5])$';
 if model_count<>1 or model_id is null or model_base is null or model_cost is null
 then raise exception 'Ataque não pertence exclusivamente ao catálogo original ativo';end if;
 foreach input_attr in array array['danoBase','custo'] loop
  if owned_card ? input_attr then
   if (owned_card->>input_attr) !~ '^[0-9]{1,3}$'
   then raise exception 'Atributo original de ataque malformado: %',input_attr;end if;
   if (owned_card->>input_attr)::integer <>
    (case when input_attr='danoBase' then model_base else model_cost end)
   then raise exception 'Atributo de ataque divergente do catálogo: %',input_attr;end if;
  end if;
 end loop;
 expected_damage:=least(model_base,hp.hp_remaining);
 insert into public.chaotic_preview_3x3_attack_projections(
  lobby_id,turn_no,actor_id,attack_deck_slot,attack_card_slot,
  attack_instance_id,catalog_attack_id,attack_name,base_damage,attack_cost,
  attacker_slot,defender_id,defender_slot,defender_hp_before,
  defender_hp_projected,projected_hp_loss,hypothetical_knockout
 ) values(
  p_lobby_id,p_expected_turn,actor,ally.deck_slot,p_attack_card_slot,
  card_instance,model_id,model_name,model_base,model_cost,
  encounter.attacker_slot,encounter.defender_id,encounter.defender_slot,
  hp.hp_remaining,greatest(0,hp.hp_remaining-model_base),expected_damage,
  (hp.hp_remaining-model_base<=0)
 ) returning * into output_row;
 return output_row;
end;
$fn$;
revoke all on function public.chaotic_prepare_preview_3x3_base_attack(uuid,integer,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_prepare_preview_3x3_base_attack(uuid,integer,integer)
 to authenticated;

do $pub$
begin
 if not exists(select 1 from pg_publication_tables
  where pubname='supabase_realtime' and schemaname='public'
    and tablename='chaotic_preview_3x3_attack_projections')
 then alter publication supabase_realtime
  add table public.chaotic_preview_3x3_attack_projections;end if;
end $pub$;