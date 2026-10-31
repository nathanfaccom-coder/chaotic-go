-- Chaotic GO v0.1.28 — server-authenticated Mugic INTENTS in a Burst priority round.
-- Own saved deck + album are checked, but album is user-editable and NOT proof of issuer ownership.
-- NO tokens, Mugic, damage, official status, original cards or rewards are consumed.
create table if not exists public.chaotic_preview_burst_mugic_intents (
 lobby_id uuid not null, turn_no integer not null check(turn_no between 1 and 120),
 actor_id uuid not null references auth.users(id),
 card_instance_id text not null check(length(card_instance_id) between 1 and 48),
 catalog_mugic_id text not null check(catalog_mugic_id in ('301','302')),
 mugic_name text not null check(mugic_name in ('Canção da Criação','Canção da Rejeição')),
 intent_status text not null default 'queued_unexecuted'
   check(intent_status in ('queued_unexecuted','cancelled')),
 consumes_card boolean not null default false check(consumes_card=false),
 consumes_tokens boolean not null default false check(consumes_tokens=false),
 applied_to_official_match boolean not null default false check(applied_to_official_match=false),
 effect_executed boolean not null default false check(effect_executed=false),
 created_at timestamptz not null default now(),
 cancelled_at timestamptz,
 primary key(lobby_id,turn_no,actor_id),
 foreign key(lobby_id,turn_no) references public.chaotic_preview_burst_priority(lobby_id,turn_no)
   on delete cascade,
 check((intent_status='queued_unexecuted' and cancelled_at is null)
   or (intent_status='cancelled' and cancelled_at is not null))
);
alter table public.chaotic_preview_burst_mugic_intents enable row level security;
revoke all on public.chaotic_preview_burst_mugic_intents from public,anon,authenticated;
grant select on public.chaotic_preview_burst_mugic_intents to authenticated;
drop policy if exists chaotic_burst_mugic_private_read on public.chaotic_preview_burst_mugic_intents;
create policy chaotic_burst_mugic_private_read
 on public.chaotic_preview_burst_mugic_intents for select to authenticated using (
  actor_id=(select auth.uid()) and
  exists(select 1 from public.chaotic_match_turns m where m.lobby_id=chaotic_preview_burst_mugic_intents.lobby_id
   and ((select auth.uid())=m.host_id or (select auth.uid())=m.guest_id))
 );
-- Do not leak unplayed Mugic names to the opponent before execution.

create or replace function public.chaotic_queue_preview_burst_mugic(
 p_lobby_id uuid,p_expected_turn integer,p_catalog_mugic_id text
) returns public.chaotic_preview_burst_mugic_intents
language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 w public.chaotic_preview_burst_windows;
 p public.chaotic_preview_burst_priority;
 unit public.chaotic_preview_loadouts;
 deck jsonb; album jsonb; records jsonb;
 chosen_id text; chosen_name text; found_count integer; result public.chaotic_preview_burst_mugic_intents;
