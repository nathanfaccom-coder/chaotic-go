-- Chaotic GO v0.1.33 — isolated 3x3 allied-creature snapshot and Alakazaz transfer.
-- Original source: cartas.js, Alakazaz "Você pode pegar as fichas de habilidade
-- deste campeão e distribuir elas entre os campeões que você controla."
-- ONE token per successful activation, 1 activation per actor/turn in preview.
-- No existing 1x1 data, game nodes, official combat, XP, coin or original art is changed.

create table if not exists public.chaotic_preview_3x3_allies (
 lobby_id uuid not null references public.chaotic_match_turns(lobby_id) on delete cascade,
 actor_id uuid not null references auth.users(id),
 position smallint not null check(position between 4 and 6),
 deck_slot smallint not null check(deck_slot between 1 and 3),
 creature_instance_id text not null check(length(creature_instance_id) between 1 and 48),
 creature_name text not null references public.chaotic_preview_mugic_token_catalog(creature_name),
 starting_tokens smallint not null check(starting_tokens between 0 and 20),
 remaining_tokens smallint not null check(remaining_tokens between 0 and 20),
 received_tokens smallint not null default 0 check(received_tokens between 0 and 20),
 official_match_modified boolean not null default false check(official_match_modified=false),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(lobby_id,actor_id,position),
 unique(lobby_id,actor_id,creature_instance_id),
 check(remaining_tokens<=starting_tokens+received_tokens)
);
alter table public.chaotic_preview_3x3_allies enable row level security;
revoke all on public.chaotic_preview_3x3_allies from public,anon,authenticated;
grant select on public.chaotic_preview_3x3_allies to authenticated;
create policy chaotic_preview_3x3_allies_member_read
on public.chaotic_preview_3x3_allies for select to authenticated using (
 exists(select 1 from public.chaotic_match_turns m
 where m.lobby_id=chaotic_preview_3x3_allies.lobby_id
 and ((select auth.uid())=m.host_id or (select auth.uid())=m.guest_id))
);

create table if not exists public.chaotic_preview_3x3_token_transfers(
 lobby_id uuid not null,
 turn_no integer not null check(turn_no between 1 and 120),
 actor_id uuid not null references auth.users(id),
 donor_position smallint not null check(donor_position between 4 and 6),
 receiver_position smallint not null check(receiver_position between 4 and 6),
 donor_creature_instance_id text not null check(length(donor_creature_instance_id) between 1 and 48),
 receiver_creature_instance_id text not null check(length(receiver_creature_instance_id) between 1 and 48),
 donor_creature_name text not null default 'Alakazaz' check(donor_creature_name='Alakazaz'),
 tokens_moved smallint not null default 1 check(tokens_moved=1),
 donor_before smallint not null check(donor_before between 1 and 20),
 donor_after smallint not null check(donor_after between 0 and 20),
 receiver_before smallint not null check(receiver_before between 0 and 19),
 receiver_after smallint not null check(receiver_after between 1 and 20),
 original_card_consumed boolean not null default false check(original_card_consumed=false),
 official_tokens_changed boolean not null default false check(official_tokens_changed=false),
 official_match_modified boolean not null default false check(official_match_modified=false),
 created_at timestamptz not null default now(),
 primary key(lobby_id,turn_no,actor_id),
 foreign key(lobby_id,actor_id,donor_position)
 references public.chaotic_preview_3x3_allies(lobby_id,actor_id,position) on delete cascade,
 foreign key(lobby_id,actor_id,receiver_position)
 references public.chaotic_preview_3x3_allies(lobby_id,actor_id,position) on delete cascade,
 check(donor_position<>receiver_position),
 check(donor_creature_instance_id<>receiver_creature_instance_id),
 check(donor_after=donor_before-1 and receiver_after=receiver_before+1)
);
alter table public.chaotic_preview_3x3_token_transfers enable row level security;
revoke all on public.chaotic_preview_3x3_token_transfers from public,anon,authenticated;
grant select on public.chaotic_preview_3x3_token_transfers to authenticated;
create policy chaotic_preview_3x3_transfers_member_read
on public.chaotic_preview_3x3_token_transfers for select to authenticated using(
 exists(select 1 from public.chaotic_match_turns m
 where m.lobby_id=chaotic_preview_3x3_token_transfers.lobby_id
 and ((select auth.uid())=m.host_id or (select auth.uid())=m.guest_id))
);

