-- Chaotic GO 0.1.30: authoritative TRAINING-ONLY Mugic token wallets and atomic LIFO settlement.
-- Original creature token caps copied from cartas.js; this is NOT evidence of card issuance/ownership.
-- Do not update original decks, album, official match HP, money, XP, or battle tokens.

create table if not exists public.chaotic_preview_mugic_token_catalog (
 creature_name text primary key,
 starting_tokens smallint not null check(starting_tokens between 0 and 20)
);
alter table public.chaotic_preview_mugic_token_catalog enable row level security;
revoke all on public.chaotic_preview_mugic_token_catalog from public,anon,authenticated;
insert into public.chaotic_preview_mugic_token_catalog(creature_name,starting_tokens)
values
 ('Johnes',2),
 ('Promos',3),
 ('Alakazaz',5),
 ('Alfel',1),
 ('Ferez',0),
 ('Frador',1),
 ('Gaturno',0),
 ('Guru',2),
 ('Horn-ey',0),
 ('Leona',1),
 ('Lion',1),
 ('Naty',3),
 ('Rex',2),
 ('Spedman',1),
 ('Vidal',2),
 ('Xamã',4)
on conflict(creature_name) do nothing;

create table if not exists public.chaotic_preview_mugic_token_wallets (
 lobby_id uuid not null references public.chaotic_match_turns(lobby_id) on delete cascade,
 actor_id uuid not null references auth.users(id),
 creature_instance_id text not null check(length(creature_instance_id) between 1 and 48),
 creature_name text not null references public.chaotic_preview_mugic_token_catalog(creature_name),
 starting_tokens smallint not null check(starting_tokens between 0 and 20),
 remaining_tokens smallint not null check(remaining_tokens between 0 and 20),
 official_match_modified boolean not null default false check(official_match_modified=false),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(lobby_id,actor_id),
 check(remaining_tokens<=starting_tokens)
);
alter table public.chaotic_preview_mugic_token_wallets enable row level security;
revoke all on public.chaotic_preview_mugic_token_wallets from public,anon,authenticated;
grant select on public.chaotic_preview_mugic_token_wallets to authenticated;
create policy chaotic_preview_mugic_token_wallet_owner_read
 on public.chaotic_preview_mugic_token_wallets for select to authenticated
 using(actor_id=(select auth.uid()) and exists(
 select 1 from public.chaotic_match_turns m
 where m.lobby_id=chaotic_preview_mugic_token_wallets.lobby_id
 and (m.host_id=(select auth.uid()) or m.guest_id=(select auth.uid()))
 ));

create table if not exists public.chaotic_preview_mugic_token_settlements (
 lobby_id uuid not null,
 turn_no integer not null check(turn_no between 1 and 120),
 attacker_id uuid not null references auth.users(id),
 defender_id uuid not null references auth.users(id),
 attacker_tokens_before smallint not null check(attacker_tokens_before between 1 and 20),
 attacker_tokens_after smallint not null check(attacker_tokens_after between 0 and 20),
 defender_tokens_before smallint not null check(defender_tokens_before between 2 and 20),
 defender_tokens_after smallint not null check(defender_tokens_after between 0 and 20),
 creation_cost smallint not null default 1 check(creation_cost=1),
 rejection_cost smallint not null default 2 check(rejection_cost=2),
 outcome text not null default 'creation_negated_training_only'
   check(outcome='creation_negated_training_only'),
 tokens_verified boolean not null default true check(tokens_verified=true),
 training_tokens_debited boolean not null default true check(training_tokens_debited=true),
 official_match_modified boolean not null default false check(official_match_modified=false),
 original_card_consumed boolean not null default false check(original_card_consumed=false),
 actual_mugic_effect_executed boolean not null default false check(actual_mugic_effect_executed=false),
 created_at timestamptz not null default now(),
 primary key(lobby_id,turn_no),
 foreign key(lobby_id,turn_no) references public.chaotic_preview_burst_mugic_counterplans(lobby_id,turn_no)
  on delete cascade,
 check(attacker_id<>defender_id),
 check(attacker_tokens_after=attacker_tokens_before-creation_cost),
 check(defender_tokens_after=defender_tokens_before-rejection_cost)
);
alter table public.chaotic_preview_mugic_token_settlements enable row level security;
revoke all on public.chaotic_preview_mugic_token_settlements from public,anon,authenticated;
grant select on public.chaotic_preview_mugic_token_settlements to authenticated;
create policy chaotic_preview_mugic_settlement_member_read
 on public.chaotic_preview_mugic_token_settlements for select to authenticated using(
 exists(select 1 from public.chaotic_match_turns m
 where m.lobby_id=chaotic_preview_mugic_token_settlements.lobby_id
 and (m.host_id=(select auth.uid()) or m.guest_id=(select auth.uid()))
 ));

