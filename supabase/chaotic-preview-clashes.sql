-- Chaotic GO: marcador seguro de ENCONTRO, sem dano nem efeitos.
-- Reproduz exclusivamente a adjacência ENTRE os lados do DROME original.
create table if not exists public.chaotic_preview_clashes (
  lobby_id uuid not null references public.chaotic_match_turns(lobby_id) on delete cascade,
  turn_no integer not null check(turn_no between 1 and 120),
  attacker_id uuid not null references auth.users(id) on delete cascade,
  defender_id uuid not null references auth.users(id) on delete cascade,
  attacker_card text not null,
  defender_card text not null,
  attack_card text not null,
  attacker_position smallint not null check(attacker_position between 1 and 6),
  defender_position smallint not null check(defender_position between 1 and 6),
  result text not null default 'awaiting_original_engine'
    check(result='awaiting_original_engine'),
  created_at timestamptz not null default now(),
  primary key(lobby_id,turn_no),
  constraint preview_clash_distinct_players check(attacker_id<>defender_id)
);
alter table public.chaotic_preview_clashes enable row level security;
revoke all on public.chaotic_preview_clashes from public,anon,authenticated;
grant select on public.chaotic_preview_clashes to authenticated;
drop policy if exists chaotic_preview_clashes_member_read on public.chaotic_preview_clashes;
create policy chaotic_preview_clashes_member_read on public.chaotic_preview_clashes
  for select to authenticated using (
    exists (select 1 from public.chaotic_match_turns m
      where m.lobby_id=chaotic_preview_clashes.lobby_id
        and ((select auth.uid())=m.host_id or (select auth.uid())=m.guest_id))
  );
create or replace function public.chaotic_open_preview_clash(
  p_lobby_id uuid,p_expected_turn integer
) returns public.chaotic_preview_clashes
language plpgsql security definer set search_path=''
as $$
declare
  actor uuid:=auth.uid();
  m public.chaotic_match_turns;
  l public.chaotic_lobbies;
  mine public.chaotic_preview_board;
  enemy public.chaotic_preview_board;
  attack public.chaotic_combat_declarations;
  result public.chaotic_preview_clashes;
  other_player uuid;
  in_contact boolean:=false;
begin
  if actor is null then raise exception 'Faça login'; end if;
  if p_lobby_id is null or p_expected_turn is null or p_expected_turn not between 1 and 120 then
    raise exception 'Número de turno inválido'; end if;
  select * into m from public.chaotic_match_turns
    where lobby_id=p_lobby_id for update;
  if not found then raise exception 'Partida de teste não encontrada'; end if;
  if actor<>m.host_id and actor<>m.guest_id then
    raise exception 'Você não participa da partida'; end if;
  if m.status<>'active' or m.current_player<>actor or m.turn_no<>p_expected_turn then
    raise exception 'Não é sua vez ou o turno mudou'; end if;
  select * into l from public.chaotic_lobbies where id=p_lobby_id;
  if not found or l.status<>'ready' or l.expires_at<=now()
    or l.host_id<>m.host_id or l.guest_id is distinct from m.guest_id then
    raise exception 'Sala indisponível'; end if;
  other_player:=case when actor=m.host_id then m.guest_id else m.host_id end;
  select * into mine from public.chaotic_preview_board
    where lobby_id=p_lobby_id and actor_id=actor;
  if not found then raise exception 'Sua criatura precisa estar posicionada'; end if;
  select * into enemy from public.chaotic_preview_board
    where lobby_id=p_lobby_id and actor_id=other_player;
  if not found then raise exception 'A criatura do adversário precisa estar posicionada'; end if;
  select * into attack from public.chaotic_combat_declarations
    where lobby_id=p_lobby_id and actor_id=actor
      and turn_no=p_expected_turn and kind='attack';
  if not found then raise exception 'Declare um ataque do seu deck neste turno antes do confronto'; end if;

  -- O combate original utiliza 'jog-cN' / 'op-cN'; a relação é simétrica.
  if l.mode='1x1' then
    in_contact:=(mine.position=6 and enemy.position=6);
  elsif l.mode='3x3' then
    in_contact:=(mine.position in (4,5) and enemy.position in (4,5));
  elsif l.mode='6x6' then
    in_contact:=
      (mine.position=1 and enemy.position in (2,3))
      or (mine.position=2 and enemy.position in (1,2,3))
      or (mine.position=3 and enemy.position in (1,2));
  end if;
  if not in_contact then raise exception 'Criaturas sem contato: mova até posições adjacentes antes de atacar'; end if;
  if exists(select 1 from public.chaotic_preview_clashes
    where lobby_id=p_lobby_id and turn_no=p_expected_turn) then
    raise exception 'Já existe um confronto registrado neste turno'; end if;

  insert into public.chaotic_preview_clashes(
    lobby_id,turn_no,attacker_id,defender_id,attacker_card,defender_card,
    attack_card,attacker_position,defender_position
  ) values(
    p_lobby_id,p_expected_turn,actor,other_player,mine.card_id,enemy.card_id,
    attack.card_id,mine.position,enemy.position
  ) returning * into result;
  return result;
end;
$$;
revoke all on function public.chaotic_open_preview_clash(uuid,integer)
  from public,anon,authenticated;
grant execute on function public.chaotic_open_preview_clash(uuid,integer) to authenticated;
do $$
begin
 if not exists(select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public'
      and tablename='chaotic_preview_clashes') then
   alter publication supabase_realtime add table public.chaotic_preview_clashes;
 end if;
end $$;