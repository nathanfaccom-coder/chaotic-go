-- Chaotic GO DROME 1x1: isolated DNA-aware damage preview.
-- NOT authoritative combat. Does not modify energy, win state, inventory, XP, economy or turns.
-- Both creature stats come from immutable per-match snapshots; card ownership STILL relies
-- on the player-writable album and must be hardened before competitive PvP.

create table if not exists public.chaotic_preview_individual_damage (
  lobby_id uuid not null,
  turn_no integer not null check (turn_no between 1 and 120),
  attacker_id uuid not null references auth.users(id),
  defender_id uuid not null references auth.users(id),
  attack_instance_id text not null,
  catalog_attack_id text not null,
  attack_name text not null,
  attacker_instance_id text not null,
  defender_instance_id text not null,
  attacker_name text not null,
  defender_name text not null,
  defender_energy_initial integer not null check (defender_energy_initial between 1 and 500),
  base_damage integer not null check (base_damage between 0 and 500),
  elemental_bonus integer not null check (elemental_bonus between 0 and 500),
  attribute_bonus integer not null check (attribute_bonus between 0 and 500),
  preview_subtotal integer check (preview_subtotal between 0 and 1500),
  preview_energy_remaining integer check (preview_energy_remaining between 0 and 500),
  calculation_status text not null check (calculation_status in ('partial_estimate','special_resolution_required')),
  notes text not null,
  created_at timestamptz not null default now(),
  primary key (lobby_id,turn_no),
  foreign key(lobby_id,turn_no)
    references public.chaotic_preview_clashes(lobby_id,turn_no) on delete cascade
);
alter table public.chaotic_preview_individual_damage enable row level security;
revoke all on public.chaotic_preview_individual_damage from public,anon,authenticated;
grant select on public.chaotic_preview_individual_damage to authenticated;
drop policy if exists chaotic_individual_preview_participants on public.chaotic_preview_individual_damage;
create policy chaotic_individual_preview_participants on public.chaotic_preview_individual_damage
  for select to authenticated using (
    exists (select 1 from public.chaotic_match_turns m
      where m.lobby_id=chaotic_preview_individual_damage.lobby_id
      and (m.host_id=(select auth.uid()) or m.guest_id=(select auth.uid())))
  );

-- Pure private helper for testing the original base + elemental + attribute math
-- with DNA numbers, without mixing captured IDs with catalog model IDs.
create or replace function public.chaotic_preview_individual_parts(
  p_attack_catalog_id text,
  p_attacker_name text,
  p_attacker_stats jsonb,
  p_defender_stats jsonb
) returns jsonb
language plpgsql stable security invoker set search_path=''
as $function$
declare
  attack public.chaotic_preview_card_reference;
  creature public.chaotic_preview_card_reference;
  acount integer;
  ccount integer;
  elems jsonb;
  bonus_elem integer := 0;
  bonus_attr integer := 0;
  stat_key text;
  base integer;
  subtotal integer;
  special boolean;
begin
  if jsonb_typeof(p_attacker_stats)<>'object'
    or jsonb_typeof(p_defender_stats)<>'object' then
    raise exception 'Atributos individuais ausentes'; end if;
  select count(*) into acount from public.chaotic_preview_card_reference a
    where a.kind='attack' and a.card_id=p_attack_catalog_id;
  if acount<>1 then raise exception 'Referência do ataque ausente ou ambígua'; end if;
  select * into attack from public.chaotic_preview_card_reference a
    where a.kind='attack' and a.card_id=p_attack_catalog_id;

  -- A criatura pode ter o selo (Max) sem alterar seus elementos de origem.
  select count(*) into ccount from public.chaotic_preview_card_reference c
    where c.kind='creature'
      and c.card_name=pg_catalog.regexp_replace(p_attacker_name,' [(]Max[)]$','');
  if ccount<>1 then raise exception 'Elementos da criatura não identificados no catálogo'; end if;
  select * into creature from public.chaotic_preview_card_reference c
    where c.kind='creature'
      and c.card_name=pg_catalog.regexp_replace(p_attacker_name,' [(]Max[)]$','');
  elems:=coalesce(creature.creature_elements,'[]'::jsonb);
  if jsonb_typeof(elems)<>'array' then raise exception 'Elementos da criatura inválidos'; end if;

  if elems ? 'fogo' then
    bonus_elem:=bonus_elem+coalesce((attack.element_damage->>'fogo')::integer,0);
  end if;
  if elems ? 'agua' then
    bonus_elem:=bonus_elem+coalesce((attack.element_damage->>'agua')::integer,0);
  end if;
  if elems ? 'terra' then
    bonus_elem:=bonus_elem+coalesce((attack.element_damage->>'terra')::integer,0);
  end if;
  if elems ? 'ar' or elems ? 'vento' then
    bonus_elem:=bonus_elem+coalesce(
      nullif((attack.element_damage->>'ar')::integer,0),
      (attack.element_damage->>'vento')::integer,0);
  end if;

  stat_key:=case attack.attribute_check
    when 'coragem' then 'c'
    when 'poder' then 'p'
    when 'sabedoria' then 's'
    when 'velocidade' then 'v'
    else null end;
  if stat_key is not null then
    if (p_attacker_stats->>stat_key) !~ '^[0-9]{1,3}$'
      or (p_defender_stats->>stat_key) !~ '^[0-9]{1,3}$' then
      raise exception 'Atributos individuais inválidos para a comparação'; end if;
    if (p_attacker_stats->>stat_key)::integer > (p_defender_stats->>stat_key)::integer then
      bonus_attr:=coalesce(attack.attribute_bonus,0);
    end if;
  end if;
  base:=attack.base_damage;
  if base is null or base<0 or base>500 or bonus_elem<0 or bonus_attr<0 then
    raise exception 'Valores de dano incompatíveis com o catálogo'; end if;
  -- Original special rules rely on dice or graveyard; do NOT show a misleading total.
  special:=attack.card_id in ('104','113','114');
  subtotal:=case when special then null else greatest(0,base+bonus_elem+bonus_attr) end;
  return pg_catalog.jsonb_build_object(
    'status',case when special then 'special_resolution_required' else 'partial_estimate' end,
    'base',base,'elemental',bonus_elem,'attribute',bonus_attr,'subtotal',subtotal);