alter table public.chaotic_preview_burst_mugic_intents
 drop constraint chaotic_preview_burst_mugic_intents_intent_status_check;
alter table public.chaotic_preview_burst_mugic_intents
 add constraint chaotic_preview_burst_mugic_intents_intent_status_check
 check(intent_status in ('queued_unexecuted','cancelled','resolved_training'));
alter table public.chaotic_preview_burst_mugic_intents
 drop constraint chaotic_preview_burst_mugic_intents_check;
alter table public.chaotic_preview_burst_mugic_intents
 add constraint chaotic_preview_burst_mugic_intents_check
 check(
 (intent_status='queued_unexecuted' and cancelled_at is null)
 or (intent_status='cancelled' and cancelled_at is not null)
 or (intent_status='resolved_training' and cancelled_at is null)
 );

create or replace function public.chaotic_prepare_preview_mugic_token_wallet(
 p_lobby_id uuid, p_expected_turn integer
) returns public.chaotic_preview_mugic_token_wallets
language plpgsql security definer set search_path=''
as $fn$
declare actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 unit public.chaotic_preview_loadouts;
 canonical public.chaotic_preview_mugic_token_catalog;
 result public.chaotic_preview_mugic_token_wallets;
begin
 if actor is null then raise exception 'Faça login';end if;
 if p_lobby_id is null or p_expected_turn is null or p_expected_turn not between 1 and 120
 then raise exception 'Turno inválido';end if;
 select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id for update;
 if not found or m.status<>'active' or m.turn_no<>p_expected_turn
 or actor not in (m.host_id,m.guest_id)
 then raise exception 'Somente participante do turno atual pode preparar fichas';end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.mode<>'1x1' or l.status<>'ready' or l.expires_at<=now()
 or l.host_id is distinct from m.host_id or l.guest_id is distinct from m.guest_id
 then raise exception 'Sala 1x1 não disponível';end if;
 select * into unit from public.chaotic_preview_loadouts
 where lobby_id=p_lobby_id and actor_id=actor;
 if not found or unit.position<>6 then
 raise exception 'Prepare sua criatura 1x1 antes das fichas de treino';end if;
 select * into canonical from public.chaotic_preview_mugic_token_catalog
 where creature_name=unit.creature_name;
 if not found then raise exception 'Criatura fora do catálogo original de fichas';end if;
 insert into public.chaotic_preview_mugic_token_wallets
 (lobby_id,actor_id,creature_instance_id,creature_name,starting_tokens,remaining_tokens)
 values(p_lobby_id,actor,unit.card_instance_id,unit.creature_name,
  canonical.starting_tokens,canonical.starting_tokens)
 on conflict(lobby_id,actor_id) do nothing;
 select * into result from public.chaotic_preview_mugic_token_wallets
 where lobby_id=p_lobby_id and actor_id=actor;
 if not found or result.creature_instance_id is distinct from unit.card_instance_id
 or result.creature_name is distinct from unit.creature_name
 then raise exception 'Carteira vinculada a uma criatura diferente; reinicialização proibida';end if;
 return result;
