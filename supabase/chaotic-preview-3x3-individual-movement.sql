-- Chaotic GO v0.1.35: 3x3 six-hex-per-side MOVEMENT PREVIEW (not the official board).
-- Formation slots c4-c6 are IMMUTABLE card identities; board positions 1..6 are mutable.
-- Adjacent topology follows the existing DROME preview-board neighbors. No opponent
-- side collisions, attacks, HP, official match state, album, rewards or artwork changed.

create table if not exists public.chaotic_preview_3x3_board_positions (
 lobby_id uuid not null,
 actor_id uuid not null references auth.users(id),
 formation_slot smallint not null check(formation_slot between 4 and 6),
 creature_instance_id text not null check(length(creature_instance_id) between 1 and 48),
 hex_position smallint not null check(hex_position between 1 and 6),
 moved_turn integer not null default 0 check(moved_turn between 0 and 120),
 official_position_changed boolean not null default false check(official_position_changed=false),
 official_match_modified boolean not null default false check(official_match_modified=false),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(lobby_id,actor_id,formation_slot),
 unique(lobby_id,actor_id,hex_position),
 foreign key(lobby_id,actor_id,formation_slot)
   references public.chaotic_preview_3x3_hp_wallets(lobby_id,actor_id,position)
   on delete cascade
);
alter table public.chaotic_preview_3x3_board_positions enable row level security;
revoke all on public.chaotic_preview_3x3_board_positions from public,anon,authenticated;
grant select on public.chaotic_preview_3x3_board_positions to authenticated;
create policy chaotic_preview_3x3_board_members_read
 on public.chaotic_preview_3x3_board_positions for select to authenticated using (
  exists(select 1 from public.chaotic_match_turns m
    where m.lobby_id=chaotic_preview_3x3_board_positions.lobby_id
      and (m.host_id=(select auth.uid()) or m.guest_id=(select auth.uid())))
 );

create table if not exists public.chaotic_preview_3x3_move_events (
 lobby_id uuid not null,
 turn_no integer not null check(turn_no between 1 and 120),
 actor_id uuid not null references auth.users(id),
 formation_slot smallint not null check(formation_slot between 4 and 6),
 creature_instance_id text not null check(length(creature_instance_id) between 1 and 48),
 from_hex smallint not null check(from_hex between 1 and 6),
 to_hex smallint not null check(to_hex between 1 and 6),
 official_position_changed boolean not null default false check(official_position_changed=false),
 official_match_modified boolean not null default false check(official_match_modified=false),
 damage_applied boolean not null default false check(damage_applied=false),
 created_at timestamptz not null default now(),
 primary key(lobby_id,turn_no,actor_id),
 foreign key(lobby_id,actor_id,formation_slot)
   references public.chaotic_preview_3x3_board_positions(lobby_id,actor_id,formation_slot)
   on delete cascade,
 check(from_hex<>to_hex)
);
alter table public.chaotic_preview_3x3_move_events enable row level security;
revoke all on public.chaotic_preview_3x3_move_events from public,anon,authenticated;
grant select on public.chaotic_preview_3x3_move_events to authenticated;
create policy chaotic_preview_3x3_move_members_read
 on public.chaotic_preview_3x3_move_events for select to authenticated using(
  exists(select 1 from public.chaotic_match_turns m
    where m.lobby_id=chaotic_preview_3x3_move_events.lobby_id
      and (m.host_id=(select auth.uid()) or m.guest_id=(select auth.uid())))
 );

create or replace function public.chaotic_prepare_preview_3x3_board(
 p_lobby_id uuid,p_expected_turn integer
) returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 num integer;
begin
 if actor is null then raise exception 'Faça login';end if;
 if p_lobby_id is null or p_expected_turn is null or p_expected_turn not between 1 and 120
 then raise exception 'Turno inválido para tabuleiro 3x3';end if;
 select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id for update;
 if not found or m.status<>'active' or m.turn_no<>p_expected_turn
   or m.current_player is distinct from actor or actor not in (m.host_id,m.guest_id)
 then raise exception 'Somente jogador da vez pode preparar o próprio tabuleiro';end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.mode<>'3x3' or l.status<>'ready' or l.expires_at<=now()
  or l.host_id is distinct from m.host_id or l.guest_id is distinct from m.guest_id
 then raise exception 'Sala de treinamento 3x3 não disponível';end if;
 if (select count(*) from public.chaotic_preview_3x3_allies
     where lobby_id=p_lobby_id and actor_id=actor)<>3
   or (select count(*) from public.chaotic_preview_3x3_hp_wallets
     where lobby_id=p_lobby_id and actor_id=actor)<>3
 then raise exception 'Congele três cartas e inicialize o HP individual primeiro';end if;
 if exists(select 1 from public.chaotic_preview_3x3_board_positions
    where lobby_id=p_lobby_id and actor_id=actor)
 then raise exception 'Tabuleiro já preparado; não é possível reposicionar para recuperar movimentos';end if;
 if exists(select 1 from public.chaotic_preview_3x3_move_events
    where lobby_id=p_lobby_id and actor_id=actor)
 then raise exception 'Movimento anterior não pode ser reinicializado';end if;
 -- The formation positions correspond to original c4-c6, but board hexes
 -- remain separately mutable to 1-6 on the player's own training half.
 insert into public.chaotic_preview_3x3_board_positions(
   lobby_id,actor_id,formation_slot,creature_instance_id,hex_position
 )
 select a.lobby_id,a.actor_id,a.position,a.creature_instance_id,a.position
 from public.chaotic_preview_3x3_allies a
 join public.chaotic_preview_3x3_hp_wallets hp
   on hp.lobby_id=a.lobby_id and hp.actor_id=a.actor_id and hp.position=a.position
   and hp.creature_instance_id=a.creature_instance_id
 where a.lobby_id=p_lobby_id and a.actor_id=actor and hp.hp_remaining>0;
 get diagnostics num=row_count;
 if num<>3 then raise exception 'Cada uma das três criaturas precisa estar viva e com HP válido';end if;
 return pg_catalog.jsonb_build_object('status','3x3_board_preview_prepared',
    'hexes_per_player',6,'creatures',num,'official_match_modified',false);
