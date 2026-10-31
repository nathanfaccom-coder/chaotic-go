-- Chaotic GO v0.1.29 — non-executing LIFO counterplan for canonical original Mugics.
-- Only eligible pair: attacker queues Creation (301), defender queues Rejection (302).
-- This is a review/inspection ONLY: no actual counterspell, tokens or health consumed.
create table if not exists public.chaotic_preview_burst_mugic_counterplans (
 lobby_id uuid not null,
 turn_no integer not null check(turn_no between 1 and 120),
 attacker_id uuid not null references auth.users(id),
 defender_id uuid not null references auth.users(id),
 creation_instance_id text not null check(length(creation_instance_id) between 1 and 48),
 rejection_instance_id text not null check(length(rejection_instance_id) between 1 and 48),
 required_creation_tokens smallint not null default 1 check(required_creation_tokens=1),
 required_rejection_tokens smallint not null default 2 check(required_rejection_tokens=2),
 inspection_steps jsonb not null check(jsonb_typeof(inspection_steps)='array'
   and jsonb_array_length(inspection_steps)=2),
 inspection_status text not null default 'lifo_counter_review_only'
   check(inspection_status='lifo_counter_review_only'),
 hypothetical_creation_negated boolean not null default true check(hypothetical_creation_negated=true),
 token_balance_verified boolean not null default false check(token_balance_verified=false),
 consumes_tokens boolean not null default false check(consumes_tokens=false),
 consumes_cards boolean not null default false check(consumes_cards=false),
 effect_executed boolean not null default false check(effect_executed=false),
 official_match_modified boolean not null default false check(official_match_modified=false),
 final_damage_verified boolean not null default false check(final_damage_verified=false),
 created_at timestamptz not null default now(),
 primary key(lobby_id,turn_no),
 foreign key(lobby_id,turn_no) references public.chaotic_preview_burst_priority(lobby_id,turn_no)
    on delete cascade,
 check(attacker_id<>defender_id)
);
alter table public.chaotic_preview_burst_mugic_counterplans enable row level security;
revoke all on public.chaotic_preview_burst_mugic_counterplans from public,anon,authenticated;
grant select on public.chaotic_preview_burst_mugic_counterplans to authenticated;
drop policy if exists chaotic_burst_counterplan_member_read
 on public.chaotic_preview_burst_mugic_counterplans;
create policy chaotic_burst_counterplan_member_read
 on public.chaotic_preview_burst_mugic_counterplans
 for select to authenticated using (
 exists(select 1 from public.chaotic_match_turns m
 where m.lobby_id=chaotic_preview_burst_mugic_counterplans.lobby_id
 and ((select auth.uid())=m.host_id or (select auth.uid())=m.guest_id))
);

create or replace function public.chaotic_prepare_preview_mugic_counterplan(
 p_lobby_id uuid,p_expected_turn integer
) returns public.chaotic_preview_burst_mugic_counterplans
language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 w public.chaotic_preview_burst_windows;
 pr public.chaotic_preview_burst_priority;
 creation public.chaotic_preview_burst_mugic_intents;
 rejection public.chaotic_preview_burst_mugic_intents;
 plan public.chaotic_preview_burst_mugic_counterplans;
 counter integer;