end;
$function$;
revoke all on function public.chaotic_preview_individual_parts(text,text,jsonb,jsonb)
  from public,anon,authenticated;

create or replace function public.chaotic_calculate_individual_preview(
  p_lobby_id uuid,p_expected_turn integer
) returns public.chaotic_preview_individual_damage
language plpgsql security definer set search_path=''
as $function$
declare
  actor uuid := auth.uid();
  match public.chaotic_match_turns;
  lobby public.chaotic_lobbies;
  clash public.chaotic_preview_clashes;
  attack public.chaotic_preview_attack_instances;
  attacker public.chaotic_preview_loadouts;
  defender public.chaotic_preview_loadouts;
  components jsonb;
  energy integer;
  subtotal integer;
  status text;
  result public.chaotic_preview_individual_damage;
begin
  if actor is null then raise exception 'Faça login'; end if;
  if p_lobby_id is null or p_expected_turn is null or p_expected_turn not between 1 and 120 then
    raise exception 'Turno inválido'; end if;
  select * into match from public.chaotic_match_turns
    where lobby_id=p_lobby_id for update;
  if not found then raise exception 'Partida inexistente'; end if;
  if actor<>match.host_id and actor<>match.guest_id then
    raise exception 'Usuário não participa da partida'; end if;
  if match.status<>'active' or match.current_player<>actor
    or match.turn_no<>p_expected_turn then
    raise exception 'Não é sua vez ou turno desatualizado'; end if;
  select * into lobby from public.chaotic_lobbies where id=p_lobby_id;
  if not found or lobby.mode<>'1x1' or lobby.status<>'ready' or lobby.expires_at<=now()
    or lobby.host_id<>match.host_id or lobby.guest_id is distinct from match.guest_id then
    raise exception 'Prévia individual disponível apenas em partida 1x1 ativa'; end if;

  select * into clash from public.chaotic_preview_clashes
    where lobby_id=p_lobby_id and turn_no=p_expected_turn;
  if not found or clash.attacker_id<>actor then
    raise exception 'Registre um confronto válido antes de calcular'; end if;

  select * into attack from public.chaotic_preview_attack_instances
    where lobby_id=p_lobby_id and turn_no=p_expected_turn;
  if not found or attack.actor_id<>actor
    or attack.attack_instance_id<>clash.attack_card then
    raise exception 'Valide a instância do ataque deste confronto primeiro'; end if;

  select * into attacker from public.chaotic_preview_loadouts
    where lobby_id=p_lobby_id and actor_id=actor;
  if not found or attacker.card_instance_id<>clash.attacker_card then
    raise exception 'Ficha do atacante não coincide com o confronto'; end if;
  select * into defender from public.chaotic_preview_loadouts
    where lobby_id=p_lobby_id and actor_id=clash.defender_id;
  if not found or defender.card_instance_id<>clash.defender_card then
    raise exception 'Ficha individual do defensor ainda não foi preparada'; end if;
  if exists (select 1 from public.chaotic_preview_individual_damage
    where lobby_id=p_lobby_id and turn_no=p_expected_turn) then
    raise exception 'O cálculo individual já foi registrado neste turno'; end if;

  components:=public.chaotic_preview_individual_parts(
    attack.catalog_attack_id,attacker.creature_name,attacker.stats,defender.stats);
  energy:=(defender.stats->>'e')::integer;
  if energy not between 1 and 500 then
    raise exception 'Energia individual inválida'; end if;
  subtotal:=(components->>'subtotal')::integer;
  status:=components->>'status';

  insert into public.chaotic_preview_individual_damage (
    lobby_id,turn_no,attacker_id,defender_id,attack_instance_id,catalog_attack_id,
    attack_name,attacker_instance_id,defender_instance_id,attacker_name,defender_name,
    defender_energy_initial,base_damage,elemental_bonus,attribute_bonus,
    preview_subtotal,preview_energy_remaining,calculation_status,notes
  ) values (
    p_lobby_id,p_expected_turn,actor,clash.defender_id,attack.attack_instance_id,
    attack.catalog_attack_id,attack.attack_name,attacker.card_instance_id,
    defender.card_instance_id,attacker.creature_name,defender.creature_name,
    energy,(components->>'base')::integer,(components->>'elemental')::integer,
    (components->>'attribute')::integer,subtotal,
    case when subtotal is null then null else greatest(0,energy-subtotal) end,
    status,'Simulação sem dano real: usa atributos de DNA congelados, elementos base do catálogo; não valida custos de jogo, mão, equipamento revelado, imunidades, local, habilidades, efeitos, dado, XP nem vitória.'
  ) returning * into result;
  return result;
end;
$function$;

revoke all on function public.chaotic_calculate_individual_preview(uuid,integer)
  from public,anon,authenticated;
grant execute on function public.chaotic_calculate_individual_preview(uuid,integer)
  to authenticated;

do $$
begin
  if not exists(select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public'
      and tablename='chaotic_preview_individual_damage') then
    alter publication supabase_realtime
      add table public.chaotic_preview_individual_damage;
  end if;
end $$;
