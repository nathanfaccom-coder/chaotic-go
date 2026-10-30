-- Chaotic GO 0.1.36 - two-player contact intent based on original cross-side 3x3 adjacency.
-- Existing preview_clashes.sql considers both heroes in side hex 4 or 5 as cross-side
-- in contact. This is a SNAPSHOT ONLY. It never validates/spends an Attack card,
-- changes HP, triggers a Burst, chooses a winner, or modifies official match state.

create table if not exists public.chaotic_preview_3x3_contact_intents (
 lobby_id uuid not null references public.chaotic_match_turns(lobby_id) on delete cascade,
 turn_no integer not null check(turn_no between 1 and 120),
 attacker_id uuid not null references auth.users(id),
 defender_id uuid not null references auth.users(id),
 attacker_slot smallint not null check(attacker_slot between 4 and 6),
 defender_slot smallint not null check(defender_slot between 4 and 6),
 attacker_creature_instance_id text not null check(length(attacker_creature_instance_id) between 1 and 48),
 defender_creature_instance_id text not null check(length(defender_creature_instance_id) between 1 and 48),
 attacker_hex smallint not null check(attacker_hex in (4,5)),
 defender_hex smallint not null check(defender_hex in (4,5)),
 attacker_hp_at_contact integer not null check(attacker_hp_at_contact between 1 and 500),
 defender_hp_at_contact integer not null check(defender_hp_at_contact between 1 and 500),
 contact_status text not null default 'awaiting_validated_attack_preview'
   check(contact_status='awaiting_validated_attack_preview'),
 attack_card_validated boolean not null default false check(attack_card_validated=false),
 damage_applied boolean not null default false check(damage_applied=false),
 official_match_modified boolean not null default false check(official_match_modified=false),
 official_hp_changed boolean not null default false check(official_hp_changed=false),
 created_at timestamptz not null default now(),
 primary key(lobby_id,turn_no),
 foreign key(lobby_id,attacker_id,attacker_slot)
  references public.chaotic_preview_3x3_board_positions(lobby_id,actor_id,formation_slot),
 foreign key(lobby_id,defender_id,defender_slot)
  references public.chaotic_preview_3x3_board_positions(lobby_id,actor_id,formation_slot),
 check(attacker_id<>defender_id),
 check(attacker_creature_instance_id<>defender_creature_instance_id)
);
alter table public.chaotic_preview_3x3_contact_intents enable row level security;
revoke all on public.chaotic_preview_3x3_contact_intents from public,anon,authenticated;
grant select on public.chaotic_preview_3x3_contact_intents to authenticated;
drop policy if exists chaotic_preview_3x3_contact_members_read on public.chaotic_preview_3x3_contact_intents;
create policy chaotic_preview_3x3_contact_members_read
 on public.chaotic_preview_3x3_contact_intents for select to authenticated
 using (exists(select 1 from public.chaotic_match_turns m
  where m.lobby_id=chaotic_preview_3x3_contact_intents.lobby_id
   and ((select auth.uid())=m.host_id or (select auth.uid())=m.guest_id)));

create or replace function public.chaotic_open_preview_3x3_contact(
 p_lobby_id uuid, p_expected_turn integer,
 p_attacker_slot integer,p_defender_slot integer
) returns public.chaotic_preview_3x3_contact_intents
language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 enemy_id uuid;
 attacker_board public.chaotic_preview_3x3_board_positions;
 defender_board public.chaotic_preview_3x3_board_positions;
 attacker_hp public.chaotic_preview_3x3_hp_wallets;
 defender_hp public.chaotic_preview_3x3_hp_wallets;
 output_row public.chaotic_preview_3x3_contact_intents;