begin
 if actor is null then raise exception 'Faça login';end if;
 if p_lobby_id is null or p_expected_turn is null
  or p_expected_turn not between 1 and 120 then
  raise exception 'Turno inválido';end if;
 select * into m from public.chaotic_match_turns
  where lobby_id=p_lobby_id for update;
 if not found or m.status<>'active' or m.turn_no<>p_expected_turn
    or m.current_player is distinct from actor
    or actor not in (m.host_id,m.guest_id)
 then raise exception 'Somente atacante pode inspecionar Mugics na própria vez';end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.mode<>'1x1' or l.status<>'ready'
    or l.expires_at<=now()
    or l.host_id is distinct from m.host_id
    or l.guest_id is distinct from m.guest_id
 then raise exception 'Sala de teste 1x1 não disponível';end if;
 select * into w from public.chaotic_preview_burst_windows
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 if not found or w.attacker_id is distinct from actor
    or w.defender_id not in (m.host_id,m.guest_id)
    or w.defender_id=actor
    or w.status not in ('defender_passed','defender_immunity_noted')
    or w.defender_responded_at is null
 then raise exception 'Janela Burst original ainda não foi respondida';end if;
 select * into pr from public.chaotic_preview_burst_priority
  where lobby_id=p_lobby_id and turn_no=p_expected_turn for update;
 if not found or pr.priority_status<>'closed_preview'
    or pr.consecutive_passes<>2
    or pr.attacker_id is distinct from actor
    or pr.defender_id is distinct from w.defender_id
    or (select count(*) from public.chaotic_preview_burst_priority_passes
       where lobby_id=p_lobby_id and turn_no=p_expected_turn)<>2
    or not exists(select 1 from public.chaotic_preview_burst_priority_passes
      where lobby_id=p_lobby_id and turn_no=p_expected_turn
        and pass_seq=1 and actor_id=actor)
    or not exists(select 1 from public.chaotic_preview_burst_priority_passes
      where lobby_id=p_lobby_id and turn_no=p_expected_turn
        and pass_seq=2 and actor_id=w.defender_id)
 then raise exception 'As duas prioridades precisam ser passadas na ordem correta';end if;
 if exists(select 1 from public.chaotic_preview_burst_mugic_counterplans
       where lobby_id=p_lobby_id and turn_no=p_expected_turn)
    or exists(select 1 from public.chaotic_preview_burst_order_plans
       where lobby_id=p_lobby_id and turn_no=p_expected_turn)
    or exists(select 1 from public.chaotic_preview_individual_damage
       where lobby_id=p_lobby_id and turn_no=p_expected_turn)
 then raise exception 'A prévia ou contra-plano já foi preparada';end if;
 select * into creation from public.chaotic_preview_burst_mugic_intents
  where lobby_id=p_lobby_id and turn_no=p_expected_turn
   and actor_id=actor and intent_status='queued_unexecuted';
 if not found or creation.catalog_mugic_id<>'301'
    or creation.mugic_name<>'Canção da Criação'
    or creation.consumes_card or creation.consumes_tokens
    or creation.applied_to_official_match or creation.effect_executed
 then raise exception 'Primeira Mugic deve ser Canção da Criação do atacante';end if;
 select * into rejection from public.chaotic_preview_burst_mugic_intents
  where lobby_id=p_lobby_id and turn_no=p_expected_turn
   and actor_id=w.defender_id and intent_status='queued_unexecuted';
 if not found or rejection.catalog_mugic_id<>'302'
    or rejection.mugic_name<>'Canção da Rejeição'
    or rejection.consumes_card or rejection.consumes_tokens
    or rejection.applied_to_official_match or rejection.effect_executed
 then raise exception 'A resposta deve ser Canção da Rejeição do defensor';end if;
 if rejection.created_at < creation.created_at then
   raise exception 'Ordem de declaração das Mugics inválida';end if;
 select count(*) into counter from public.chaotic_preview_burst_mugic_intents
 where lobby_id=p_lobby_id and turn_no=p_expected_turn
   and intent_status='queued_unexecuted';
 if counter<>2 then raise exception 'Contra-plano exige exatamente duas Mugics';end if;
 insert into public.chaotic_preview_burst_mugic_counterplans(
  lobby_id,turn_no,attacker_id,defender_id,creation_instance_id,
  rejection_instance_id,inspection_steps
 ) values(
  p_lobby_id,p_expected_turn,actor,w.defender_id,
  creation.card_instance_id,rejection.card_instance_id,
  pg_catalog.jsonb_build_array(
   pg_catalog.jsonb_build_object('reverse_order',1,
     'actor','defender','catalog_mugic_id','302',
     'name','Canção da Rejeição','operation','inspect_counter_to_creation',
     'executed',false,'tokens_spent',0),
   pg_catalog.jsonb_build_object('reverse_order',2,
     'actor','attacker','catalog_mugic_id','301',
     'name','Canção da Criação','operation','inspect_hypothetically_negated',
     'executed',false,'tokens_spent',0)
  )
 ) returning * into plan;
 return plan;
end;
$fn$;
revoke all on function public.chaotic_prepare_preview_mugic_counterplan(uuid,integer)
  from public,anon,authenticated;
grant execute on function public.chaotic_prepare_preview_mugic_counterplan(uuid,integer)
  to authenticated;
do $pub$
begin
 if not exists(select 1 from pg_publication_tables where
    pubname='supabase_realtime' and schemaname='public'
    and tablename='chaotic_preview_burst_mugic_counterplans')
 then alter publication supabase_realtime
   add table public.chaotic_preview_burst_mugic_counterplans;end if;
end $pub$;