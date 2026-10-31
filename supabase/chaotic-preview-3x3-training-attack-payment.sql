-- Chaotic GO v0.1.39: transactional training-only 3x3 Attack payment and use.
-- Does NOT modify deck, album, original card, official resources, HP, victory or Burst.
-- The attack cost is paid exclusively from the separately tracked training budget.

alter table public.chaotic_preview_3x3_attack_wallets
 drop constraint if exists chaotic_preview_3x3_attack_wallets_spent_points_check;
alter table public.chaotic_preview_3x3_attack_wallets
 add constraint chaotic_preview_3x3_attack_wallets_spent_points_check
 check(spent_points between 0 and 65);

alter table public.chaotic_preview_3x3_attack_hand
 drop constraint if exists chaotic_preview_3x3_attack_hand_card_state_check;
alter table public.chaotic_preview_3x3_attack_hand
 add constraint chaotic_preview_3x3_attack_hand_card_state_check
 check(card_state in ('deck','hand','spent'));
alter table public.chaotic_preview_3x3_attack_hand
 add column if not exists spent_turn integer check(spent_turn between 1 and 120),
 add column if not exists spent_reason text check(spent_reason='attack');
alter table public.chaotic_preview_3x3_attack_hand
 add constraint chaotic_preview_3x3_attack_hand_spent_state_check
 check(
  (card_state='spent' and spent_turn is not null and spent_reason='attack')
  or (card_state in ('deck','hand') and spent_turn is null and spent_reason is null)
 );

create table if not exists public.chaotic_preview_3x3_attack_spends(
 lobby_id uuid not null,
 turn_no integer not null check(turn_no between 1 and 120),
 actor_id uuid not null references auth.users(id),
 attack_deck_slot smallint not null check(attack_deck_slot between 1 and 3),
 card_slot smallint not null check(card_slot between 1 and 20),
 attack_instance_id text not null check(length(attack_instance_id) between 1 and 48),
 catalog_attack_id text not null check(catalog_attack_id ~ '^1(0[1-9]|1[0-5])$'),
 training_attack_cost integer not null check(training_attack_cost between 0 and 50),
 points_before integer not null check(points_before between 0 and 65),
 points_after integer not null check(points_after between 0 and 65),
 training_points_paid boolean not null default true check(training_points_paid=true),
 training_card_spent boolean not null default true check(training_card_spent=true),
 training_damage_applied boolean not null default false check(training_damage_applied=false),
 official_points_changed boolean not null default false check(official_points_changed=false),
 original_card_consumed boolean not null default false check(original_card_consumed=false),
 official_hp_changed boolean not null default false check(official_hp_changed=false),
 official_match_modified boolean not null default false check(official_match_modified=false),
 resolution_status text not null default 'paid_training_unresolved'
  check(resolution_status='paid_training_unresolved'),
 created_at timestamptz not null default now(),
 primary key(lobby_id,turn_no),
 foreign key(lobby_id,turn_no)
   references public.chaotic_preview_3x3_cost_inspections(lobby_id,turn_no)
   on delete cascade,
 foreign key(lobby_id,actor_id,card_slot)
   references public.chaotic_preview_3x3_attack_hand(lobby_id,actor_id,card_slot),
 check(points_after=points_before-training_attack_cost)
);
alter table public.chaotic_preview_3x3_attack_spends enable row level security;
revoke all on public.chaotic_preview_3x3_attack_spends from public,anon,authenticated;
grant select on public.chaotic_preview_3x3_attack_spends to authenticated;
create policy chaotic_preview_3x3_attack_spend_members_read
 on public.chaotic_preview_3x3_attack_spends for select to authenticated
 using(exists(select 1 from public.chaotic_match_turns m
 where m.lobby_id=chaotic_preview_3x3_attack_spends.lobby_id
 and (m.host_id=(select auth.uid()) or m.guest_id=(select auth.uid()))));

create or replace function public.chaotic_spend_preview_3x3_attack(
 p_lobby_id uuid,p_expected_turn integer
) returns public.chaotic_preview_3x3_attack_spends
language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 projection public.chaotic_preview_3x3_attack_projections;
 inspection public.chaotic_preview_3x3_cost_inspections;
 encounter public.chaotic_preview_3x3_contact_intents;
 wallet public.chaotic_preview_3x3_attack_wallets;
 card public.chaotic_preview_3x3_attack_hand;
 available_points integer;
 new_spent integer;
 spend_event public.chaotic_preview_3x3_attack_spends;
