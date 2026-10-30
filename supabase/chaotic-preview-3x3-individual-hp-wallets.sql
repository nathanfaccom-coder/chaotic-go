-- Chaotic GO v0.1.34: individually seeded 3x3 TRAINING HP, by original captured card.
-- This is not the official combat HP and never damages, wins, or modifies a real card.
-- Positions c4,c5,c6 remain the allied formation slots (not simulated movement).
create table if not exists public.chaotic_preview_3x3_hp_wallets (
 lobby_id uuid not null,
 actor_id uuid not null references auth.users(id),
 position smallint not null check(position between 4 and 6),
 creature_instance_id text not null check(length(creature_instance_id) between 1 and 48),
 creature_name text not null check(length(creature_name) between 1 and 120),
 hp_initial integer not null check(hp_initial between 1 and 500),
 hp_max integer not null check(hp_max between 1 and 500),
 hp_remaining integer not null check(hp_remaining between 0 and 500),
 initialized_turn integer not null check(initialized_turn between 1 and 120),
 damage_events integer not null default 0 check(damage_events=0),
 healing_events integer not null default 0 check(healing_events=0),
 official_match_modified boolean not null default false check(official_match_modified=false),
 official_hp_changed boolean not null default false check(official_hp_changed=false),
 location_bonuses_applied boolean not null default false check(location_bonuses_applied=false),
 initialized_at timestamptz not null default now(),
 primary key(lobby_id,actor_id,position),
 foreign key(lobby_id,actor_id,position)
  references public.chaotic_preview_3x3_allies(lobby_id,actor_id,position) on delete cascade,
 check(hp_remaining<=hp_max),
 check(hp_initial=hp_max and hp_remaining=hp_initial)
);
alter table public.chaotic_preview_3x3_hp_wallets enable row level security;
revoke all on public.chaotic_preview_3x3_hp_wallets from public,anon,authenticated;
grant select on public.chaotic_preview_3x3_hp_wallets to authenticated;
drop policy if exists chaotic_preview_3x3_hp_members_read on public.chaotic_preview_3x3_hp_wallets;
create policy chaotic_preview_3x3_hp_members_read
 on public.chaotic_preview_3x3_hp_wallets for select to authenticated using (
 exists(select 1 from public.chaotic_match_turns m
 where m.lobby_id=chaotic_preview_3x3_hp_wallets.lobby_id
   and (m.host_id=(select auth.uid()) or m.guest_id=(select auth.uid())))
);

create or replace function public.chaotic_prepare_preview_3x3_hp(
 p_lobby_id uuid,p_expected_turn integer
) returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 ally public.chaotic_preview_3x3_allies;
 deck jsonb;
 album jsonb;
 records jsonb;
 original jsonb;
 saved_instance text;
 energy_text text;
 energy_value integer;
 matched integer;
 slot_no integer;
 allocated integer:=0;
