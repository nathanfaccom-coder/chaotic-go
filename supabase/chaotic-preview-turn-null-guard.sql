-- Evita passar NULL como número de turno para burlar a comparação otimista.
-- Atualiza apenas os dois RPCs do tabuleiro de teste; não altera cartas nem progresso.
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
  if p_lobby_id is null or p_expected_turn is null or p_expected_turn not between 1 and 120 then
    raise exception 'Número de turno inválido'; end if;
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
  if p_lobby_id is null or p_expected_turn is null or p_expected_turn not between 1 and 120 then
    raise exception 'Número de turno inválido'; end if;
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
  if exists(select 1 from public.chaotic_preview_board
    where lobby_id=p_lobby_id and actor_id=actor and position=p_target_slot) then
    raise exception 'O destino está ocupado'; end if;
  update public.chaotic_preview_board
    set position=p_target_slot,moved_turn=m.turn_no,updated_at=now()
    where lobby_id=p_lobby_id and actor_id=actor returning * into moved;
  return moved;
end;
$$;
revoke all on function public.chaotic_place_preview_creature(uuid,integer),
  public.chaotic_move_preview_creature(uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.chaotic_place_preview_creature(uuid,integer),
  public.chaotic_move_preview_creature(uuid,integer,integer) to authenticated;