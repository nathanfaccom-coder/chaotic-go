-- 0.1.13: a private captured attack must exist in its owner's currently drawn hand.
-- Protects against skipping the UI or declaring an undealt card. No real combat changes.
create or replace function public.chaotic_capture_preview_attack(
  p_lobby_id uuid,p_expected_turn integer
) returns public.chaotic_preview_attack_instances
language plpgsql security definer set search_path=''
as $function$
declare
  actor uuid := auth.uid();
  m public.chaotic_match_turns;
  l public.chaotic_lobbies;
  selected public.chaotic_combat_declarations;
  deck jsonb;
  album jsonb;
  records jsonb;
  card jsonb;
  count_instances integer;
  count_models integer;
  model_id text;
  model_name text;
  model_damage integer;
  model_cost integer;
  raw text;
  result public.chaotic_preview_attack_instances;
begin
  if actor is null then raise exception 'Faça login para preparar a carta'; end if;
  if p_lobby_id is null or p_expected_turn is null or p_expected_turn not between 1 and 120 then
    raise exception 'Turno inválido'; end if;

  select * into m from public.chaotic_match_turns
    where lobby_id=p_lobby_id for update;
  if not found then raise exception 'Partida inexistente'; end if;
  if actor<>m.host_id and actor<>m.guest_id then
    raise exception 'Você não participa desta partida'; end if;
  if m.status<>'active' or m.current_player<>actor or m.turn_no<>p_expected_turn then
    raise exception 'Não é sua vez ou o turno mudou'; end if;

  select * into l from public.chaotic_lobbies where id=p_lobby_id;
  if not found or l.mode<>'1x1' or l.status<>'ready' or l.expires_at<=now()
    or l.host_id<>m.host_id or l.guest_id is distinct from m.guest_id then
    raise exception 'Esta preparação é exclusiva de sala 1x1 ativa'; end if;

  if not exists (select 1 from public.chaotic_preview_loadouts
     where lobby_id=p_lobby_id and actor_id=actor) then
     raise exception 'Primeiro prepare a ficha da sua criatura'; end if;

  select * into selected from public.chaotic_combat_declarations
    where lobby_id=p_lobby_id and turn_no=p_expected_turn
    and actor_id=actor and kind='attack';
  if not found then raise exception 'Declare um ataque do seu deck neste turno'; end if;

  if exists (select 1 from public.chaotic_preview_attack_instances
    where lobby_id=p_lobby_id and turn_no=p_expected_turn) then
    raise exception 'Este ataque já foi preparado neste turno'; end if;

  if not exists (
    select 1 from public.chaotic_preview_attack_hand h
    join public.chaotic_preview_attack_wallets w
      on w.lobby_id=h.lobby_id and w.actor_id=h.actor_id
    where h.lobby_id=p_lobby_id and h.actor_id=actor
      and w.deck_slot=selected.deck_slot
      and w.last_draw_turn=p_expected_turn
      and h.card_slot=selected.card_slot
      and h.attack_instance_id=selected.card_id
      and h.card_state='hand'
  ) then
    raise exception 'Este ataque não está disponível na sua mão de teste';
  end if;

  select g.data into deck from public.chaotic_game_nodes g
    where g.user_id=actor and g.node_path in (
      'decks/1x1_slot_'||selected.deck_slot::text,
      'decks/1x1_'||selected.deck_slot::text)
    order by (g.node_path='decks/1x1_slot_'||selected.deck_slot::text) desc
    limit 1;
  if deck is null or jsonb_typeof(deck->'ataques')<>'array'
    or jsonb_array_length(deck->'ataques') < selected.card_slot
    or deck->'ataques'->>(selected.card_slot-1) is distinct from selected.card_id then
    raise exception 'Ataque declarado não corresponde à instância no deck salvo'; end if;

  select g.data into album from public.chaotic_game_nodes g
    where g.user_id=actor and g.node_path='album';
  if album is null then raise exception 'Álbum não encontrado'; end if;
  if jsonb_typeof(album)='array' then
    records:=album;
  elsif jsonb_typeof(album)='object' then
    select coalesce(jsonb_agg(e.value),'[]'::jsonb) into records
      from jsonb_each(album) e;
  else
    raise exception 'Formato do álbum inválido'; end if;

  select count(*),min(x.value::text)::jsonb into count_instances,card
    from jsonb_array_elements(records) x(value)
    where x.value->>'id'=selected.card_id and x.value->>'tipoCarta'='Ataque';
  if count_instances<>1 then
    raise exception 'Ataque não localizado de forma única no álbum'; end if;
  if nullif(card->>'nome','') is null or length(card->>'nome')>120 then
    raise exception 'Nome do ataque inválido'; end if;
  if card ? 'quantidade' then
    raw:=card->>'quantidade';
    if raw is null or raw !~ '^[0-9]{1,5}$' or raw::integer<1 then
      raise exception 'Ataque sem cópias disponíveis'; end if;
  end if;

  -- Match the actual name against the 15 currently active source cards.
  -- Never interpret the scanner instance ID as the catalog ID.
  select count(*),min(r.card_id),min(r.card_name),min(r.base_damage),min(r.attack_cost)
    into count_models,model_id,model_name,model_damage,model_cost
    from public.chaotic_preview_card_reference r
    where r.kind='attack' and r.card_name=card->>'nome'
      and r.card_id ~ '^1(0[1-9]|1[0-5])$';
  if count_models<>1 or model_id is null or model_damage is null or model_cost is null then
    raise exception 'Ataque não corresponde de forma única ao catálogo ativo'; end if;
  -- Source-declared values are additional integrity checks, not an authority source.
  foreach raw in array array['danoBase','custo'] loop
    if card ? raw then
      if (card->>raw) !~ '^[0-9]{1,3}$' then
        raise exception 'Valor inválido na carta: %',raw; end if;
      if (card->>raw)::integer <> (case when raw='danoBase' then model_damage else model_cost end) then
        raise exception 'Atributos do ataque divergem do catálogo: %',raw; end if;
    end if;
  end loop;

  insert into public.chaotic_preview_attack_instances (
    lobby_id,turn_no,actor_id,deck_slot,card_slot,attack_instance_id,
    catalog_attack_id,attack_name,base_damage,attack_cost
  ) values (
    p_lobby_id,p_expected_turn,actor,selected.deck_slot,selected.card_slot,
    selected.card_id,model_id,model_name,model_damage,model_cost
  ) returning * into result;
  return result;
end;
$function$;


revoke all on function public.chaotic_capture_preview_attack(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_capture_preview_attack(uuid,integer)
 to authenticated;