begin
 if actor is null then raise exception 'Faça login';end if;
 if p_lobby_id is null or p_expected_turn is null or p_expected_turn not between 1 and 120
 then raise exception 'Turno de uso de ataque inválido';end if;
 select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id for update;
 if not found or m.status<>'active' or m.turn_no<>p_expected_turn
  or m.current_player is distinct from actor or actor not in (m.host_id,m.guest_id)
 then raise exception 'Somente o atacante da vez pode gastar no treinamento';end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.mode<>'3x3' or l.status<>'ready' or l.expires_at<=now()
  or l.host_id is distinct from m.host_id or l.guest_id is distinct from m.guest_id
 then raise exception 'Sala 3x3 de treinamento não está pronta';end if;
 if exists(select 1 from public.chaotic_preview_3x3_attack_spends
  where lobby_id=p_lobby_id and turn_no=p_expected_turn)
 then raise exception 'Ataque já foi gasto neste turno experimental';end if;
 if exists(select 1 from public.chaotic_preview_clashes
  where lobby_id=p_lobby_id and turn_no=p_expected_turn)
  or exists(select 1 from public.chaotic_preview_burst_windows
  where lobby_id=p_lobby_id and turn_no=p_expected_turn)
 then raise exception 'Outro Clash/Burst impede gasto paralelo no mesmo turno';end if;
 select * into encounter from public.chaotic_preview_3x3_contact_intents
  where lobby_id=p_lobby_id and turn_no=p_expected_turn for update;
 if not found or encounter.attacker_id is distinct from actor
  or encounter.defender_id is distinct from
    (case when m.host_id=actor then m.guest_id else m.host_id end)
  or encounter.contact_status<>'awaiting_validated_attack_preview'
  or encounter.damage_applied or encounter.attack_card_validated
  or encounter.official_match_modified or encounter.official_hp_changed
 then raise exception 'Contato 3x3 incorreto ou já resolvido';end if;
 select * into projection from public.chaotic_preview_3x3_attack_projections
  where lobby_id=p_lobby_id and turn_no=p_expected_turn for update;
 if not found or projection.actor_id is distinct from actor
  or projection.defender_id is distinct from encounter.defender_id
  or projection.attacker_slot is distinct from encounter.attacker_slot
  or projection.defender_slot is distinct from encounter.defender_slot
  or projection.defender_hp_before is distinct from encounter.defender_hp_at_contact
  or projection.attack_cost_paid or projection.training_hp_changed
  or projection.original_card_consumed or projection.official_match_modified
 then raise exception 'A projeção não corresponde ao contato original';end if;
 select * into inspection from public.chaotic_preview_3x3_cost_inspections
  where lobby_id=p_lobby_id and turn_no=p_expected_turn for update;
 if not found or inspection.actor_id is distinct from actor
  or inspection.attack_instance_id is distinct from projection.attack_instance_id
  or inspection.card_slot is distinct from projection.attack_card_slot
  or inspection.catalog_attack_id is distinct from projection.catalog_attack_id
  or inspection.attack_cost is distinct from projection.attack_cost
  or inspection.hand_verified is distinct from true
  or not inspection.can_afford or inspection.actual_attack_cost_paid
  or inspection.original_card_consumed or inspection.training_hp_changed
  or inspection.official_match_modified
 then raise exception 'Sem prova de carta na mão ou custo insuficiente';end if;
 select * into wallet from public.chaotic_preview_3x3_attack_wallets
  where lobby_id=p_lobby_id and actor_id=actor for update;
 if not found or wallet.deck_slot is distinct from projection.attack_deck_slot
  or wallet.last_draw_turn<>p_expected_turn
  or wallet.prepared_turn>p_expected_turn
  or (p_expected_turn-wallet.prepared_turn)%2<>0
  or wallet.spent_points not between 0 and 65
  or wallet.official_points_changed or wallet.official_match_modified
 then raise exception 'Carteira de ataque não sincronizada ou inválida';end if;
 available_points:=3+(p_expected_turn-wallet.prepared_turn)/2-wallet.spent_points;
 if available_points not between 0 and 65
  or available_points is distinct from inspection.points_available
  or inspection.points_after_if_paid is distinct from
       (available_points-projection.attack_cost)
  or available_points<projection.attack_cost
 then raise exception 'Pontos de treino mudaram ou não bastam para pagar';end if;
 select * into card from public.chaotic_preview_3x3_attack_hand
  where lobby_id=p_lobby_id and actor_id=actor
  and card_slot=projection.attack_card_slot for update;
 if not found or card.card_state<>'hand'
  or card.attack_instance_id is distinct from projection.attack_instance_id
  or card.spent_turn is not null or card.original_card_consumed
 then raise exception 'Ataque já utilizado ou não está na sua própria mão';end if;
 new_spent:=wallet.spent_points+projection.attack_cost;
 if new_spent not between 0 and 65 then raise exception 'Gasto acumulado inválido';end if;
 update public.chaotic_preview_3x3_attack_wallets
  set spent_points=new_spent
  where lobby_id=p_lobby_id and actor_id=actor;
 update public.chaotic_preview_3x3_attack_hand
  set card_state='spent',spent_turn=p_expected_turn,spent_reason='attack'
  where lobby_id=p_lobby_id and actor_id=actor and card_slot=card.card_slot;
 insert into public.chaotic_preview_3x3_attack_spends(
  lobby_id,turn_no,actor_id,attack_deck_slot,card_slot,attack_instance_id,
  catalog_attack_id,training_attack_cost,points_before,points_after
 ) values(
  p_lobby_id,p_expected_turn,actor,projection.attack_deck_slot,
  projection.attack_card_slot,projection.attack_instance_id,
  projection.catalog_attack_id,projection.attack_cost,
  available_points,available_points-projection.attack_cost
 ) returning * into spend_event;
 return spend_event;
end;
$fn$;
revoke all on function public.chaotic_spend_preview_3x3_attack(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_spend_preview_3x3_attack(uuid,integer) to authenticated;
do $pub$
begin
 if not exists(select 1 from pg_publication_tables
  where pubname='supabase_realtime' and schemaname='public'
   and tablename='chaotic_preview_3x3_attack_spends')
 then alter publication supabase_realtime add table public.chaotic_preview_3x3_attack_spends;
 end if;
end $pub$;