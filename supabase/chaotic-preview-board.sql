-- Tabuleiro compartilhado de teste: uma criatura selecionada por jogador.
-- Mantém a ordem dos hexágonos do DROME original, SEM simular dano, magia ou vitória.
create table if not exists public.chaotic_preview_board (
  lobby_id uuid not null references public.chaotic_match_turns(lobby_id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  card_id text not null check (length(card_id) between 1 and 48),
  position smallint not null check (position between 1 and 6),
  moved_turn integer not null default 0 check (moved_turn between 0 and 120),
  updated_at timestamptz not null default now(),
  primary key(lobby_id,actor_id)
);
alter table public.chaotic_preview_board enable row level security;
revoke all on public.chaotic_preview_board from public,anon,authenticated;
grant select on public.chaotic_preview_board to authenticated;
drop policy if exists chaotic_preview_board_members_read on public.chaotic_preview_board;
create policy chaotic_preview_board_members_read on public.chaotic_preview_board
  for select to authenticated using (
    exists (select 1 from public.chaotic_match_turns m
      where m.lobby_id=chaotic_preview_board.lobby_id
      and ((select auth.uid())=m.host_id or (select auth.uid())=m.guest_id))
  );

-- Posicionamento autorizado APÓS a primeira declaração de criatura.
-- O primeiro slot do deck corresponde ao slot do tabuleiro original; não cria cópias de cartas.
create or replace function public.chaotic_place_preview_creature(
  p_lobby_id uuid, p_expected_turn integer
) returns public.chaotic_preview_board
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  m public.chaotic_match_turns;
  l public.chaotic_lobbies;
  selected public.chaotic_combat_declarations;
  placed public.chaotic_preview_board;
begin
  if actor is null then raise exception 'Faça login'; end if;
  select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id for update;
  if not found then raise exception 'Partida de teste não encontrada'; end if;
  if m.status<>'active' or m.current_player<>actor or m.turn_no<>p_expected_turn then
    raise exception 'Aguarde sua vez ou atualize o turno'; end if;
  if actor<>m.host_id and actor<>m.guest_id then raise exception 'Jogador não autorizado'; end if;
  select * into l from public.chaotic_lobbies where id=p_lobby_id;
  if not found or l.status<>'ready' or l.expires_at<=now()
     or l.host_id<>m.host_id or l.guest_id is distinct from m.guest_id then
    raise exception 'Sala indisponível'; end if;
  select * into selected from public.chaotic_combat_declarations
    where lobby_id=p_lobby_id and actor_id=actor and kind='creature';
  if not found then raise exception 'Selecione uma criatura do seu deck primeiro'; end if;
  if exists(select 1 from public.chaotic_preview_board where lobby_id=p_lobby_id and actor_id=actor) then
    raise exception 'Sua criatura já está posicionada'; end if;
  -- Apenas hexágonos que existem na configuração original do modo.
  if (l.mode='1x1' and selected.card_slot<>6)
    or (l.mode='3x3' and selected.card_slot not between 4 and 6)
    or (l.mode='6x6' and selected.card_slot not between 1 and 6) then
    raise exception 'Slot da criatura não corresponde ao modo; escolha c6 (1x1), c4-c6 (3x3) ou c1-c6 (6x6)'; end if;
  insert into public.chaotic_preview_board(lobby_id,actor_id,card_id,position)
    values(p_lobby_id,actor,selected.card_id,selected.card_slot)
    returning * into placed;
  return placed;
end;
$$;

-- Validação de adjacência igual ao lado próprio do tabuleiro de batalha.
-- Move somente para posição vazia da MESMA área; choques com adversário
-- exigem o futuro motor autoritativo de combate e não ocorrem aqui.
create or replace function public.chaotic_move_preview_creature(
  p_lobby_id uuid,p_expected_turn integer,p_target_slot integer
) returns public.chaotic_preview_board
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  m public.chaotic_match_turns;
  l public.chaotic_lobbies;
  unit public.chaotic_preview_board;
  neighbors integer[];
  moved public.chaotic_preview_board;
begin
  if actor is null then raise exception 'Faça login'; end if;
  if p_target_slot is null or p_target_slot not between 1 and 6 then
    raise exception 'Posição inválida'; end if;
  select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id for update;
  if not found then raise exception 'Partida de teste não encontrada'; end if;
  if actor<>m.host_id and actor<>m.guest_id then raise exception 'Jogador não autorizado'; end if;
  if m.status<>'active' or m.current_player<>actor or m.turn_no<>p_expected_turn then
    raise exception 'Não é sua vez ou o turno mudou'; end if;
  select * into l from public.chaotic_lobbies where id=p_lobby_id;
  if not found or l.status<>'ready' or l.expires_at<=now()
    or l.host_id<>m.host_id or l.guest_id is distinct from m.guest_id then
    raise exception 'Sala indisponível'; end if;
  select * into unit from public.chaotic_preview_board
    where lobby_id=p_lobby_id and actor_id=actor for update;
  if not found then raise exception 'Posicione sua criatura primeiro'; end if;
  if unit.moved_turn=m.turn_no then raise exception 'Essa criatura já se moveu neste turno'; end if;
  if (l.mode='1x1' and p_target_slot<>6)
    or (l.mode='3x3' and p_target_slot not between 4 and 6) then
    raise exception 'O hexágono não existe neste modo'; end if;
  neighbors:=case unit.position
    when 1 then array[2,4]
    when 2 then array[1,3,4,5]
    when 3 then array[2,5]
    when 4 then array[1,2,5,6]
    when 5 then array[2,3,4,6]
    when 6 then array[4,5]
    else array[]::integer[] end;
  if not (p_target_slot=any(neighbors)) then
    raise exception 'Movimento ilegal: hexágonos não adjacentes'; end if;
  -- Por enquanto um marcador por jogador; o tabuleiro completo terá até 6.
  if exists(select 1 from public.chaotic_preview_board
    where lobby_id=p_lobby_id and actor_id=actor and position=p_target_slot) then
    raise exception 'O destino está ocupado'; end if;
  update public.chaotic_preview_board
    set position=p_target_slot,moved_turn=m.turn_no,updated_at=now()
    where lobby_id=p_lobby_id and actor_id=actor returning * into moved;
  return moved;
end;
$$;

revoke all on function public.chaotic_place_preview_creature(uuid,integer) from public,anon,authenticated;
revoke all on function public.chaotic_move_preview_creature(uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.chaotic_place_preview_creature(uuid,integer),
  public.chaotic_move_preview_creature(uuid,integer,integer) to authenticated;

-- Não publica eventos de posicionamento para contas externas sem autorização.
do $$
begin
 if not exists(select 1 from pg_publication_tables
   where pubname='supabase_realtime' and schemaname='public'
     and tablename='chaotic_preview_board') then
   alter publication supabase_realtime add table public.chaotic_preview_board;
 end if;
end $$;