create or replace function public.chaotic_prepare_preview_3x3_allies(
 p_lobby_id uuid,p_expected_turn integer,p_deck_slot integer
) returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 deck jsonb;
 album jsonb;
 records jsonb;
 selected_creatures jsonb;
 one_card jsonb;
 card_id text;
 card_position integer;
 card_count integer;
 cap_tokens smallint;
 card_name text;
 inserted integer:=0;
begin
 if actor is null then raise exception 'Faça login';end if;
 if p_lobby_id is null or p_expected_turn is null or p_expected_turn not between 1 and 120
  or p_deck_slot is null or p_deck_slot not between 1 and 3
 then raise exception 'Parâmetros da preparação 3x3 inválidos';end if;
 select * into m from public.chaotic_match_turns
 where lobby_id=p_lobby_id for update;
 if not found or m.status<>'active' or m.turn_no<>p_expected_turn
   or m.current_player is distinct from actor
   or actor not in (m.host_id,m.guest_id)
 then raise exception 'Apenas o participante da vez pode preparar seu Deck 3x3';end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.mode<>'3x3' or l.status<>'ready' or l.expires_at<=now()
  or l.host_id is distinct from m.host_id or l.guest_id is distinct from m.guest_id
 then raise exception 'Sala 3x3 ainda não está pronta';end if;
 if exists(select 1 from public.chaotic_preview_3x3_allies
   where lobby_id=p_lobby_id and actor_id=actor)
 then raise exception 'As três criaturas deste jogador já foram congeladas; recarga não permitida';end if;
 if exists(select 1 from public.chaotic_preview_3x3_token_transfers
   where lobby_id=p_lobby_id)
 then raise exception 'A partida já possui transferências de treino';end if;
 select g.data into deck from public.chaotic_game_nodes g
 where g.user_id=actor
   and g.node_path in ('decks/3x3_slot_'||p_deck_slot::text,'decks/3x3_'||p_deck_slot::text)
 order by (g.node_path='decks/3x3_slot_'||p_deck_slot::text) desc limit 1;
 if deck is null or pg_catalog.jsonb_typeof(deck->'criaturas')<>'array'
  or pg_catalog.jsonb_array_length(deck->'criaturas')<6
 then raise exception 'Salve um Deck 3x3 completo primeiro';end if;
 selected_creatures:=deck->'criaturas';
 select g.data into album from public.chaotic_game_nodes g
 where g.user_id=actor and g.node_path='album';
 if pg_catalog.jsonb_typeof(album)='array' then records:=album;
 elsif pg_catalog.jsonb_typeof(album)='object' then
  select coalesce(pg_catalog.jsonb_agg(x.value),'[]'::jsonb) into records
  from pg_catalog.jsonb_each(album) x;
 else raise exception 'Álbum de cartas do próprio jogador inválido';end if;
 if records is null or pg_catalog.jsonb_typeof(records)<>'array'
 then raise exception 'Álbum ilegível';end if;

 for card_position in 4..6 loop
  card_id:=selected_creatures->>(card_position-1);
  if card_id is null or card_id='' or card_id='null'
   or length(card_id)>48 or card_id !~ '^[a-zA-Z0-9_-]+$'
  then raise exception 'Falta criatura original válida na posição c%',card_position;end if;
  if card_id=selected_creatures->>3 and card_position<>4
    or card_id=selected_creatures->>4 and card_position<>5
  then raise exception 'Uma carta não pode ocupar dois slots';end if;
  select count(*),min(x.value::text)::jsonb into card_count,one_card
    from pg_catalog.jsonb_array_elements(records) x(value)
    where x.value->>'id'=card_id and x.value->>'tipoCarta'='Criatura';
  if card_count<>1 then raise exception 'Criatura no slot c% não pertence de forma única ao álbum',card_position;end if;
  card_name:=one_card->>'nome';
  if nullif(card_name,'') is null then raise exception 'Criatura sem nome';end if;
  select c.starting_tokens into cap_tokens
   from public.chaotic_preview_mugic_token_catalog c where c.creature_name=card_name;
  if cap_tokens is null then
   raise exception 'Criatura fora do catálogo original autorizado: %',card_name;end if;
  insert into public.chaotic_preview_3x3_allies(
   lobby_id,actor_id,position,deck_slot,creature_instance_id,creature_name,
   starting_tokens,remaining_tokens
  ) values(p_lobby_id,actor,card_position,p_deck_slot,card_id,card_name,cap_tokens,cap_tokens);
  inserted:=inserted+1;
 end loop;
 return pg_catalog.jsonb_build_object('status','captured_3x3_training_only',
 'count',inserted,'mode','3x3','official_match_modified',false);