begin
 if actor is null then raise exception 'Faça login';end if;
 if p_lobby_id is null or p_expected_turn is null or p_expected_turn not between 1 and 120
 then raise exception 'Turno de preparação de HP inválido';end if;
 select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id for update;
 if not found or m.status<>'active' or m.turn_no<>p_expected_turn
  or m.current_player is distinct from actor or actor not in (m.host_id,m.guest_id)
 then raise exception 'HP 3x3 só pode ser preparado pelo jogador da vez';end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.mode<>'3x3' or l.status<>'ready' or l.expires_at<=now()
  or l.host_id is distinct from m.host_id or l.guest_id is distinct from m.guest_id
 then raise exception 'Sala 3x3 de treinamento inválida ou expirada';end if;
 if (select count(*) from public.chaotic_preview_3x3_allies
   where lobby_id=p_lobby_id and actor_id=actor)<>3
 then raise exception 'Congele as três criaturas c4-c6 do seu próprio Deck primeiro';end if;
 if exists(select 1 from public.chaotic_preview_3x3_hp_wallets
   where lobby_id=p_lobby_id and actor_id=actor)
 then raise exception 'HP das criaturas já foi inicializado; reinicialização proibida';end if;
 select g.data into album from public.chaotic_game_nodes g
 where g.user_id=actor and g.node_path='album';
 if pg_catalog.jsonb_typeof(album)='array' then records:=album;
 elsif pg_catalog.jsonb_typeof(album)='object' then
  select coalesce(pg_catalog.jsonb_agg(v.value),'[]'::jsonb) into records
  from pg_catalog.jsonb_each(album) v;
 else raise exception 'Álbum individual de criaturas indisponível';end if;
 if records is null or pg_catalog.jsonb_typeof(records)<>'array'
 then raise exception 'Álbum individual inválido';end if;

 for slot_no in 4..6 loop
  select * into ally from public.chaotic_preview_3x3_allies
   where lobby_id=p_lobby_id and actor_id=actor and position=slot_no for update;
  if not found then raise exception 'Ausente a criatura própria c%',slot_no;end if;
  select g.data into deck from public.chaotic_game_nodes g
   where g.user_id=actor and g.node_path in (
    'decks/3x3_slot_'||ally.deck_slot::text,'decks/3x3_'||ally.deck_slot::text)
   order by (g.node_path='decks/3x3_slot_'||ally.deck_slot::text) desc limit 1;
  if deck is null or pg_catalog.jsonb_typeof(deck->'criaturas')<>'array'
   or pg_catalog.jsonb_array_length(deck->'criaturas')<6
  then raise exception 'Deck 3x3 original da c% não encontrado',slot_no;end if;
  saved_instance:=deck->'criaturas'->>(slot_no-1);
  if saved_instance is distinct from ally.creature_instance_id
  then raise exception 'A criatura c% divergiu do Deck congelado',slot_no;end if;
  select count(*),min(v.value::text)::jsonb into matched,original
  from pg_catalog.jsonb_array_elements(records) v(value)
  where v.value->>'id'=ally.creature_instance_id and v.value->>'tipoCarta'='Criatura';
  if matched<>1 or original->>'nome' is distinct from ally.creature_name
  then raise exception 'A criatura c% não confere com o álbum particular',slot_no;end if;
  if pg_catalog.jsonb_typeof(original->'stats')<>'object'
  then raise exception 'DNA individual da criatura c% ausente',slot_no;end if;
  energy_text:=original->'stats'->>'e';
  if energy_text is null or energy_text !~ '^[0-9]{1,3}$'
  then raise exception 'Energia individual c% inválida',slot_no;end if;
  energy_value:=energy_text::integer;
  if energy_value not between 1 and 500
  then raise exception 'Energia individual c% fora de 1-500',slot_no;end if;
  insert into public.chaotic_preview_3x3_hp_wallets(
   lobby_id,actor_id,position,creature_instance_id,creature_name,
   hp_initial,hp_max,hp_remaining,initialized_turn
  ) values(
   p_lobby_id,actor,slot_no,ally.creature_instance_id,ally.creature_name,
   energy_value,energy_value,energy_value,p_expected_turn
  );
  allocated:=allocated+1;
 end loop;
 return pg_catalog.jsonb_build_object('status','hp_3x3_training_seeded',
 'count',allocated,'official_match_modified',false,
 'location_bonuses_applied',false,'damage_applied',false);
end;
$fn$;
revoke all on function public.chaotic_prepare_preview_3x3_hp(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_prepare_preview_3x3_hp(uuid,integer) to authenticated;
do $pub$
begin
 if not exists(select 1 from pg_publication_tables
  where pubname='supabase_realtime' and schemaname='public'
   and tablename='chaotic_preview_3x3_hp_wallets')
 then alter publication supabase_realtime add table public.chaotic_preview_3x3_hp_wallets;end if;
end $pub$;