end;
$fn$;
revoke all on function public.chaotic_prepare_preview_mugic_token_wallet(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_prepare_preview_mugic_token_wallet(uuid,integer)
 to authenticated;

create or replace function public.chaotic_simulate_preview_mugic_counter_cost(
 p_lobby_id uuid,p_expected_turn integer
) returns public.chaotic_preview_mugic_token_settlements
language plpgsql security definer set search_path=''
as $fn$
declare actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 w public.chaotic_preview_burst_windows;
 pr public.chaotic_preview_burst_priority;
 plan public.chaotic_preview_burst_mugic_counterplans;
 creation public.chaotic_preview_burst_mugic_intents;
 rejection public.chaotic_preview_burst_mugic_intents;
 wallet_a public.chaotic_preview_mugic_token_wallets;
 wallet_d public.chaotic_preview_mugic_token_wallets;
 unit_a public.chaotic_preview_loadouts;
 unit_d public.chaotic_preview_loadouts;
 result public.chaotic_preview_mugic_token_settlements;
 changed integer;
begin
 if actor is null then raise exception 'Faça login';end if;
 if p_lobby_id is null or p_expected_turn is null or p_expected_turn not between 1 and 120
 then raise exception 'Turno inválido';end if;
 select * into m from public.chaotic_match_turns
 where lobby_id=p_lobby_id for update;
 if not found or m.status<>'active' or m.turn_no<>p_expected_turn
  or m.current_player is distinct from actor
  or actor not in (m.host_id,m.guest_id)
 then raise exception 'Somente atacante pode simular custo em sua vez';end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.mode<>'1x1' or l.status<>'ready'
  or l.expires_at<=now() or l.host_id is distinct from m.host_id
  or l.guest_id is distinct from m.guest_id
 then raise exception 'Sala 1x1 não disponível';end if;
 select * into w from public.chaotic_preview_burst_windows
 where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 if not found or w.attacker_id is distinct from actor
  or w.defender_id not in (m.host_id,m.guest_id) or w.defender_id=actor
  or w.status not in ('defender_passed','defender_immunity_noted')
  or w.defender_responded_at is null
 then raise exception 'Janela Burst não pronta';end if;
 select * into pr from public.chaotic_preview_burst_priority
 where lobby_id=p_lobby_id and turn_no=p_expected_turn for update;
 if not found or pr.priority_status<>'closed_preview' or pr.consecutive_passes<>2
  or pr.attacker_id is distinct from actor or pr.defender_id is distinct from w.defender_id
 then raise exception 'Prioridades não encerradas';end if;
 select * into plan from public.chaotic_preview_burst_mugic_counterplans
 where lobby_id=p_lobby_id and turn_no=p_expected_turn for update;
 if not found or plan.attacker_id is distinct from actor
  or plan.defender_id is distinct from w.defender_id
  or plan.required_creation_tokens<>1 or plan.required_rejection_tokens<>2
  or plan.token_balance_verified or plan.consumes_tokens
  or plan.effect_executed or plan.official_match_modified or plan.final_damage_verified
 then raise exception 'Contra-plano experimental inválido';end if;
 if exists(select 1 from public.chaotic_preview_mugic_token_settlements
 where lobby_id=p_lobby_id and turn_no=p_expected_turn)
 then raise exception 'Custos de Mugic já processados para este turno';end if;
 if exists(select 1 from public.chaotic_preview_burst_order_plans
 where lobby_id=p_lobby_id and turn_no=p_expected_turn)
 or exists(select 1 from public.chaotic_preview_individual_damage
 where lobby_id=p_lobby_id and turn_no=p_expected_turn)
 then raise exception 'Dano/ordem já iniciados';end if;
 select * into creation from public.chaotic_preview_burst_mugic_intents
 where lobby_id=p_lobby_id and turn_no=p_expected_turn and actor_id=actor;
 select * into rejection from public.chaotic_preview_burst_mugic_intents
 where lobby_id=p_lobby_id and turn_no=p_expected_turn and actor_id=w.defender_id;
 if creation.intent_status is distinct from 'queued_unexecuted'
  or rejection.intent_status is distinct from 'queued_unexecuted'
  or creation.catalog_mugic_id is distinct from '301'
  or rejection.catalog_mugic_id is distinct from '302'
  or creation.card_instance_id is distinct from plan.creation_instance_id
  or rejection.card_instance_id is distinct from plan.rejection_instance_id
  or creation.consumes_card or creation.consumes_tokens or creation.applied_to_official_match
  or rejection.consumes_card or rejection.consumes_tokens or rejection.applied_to_official_match
 then raise exception 'As duas Mugics originais não estão mais pendentes';end if;
 select * into unit_a from public.chaotic_preview_loadouts
 where lobby_id=p_lobby_id and actor_id=actor;
 select * into unit_d from public.chaotic_preview_loadouts
 where lobby_id=p_lobby_id and actor_id=w.defender_id;
 select * into wallet_a from public.chaotic_preview_mugic_token_wallets
 where lobby_id=p_lobby_id and actor_id=actor for update;
 select * into wallet_d from public.chaotic_preview_mugic_token_wallets
 where lobby_id=p_lobby_id and actor_id=w.defender_id for update;
 if wallet_a.creature_instance_id is distinct from unit_a.card_instance_id
  or wallet_d.creature_instance_id is distinct from unit_d.card_instance_id
  or wallet_a.creature_name is distinct from unit_a.creature_name
  or wallet_d.creature_name is distinct from unit_d.creature_name
  or wallet_a.remaining_tokens is null or wallet_d.remaining_tokens is null
 then raise exception 'Cada participante precisa preparar sua carteira de treino';end if;
 if wallet_a.remaining_tokens<1 or wallet_d.remaining_tokens<2
 then raise exception 'Fichas insuficientes: Criação exige 1 e Rejeição exige 2';end if;
 update public.chaotic_preview_mugic_token_wallets
 set remaining_tokens=remaining_tokens-1,updated_at=now()
 where lobby_id=p_lobby_id and actor_id=actor;
 update public.chaotic_preview_mugic_token_wallets
 set remaining_tokens=remaining_tokens-2,updated_at=now()
 where lobby_id=p_lobby_id and actor_id=w.defender_id;
 insert into public.chaotic_preview_mugic_token_settlements(
 lobby_id,turn_no,attacker_id,defender_id,
 attacker_tokens_before,attacker_tokens_after,
 defender_tokens_before,defender_tokens_after
 ) values(p_lobby_id,p_expected_turn,actor,w.defender_id,
 wallet_a.remaining_tokens,wallet_a.remaining_tokens-1,
 wallet_d.remaining_tokens,wallet_d.remaining_tokens-2)
 returning * into result;
 update public.chaotic_preview_burst_mugic_intents
 set intent_status='resolved_training'
 where lobby_id=p_lobby_id and turn_no=p_expected_turn
  and actor_id in (actor,w.defender_id)
  and intent_status='queued_unexecuted';
 get diagnostics changed=row_count;
 if changed<>2 then raise exception 'Inconsistência das duas declarações; cancelando transação';end if;
 return result;
end;
$fn$;
revoke all on function public.chaotic_simulate_preview_mugic_counter_cost(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_simulate_preview_mugic_counter_cost(uuid,integer)
 to authenticated;
do $pub$
begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime'
 and schemaname='public' and tablename='chaotic_preview_mugic_token_wallets')
 then alter publication supabase_realtime add table public.chaotic_preview_mugic_token_wallets;end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime'
 and schemaname='public' and tablename='chaotic_preview_mugic_token_settlements')
 then alter publication supabase_realtime add table public.chaotic_preview_mugic_token_settlements;end if;
end $pub$;