end;
$fn$;
revoke all on function public.chaotic_prepare_preview_3x3_board(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_prepare_preview_3x3_board(uuid,integer)
 to authenticated;

create or replace function public.chaotic_move_preview_3x3_unit(
 p_lobby_id uuid,p_expected_turn integer,p_formation_slot integer,p_target_hex integer
) returns public.chaotic_preview_3x3_move_events
language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 b public.chaotic_preview_3x3_board_positions;
 h public.chaotic_preview_3x3_hp_wallets;
 neighbors integer[];
 event_row public.chaotic_preview_3x3_move_events;
begin
 if actor is null then raise exception 'Faça login';end if;
 if p_lobby_id is null or p_expected_turn is null or p_expected_turn not between 1 and 120
   or p_formation_slot is null or p_formation_slot not between 4 and 6
   or p_target_hex is null or p_target_hex not between 1 and 6
 then raise exception 'Turno, criatura ou hexágono inválido';end if;
 select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id for update;
 if not found or m.status<>'active' or m.turn_no<>p_expected_turn
   or m.current_player is distinct from actor or actor not in (m.host_id,m.guest_id)
 then raise exception 'Movimento fora da sua vez ou da sala';end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.mode<>'3x3' or l.status<>'ready' or l.expires_at<=now()
   or l.host_id is distinct from m.host_id or l.guest_id is distinct from m.guest_id
 then raise exception 'Sala 3x3 indisponível';end if;
 if (select count(*) from public.chaotic_preview_3x3_board_positions
  where lobby_id=p_lobby_id and actor_id=actor)<>3
 then raise exception 'Prepare as três criaturas do tabuleiro antes de movimentar';end if;
 if exists(select 1 from public.chaotic_preview_3x3_move_events
    where lobby_id=p_lobby_id and turn_no=p_expected_turn and actor_id=actor)
 then raise exception 'Um único movimento experimental por jogador e turno';end if;
 if exists(select 1 from public.chaotic_preview_clashes
    where lobby_id=p_lobby_id and turn_no=p_expected_turn)
  or exists(select 1 from public.chaotic_preview_burst_windows
    where lobby_id=p_lobby_id and turn_no=p_expected_turn)
 then raise exception 'Movimento experimental bloqueado após Clash/Burst';end if;
 select * into b from public.chaotic_preview_3x3_board_positions
   where lobby_id=p_lobby_id and actor_id=actor and formation_slot=p_formation_slot
   for update;
 if not found or b.moved_turn=p_expected_turn
 then raise exception 'Criatura não preparada ou já movida neste turno';end if;
 select * into h from public.chaotic_preview_3x3_hp_wallets
   where lobby_id=p_lobby_id and actor_id=actor and position=p_formation_slot;
 if not found or h.creature_instance_id is distinct from b.creature_instance_id
   or h.hp_remaining<=0 then raise exception 'HP individual não autoriza o movimento';end if;
 neighbors:=case b.hex_position
  when 1 then array[2,4]
  when 2 then array[1,3,4,5]
  when 3 then array[2,5]
  when 4 then array[1,2,5,6]
  when 5 then array[2,3,4,6]
  when 6 then array[4,5]
  else array[]::integer[] end;
 if not (p_target_hex=any(neighbors))
 then raise exception 'Hexágonos não adjacentes no tabuleiro experimental';end if;
 if exists(select 1 from public.chaotic_preview_3x3_board_positions
   where lobby_id=p_lobby_id and actor_id=actor and hex_position=p_target_hex)
 then raise exception 'Hexágono de destino ocupado por aliado';end if;
 update public.chaotic_preview_3x3_board_positions
 set hex_position=p_target_hex,moved_turn=p_expected_turn,updated_at=now()
 where lobby_id=p_lobby_id and actor_id=actor and formation_slot=p_formation_slot;
 insert into public.chaotic_preview_3x3_move_events(
   lobby_id,turn_no,actor_id,formation_slot,creature_instance_id,from_hex,to_hex
 ) values(p_lobby_id,p_expected_turn,actor,p_formation_slot,b.creature_instance_id,
   b.hex_position,p_target_hex)
 returning * into event_row;
 return event_row;
end;
$fn$;
revoke all on function public.chaotic_move_preview_3x3_unit(uuid,integer,integer,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_move_preview_3x3_unit(uuid,integer,integer,integer)
 to authenticated;

do $pub$
begin
 if not exists(select 1 from pg_publication_tables
  where pubname='supabase_realtime' and schemaname='public'
   and tablename='chaotic_preview_3x3_board_positions')
 then alter publication supabase_realtime add table public.chaotic_preview_3x3_board_positions;end if;
 if not exists(select 1 from pg_publication_tables
  where pubname='supabase_realtime' and schemaname='public'
   and tablename='chaotic_preview_3x3_move_events')
 then alter publication supabase_realtime add table public.chaotic_preview_3x3_move_events;end if;
end $pub$;