begin
 if actor is null then raise exception 'Faça login';end if;
 if p_lobby_id is null or p_expected_turn is null or p_expected_turn not between 1 and 120
 then raise exception 'Turno inválido';end if;
 if p_catalog_mugic_id not in ('301','302') or p_catalog_mugic_id is null
 then raise exception 'Apenas Mugics originais deste catálogo podem ser declaradas';end if;
 chosen_name:=case when p_catalog_mugic_id='301' then 'Canção da Criação'
  else 'Canção da Rejeição' end;
 select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id for update;
 if not found or m.status<>'active' or m.turn_no<>p_expected_turn
  or actor not in (m.host_id,m.guest_id)
 then raise exception 'Partida ou jogador não autorizado';end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.mode<>'1x1' or l.status<>'ready' or l.expires_at<=now()
  or l.host_id<>m.host_id or l.guest_id is distinct from m.guest_id
 then raise exception 'Sala 1x1 indisponível';end if;
 select * into w from public.chaotic_preview_burst_windows
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 if not found or w.attacker_id is distinct from m.current_player
  or w.defender_id not in (m.host_id,m.guest_id)
  or w.status not in ('defender_passed','defender_immunity_noted')
 then raise exception 'Janela Burst ainda não recebeu resposta inicial';end if;
 select * into p from public.chaotic_preview_burst_priority
  where lobby_id=p_lobby_id and turn_no=p_expected_turn for update;
 if not found or p.priority_status<>'awaiting_priority' or p.next_actor_id is distinct from actor
  or p.attacker_id is distinct from w.attacker_id or p.defender_id is distinct from w.defender_id
 then raise exception 'Não é sua prioridade para declarar Mugic';end if;
 if exists(select 1 from public.chaotic_preview_burst_order_plans
  where lobby_id=p_lobby_id and turn_no=p_expected_turn)
  or exists(select 1 from public.chaotic_preview_individual_damage
  where lobby_id=p_lobby_id and turn_no=p_expected_turn)
 then raise exception 'A inspeção ou dano já foi preparado';end if;
 if exists(select 1 from public.chaotic_preview_burst_mugic_intents
  where lobby_id=p_lobby_id and turn_no=p_expected_turn and actor_id=actor)
 then raise exception 'Uma única declaração experimental por jogador e janela';end if;
 select * into unit from public.chaotic_preview_loadouts
  where lobby_id=p_lobby_id and actor_id=actor;
 if not found then raise exception 'Prepare primeiro a criatura e seu Deck individual';end if;
 select g.data into deck from public.chaotic_game_nodes g
  where g.user_id=actor and g.node_path in (
   'decks/1x1_slot_'||unit.deck_slot::text,'decks/1x1_'||unit.deck_slot::text)
  order by (g.node_path='decks/1x1_slot_'||unit.deck_slot::text) desc limit 1;
 if deck is null or pg_catalog.jsonb_typeof(deck->'criaturas')<>'array'
  or deck->'criaturas'->>5 is distinct from unit.card_instance_id
  or pg_catalog.jsonb_typeof(deck->'mugics')<>'array'
 then raise exception 'Deck original de teste sem Mugics ou criatura correspondente';end if;
 select g.data into album from public.chaotic_game_nodes g
  where g.user_id=actor and g.node_path='album';
 if pg_catalog.jsonb_typeof(album)='array' then records:=album;
 elsif pg_catalog.jsonb_typeof(album)='object' then
  select coalesce(pg_catalog.jsonb_agg(e.value),'[]'::jsonb) into records
   from pg_catalog.jsonb_each(album) e;
 else raise exception 'Álbum privado inválido';end if;
 if pg_catalog.jsonb_typeof(records)<>'array' then
  raise exception 'Álbum de cartas inválido';end if;
 -- Check that one unique captured instance ID appears BOTH in the current
 -- saved Mugic slots and as a matching canonical original in this player's album.
 select count(*),min(j.id) into found_count,chosen_id
 from (
  select distinct cards.value as id
  from pg_catalog.jsonb_array_elements_text(deck->'mugics') cards(value)
  join pg_catalog.jsonb_array_elements(records) a(value)
   on a.value->>'id'=cards.value
  where cards.value is not null and pg_catalog.length(cards.value) between 1 and 48
   and a.value->>'tipoCarta'='Magia'
   and pg_catalog.lower(pg_catalog.btrim(a.value->>'nome'))=
     pg_catalog.lower(pg_catalog.btrim(chosen_name))
 ) j;
 if found_count<1 or chosen_id is null then
  raise exception 'Mugic não encontrada no Deck e álbum do jogador';end if;
 insert into public.chaotic_preview_burst_mugic_intents(
  lobby_id,turn_no,actor_id,card_instance_id,catalog_mugic_id,mugic_name
 ) values(p_lobby_id,p_expected_turn,actor,chosen_id,p_catalog_mugic_id,chosen_name)
 returning * into result;
 return result;
end;
$fn$;
revoke all on function public.chaotic_queue_preview_burst_mugic(uuid,integer,text)
 from public,anon,authenticated;
grant execute on function public.chaotic_queue_preview_burst_mugic(uuid,integer,text) to authenticated;

create or replace function public.chaotic_cancel_preview_burst_mugic(
 p_lobby_id uuid,p_expected_turn integer
) returns public.chaotic_preview_burst_mugic_intents
language plpgsql security definer set search_path=''
as $fn$
declare actor uuid:=auth.uid(); m public.chaotic_match_turns;
 w public.chaotic_preview_burst_windows;
 result public.chaotic_preview_burst_mugic_intents;
begin
 if actor is null then raise exception 'Faça login';end if;
 if p_lobby_id is null or p_expected_turn is null or p_expected_turn not between 1 and 120
 then raise exception 'Turno inválido';end if;
 select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id for update;
 if not found or m.status<>'active' or m.turn_no<>p_expected_turn
  or actor not in (m.host_id,m.guest_id)
 then raise exception 'Partida ou usuário inválido';end if;
 select * into w from public.chaotic_preview_burst_windows
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 if not found or w.attacker_id is distinct from m.current_player
  or actor not in (w.attacker_id,w.defender_id)
 then raise exception 'Janela Burst inválida';end if;
 if exists(select 1 from public.chaotic_preview_burst_order_plans
   where lobby_id=p_lobby_id and turn_no=p_expected_turn)
  or exists(select 1 from public.chaotic_preview_individual_damage
   where lobby_id=p_lobby_id and turn_no=p_expected_turn)
 then raise exception 'Inspeção ou cálculo já ocorreu';end if;
 update public.chaotic_preview_burst_mugic_intents
 set intent_status='cancelled',cancelled_at=now()
 where lobby_id=p_lobby_id and turn_no=p_expected_turn
  and actor_id=actor and intent_status='queued_unexecuted'
 returning * into result;
 if not found then raise exception 'Nenhuma Mugic sua aguarda cancelamento';end if;
 return result;
end;
$fn$;
revoke all on function public.chaotic_cancel_preview_burst_mugic(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_cancel_preview_burst_mugic(uuid,integer) to authenticated;

do $publication$
begin
 if not exists(select 1 from pg_publication_tables
  where pubname='supabase_realtime' and schemaname='public'
   and tablename='chaotic_preview_burst_mugic_intents')
 then alter publication supabase_realtime
   add table public.chaotic_preview_burst_mugic_intents;end if;
end $publication$;