end;
$fn$;
revoke all on function public.chaotic_prepare_preview_3x3_allies(uuid,integer,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_prepare_preview_3x3_allies(uuid,integer,integer) to authenticated;

create or replace function public.chaotic_transfer_preview_alakazaz_token(
 p_lobby_id uuid,p_expected_turn integer,p_receiver_position integer
) returns public.chaotic_preview_3x3_token_transfers
language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 donor public.chaotic_preview_3x3_allies;
 recipient public.chaotic_preview_3x3_allies;
 event_row public.chaotic_preview_3x3_token_transfers;
begin
 if actor is null then raise exception 'Faça login';end if;
 if p_lobby_id is null or p_expected_turn is null or p_expected_turn not between 1 and 120
  or p_receiver_position is null or p_receiver_position not between 4 and 6
 then raise exception 'Turno ou alvo 3x3 inválido';end if;
 select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id for update;
 if not found or m.status<>'active' or m.turn_no<>p_expected_turn
 or m.current_player is distinct from actor
 or actor not in (m.host_id,m.guest_id)
 then raise exception 'Só é permitido transferir na própria vez';end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.mode<>'3x3' or l.status<>'ready' or l.expires_at<=now()
  or l.host_id is distinct from m.host_id or l.guest_id is distinct from m.guest_id
 then raise exception 'Sala 3x3 indisponível';end if;
 if (select count(*) from public.chaotic_preview_3x3_allies
    where lobby_id=p_lobby_id and actor_id=actor)<>3
 then raise exception 'Prepare as três criaturas do seu próprio Deck 3x3';end if;
 if exists(select 1 from public.chaotic_preview_3x3_token_transfers
  where lobby_id=p_lobby_id and turn_no=p_expected_turn and actor_id=actor)
 then raise exception 'Alakazaz já transferiu neste turno de treinamento';end if;
 if exists(select 1 from public.chaotic_preview_clashes
  where lobby_id=p_lobby_id and turn_no=p_expected_turn)
  or exists(select 1 from public.chaotic_preview_burst_windows
  where lobby_id=p_lobby_id and turn_no=p_expected_turn)
 then raise exception 'Transferência só ocorre antes de um confronto/Burst';end if;

 select * into donor from public.chaotic_preview_3x3_allies
  where lobby_id=p_lobby_id and actor_id=actor
    and creature_name='Alakazaz' order by position limit 1 for update;
 if not found or donor.remaining_tokens<1 then
  raise exception 'Alakazaz não possui ficha para transferir';end if;
 if donor.position=p_receiver_position then
   raise exception 'Alakazaz só pode doar para outro campeão aliado';end if;
 select * into recipient from public.chaotic_preview_3x3_allies
 where lobby_id=p_lobby_id and actor_id=actor and position=p_receiver_position for update;
 if not found or recipient.creature_instance_id=donor.creature_instance_id
  or recipient.remaining_tokens>=20
 then raise exception 'Destinatário aliado inválido ou sem espaço para ficha';end if;

 update public.chaotic_preview_3x3_allies set
  remaining_tokens=donor.remaining_tokens-1,updated_at=now()
 where lobby_id=p_lobby_id and actor_id=actor and position=donor.position;
 update public.chaotic_preview_3x3_allies set
  remaining_tokens=recipient.remaining_tokens+1,
  received_tokens=recipient.received_tokens+1,updated_at=now()
 where lobby_id=p_lobby_id and actor_id=actor and position=recipient.position;

 insert into public.chaotic_preview_3x3_token_transfers(
  lobby_id,turn_no,actor_id,donor_position,receiver_position,
  donor_creature_instance_id,receiver_creature_instance_id,
  donor_before,donor_after,receiver_before,receiver_after
 ) values (p_lobby_id,p_expected_turn,actor,donor.position,recipient.position,
  donor.creature_instance_id,recipient.creature_instance_id,
  donor.remaining_tokens,donor.remaining_tokens-1,
  recipient.remaining_tokens,recipient.remaining_tokens+1)
 returning * into event_row;
 return event_row;
end;
$fn$;
revoke all on function public.chaotic_transfer_preview_alakazaz_token(uuid,integer,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_transfer_preview_alakazaz_token(uuid,integer,integer) to authenticated;
do $pub$
begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime'
 and schemaname='public' and tablename='chaotic_preview_3x3_allies')
 then alter publication supabase_realtime add table public.chaotic_preview_3x3_allies;end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime'
 and schemaname='public' and tablename='chaotic_preview_3x3_token_transfers')
 then alter publication supabase_realtime add table public.chaotic_preview_3x3_token_transfers;end if;
end $pub$;