begin
 if actor is null then raise exception 'Faça login';end if;
 if p_lobby_id is null or p_expected_turn is null or p_expected_turn not between 1 and 120
 or p_attacker_slot is null or p_attacker_slot not between 4 and 6
 or p_defender_slot is null or p_defender_slot not between 4 and 6
 then raise exception 'Turno ou criaturas de contato 3x3 inválidos';end if;
 select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id for update;
 if not found or m.status<>'active' or m.turn_no<>p_expected_turn
  or m.current_player is distinct from actor
  or actor not in (m.host_id,m.guest_id)
 then raise exception 'Somente o jogador da vez pode declarar contato';end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.mode<>'3x3' or l.status<>'ready' or l.expires_at<=now()
 or l.host_id is distinct from m.host_id or l.guest_id is distinct from m.guest_id
 then raise exception 'Sala 3x3 não está pronta para contato';end if;
 enemy_id:=case when m.host_id=actor then m.guest_id else m.host_id end;
 if enemy_id is null then raise exception 'Falta adversário autenticado';end if;
 if exists(select 1 from public.chaotic_preview_3x3_contact_intents
   where lobby_id=p_lobby_id and turn_no=p_expected_turn)
 then raise exception 'Contato 3x3 já preparado para este turno';end if;
 if exists(select 1 from public.chaotic_preview_clashes
   where lobby_id=p_lobby_id and turn_no=p_expected_turn)
 or exists(select 1 from public.chaotic_preview_burst_windows
   where lobby_id=p_lobby_id and turn_no=p_expected_turn)
 then raise exception 'Outro confronto/Burst já foi registrado neste turno';end if;
 if (select count(*) from public.chaotic_preview_3x3_board_positions
   where lobby_id=p_lobby_id and actor_id=actor)<>3
 or (select count(*) from public.chaotic_preview_3x3_board_positions
   where lobby_id=p_lobby_id and actor_id=enemy_id)<>3
 then raise exception 'Ambos os lados devem preparar três criaturas para contato 3x3';end if;
 select * into attacker_board from public.chaotic_preview_3x3_board_positions
  where lobby_id=p_lobby_id and actor_id=actor and formation_slot=p_attacker_slot for update;
 select * into defender_board from public.chaotic_preview_3x3_board_positions
  where lobby_id=p_lobby_id and actor_id=enemy_id and formation_slot=p_defender_slot for update;
 if attacker_board.creature_instance_id is null or defender_board.creature_instance_id is null
 then raise exception 'As duas criaturas devem existir nos tabuleiros originais';end if;
 -- Matches the 3x3 cross-side contact condition used in chaotic_preview_clashes.sql;
 -- this is only a read-only bilateral contact snapshot, not a real combat judgment.
 if attacker_board.hex_position not in (4,5) or defender_board.hex_position not in (4,5)
 then raise exception 'Sem contato 3x3: ambos precisam estar no hex 4 ou 5 de seu lado';end if;
 select * into attacker_hp from public.chaotic_preview_3x3_hp_wallets
  where lobby_id=p_lobby_id and actor_id=actor and position=p_attacker_slot;
 select * into defender_hp from public.chaotic_preview_3x3_hp_wallets
  where lobby_id=p_lobby_id and actor_id=enemy_id and position=p_defender_slot;
 if attacker_hp.creature_instance_id is distinct from attacker_board.creature_instance_id
  or defender_hp.creature_instance_id is distinct from defender_board.creature_instance_id
  or attacker_hp.hp_remaining is null or attacker_hp.hp_remaining<=0
  or defender_hp.hp_remaining is null or defender_hp.hp_remaining<=0
 then raise exception 'HP inválido ou criatura divergente na declaração';end if;
 insert into public.chaotic_preview_3x3_contact_intents(
   lobby_id,turn_no,attacker_id,defender_id,attacker_slot,defender_slot,
   attacker_creature_instance_id,defender_creature_instance_id,
   attacker_hex,defender_hex,attacker_hp_at_contact,defender_hp_at_contact
 ) values(
   p_lobby_id,p_expected_turn,actor,enemy_id,p_attacker_slot,p_defender_slot,
   attacker_board.creature_instance_id,defender_board.creature_instance_id,
   attacker_board.hex_position,defender_board.hex_position,
   attacker_hp.hp_remaining,defender_hp.hp_remaining
 ) returning * into output_row;
 return output_row;
end;
$fn$;
revoke all on function public.chaotic_open_preview_3x3_contact(uuid,integer,integer,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_open_preview_3x3_contact(uuid,integer,integer,integer)
 to authenticated;

-- Keep the preview-board movement atomic: after a contact has been recorded,
-- the attacker cannot move again on that turn, even if movement had not occurred.
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
 if exists(select 1 from public.chaotic_preview_3x3_contact_intents
    where lobby_id=p_lobby_id and turn_no=p_expected_turn)
 then raise exception 'Contato 3x3 já registrado: movimento posterior bloqueado';end if;
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

do $pub$
begin
 if not exists(select 1 from pg_publication_tables
   where pubname='supabase_realtime' and schemaname='public'
    and tablename='chaotic_preview_3x3_contact_intents')
 then alter publication supabase_realtime add table public.chaotic_preview_3x3_contact_intents;end if;
end $pub$;