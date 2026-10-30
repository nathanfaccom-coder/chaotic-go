-- Chaotic GO / DROME. ELEMENTAL and ATTRIBUTE REFERENCE BONUS ONLY.
-- Never changes real HP, cards, deck, rewards or battle rules.
-- The numbers use default catalog creature attributes/elements, not mutable in-match DNA,
-- equipment, immunities, battlefield, burst rolls or passive effects.
create table if not exists public.chaotic_preview_modifiers (
  lobby_id uuid not null,
  turn_no integer not null,
  attacker_id uuid not null references auth.users(id),
  attack_card_id text not null,
  attacker_card_id text not null,
  defender_card_id text not null,
  base_damage integer,
  elemental_bonus integer,
  attribute_bonus integer,
  reference_subtotal integer,
  formula_status text not null check(formula_status in (
     'reference_only','roll_or_special_required',
     'unknown_attack','unknown_attacker','unknown_defender',
     'ambiguous_attack','ambiguous_attacker','ambiguous_defender'
  )),
  notes text not null,
  created_at timestamptz not null default now(),
  primary key(lobby_id,turn_no),
  foreign key(lobby_id,turn_no)
    references public.chaotic_preview_damage(lobby_id,turn_no) on delete cascade
);
alter table public.chaotic_preview_modifiers enable row level security;
revoke all on public.chaotic_preview_modifiers from public,anon,authenticated;
grant select on public.chaotic_preview_modifiers to authenticated;
drop policy if exists chaotic_preview_modifiers_member_read on public.chaotic_preview_modifiers;
create policy chaotic_preview_modifiers_member_read on public.chaotic_preview_modifiers
  for select to authenticated using (
    exists(select 1 from public.chaotic_match_turns m
      where m.lobby_id=chaotic_preview_modifiers.lobby_id
        and ((select auth.uid())=m.host_id or (select auth.uid())=m.guest_id))
  );

-- Private pure formula, individually testable without a real match.
create or replace function public.chaotic_reference_modifier_formula(
  p_attack_id text,p_attacker_id text,p_defender_id text
) returns jsonb
language plpgsql stable set search_path=''
as $$
declare
  a public.chaotic_preview_card_reference;
  me public.chaotic_preview_card_reference;
  enemy public.chaotic_preview_card_reference;
  a_count integer;me_count integer;enemy_count integer;
  elements jsonb;
  bonus_elemental integer:=0;
  bonus_attribute integer:=0;
  wind integer:=0;
  result_status text;
  damage integer;
begin
  select count(*) into a_count from public.chaotic_preview_card_reference
    where kind='attack' and card_id=p_attack_id;
  select count(*) into me_count from public.chaotic_preview_card_reference
    where kind='creature' and card_id=p_attacker_id;
  select count(*) into enemy_count from public.chaotic_preview_card_reference
    where kind='creature' and card_id=p_defender_id;
  result_status:=case
    when a_count=0 then 'unknown_attack'
    when a_count>1 then 'ambiguous_attack'
    when me_count=0 then 'unknown_attacker'
    when me_count>1 then 'ambiguous_attacker'
    when enemy_count=0 then 'unknown_defender'
    when enemy_count>1 then 'ambiguous_defender'
    else 'reference_only'
  end;
  if result_status<>'reference_only' then
    return jsonb_build_object(
      'status',result_status,'base',null,'elemental',null,
      'attribute',null,'subtotal',null);
  end if;
  select * into a from public.chaotic_preview_card_reference
    where kind='attack' and card_id=p_attack_id;
  select * into me from public.chaotic_preview_card_reference
    where kind='creature' and card_id=p_attacker_id;
  select * into enemy from public.chaotic_preview_card_reference
    where kind='creature' and card_id=p_defender_id;
  elements:=coalesce(me.creature_elements,'[]'::jsonb);
  if jsonb_typeof(elements)<>'array' then elements:='[]'::jsonb; end if;
  if elements ? 'fogo' then
    bonus_elemental:=bonus_elemental+coalesce((a.element_damage->>'fogo')::integer,0);
  end if;
  if elements ? 'agua' then
    bonus_elemental:=bonus_elemental+coalesce((a.element_damage->>'agua')::integer,0);
  end if;
  if elements ? 'terra' then
    bonus_elemental:=bonus_elemental+coalesce((a.element_damage->>'terra')::integer,0);
  end if;
  if elements ? 'ar' or elements ? 'vento' then
    wind:=coalesce(nullif((a.element_damage->>'ar')::integer,0),
                   (a.element_damage->>'vento')::integer,0);
    bonus_elemental:=bonus_elemental+wind;
  end if;
  if a.attribute_check in ('coragem','poder','sabedoria','velocidade') then
    if coalesce((me.creature_stats->>a.attribute_check)::integer,0)>
       coalesce((enemy.creature_stats->>a.attribute_check)::integer,0) then
      bonus_attribute:=coalesce(a.attribute_bonus,0);
    end if;
  end if;
  -- Fogo Primordial's dice effect is resolved by the ORIGINAL engine, not this preview.
  if a.card_id='104' and a.card_name='Fogo Primordial 2.0' then
    return jsonb_build_object('status','roll_or_special_required',
      'base',a.base_damage,'elemental',bonus_elemental,
      'attribute',bonus_attribute,'subtotal',null);
  end if;
  damage:=greatest(0,coalesce(a.base_damage,0)+bonus_elemental+bonus_attribute);
  return jsonb_build_object('status','reference_only','base',a.base_damage,
    'elemental',bonus_elemental,'attribute',bonus_attribute,'subtotal',damage);
end;
$$;
revoke all on function public.chaotic_reference_modifier_formula(text,text,text)
  from public,anon,authenticated;

create or replace function public.chaotic_preview_calculate_modifiers(
  p_lobby_id uuid,p_expected_turn integer
) returns public.chaotic_preview_modifiers
language plpgsql security definer set search_path=''
as $$
declare
  actor uuid:=auth.uid();
  m public.chaotic_match_turns;
  l public.chaotic_lobbies;
  clash public.chaotic_preview_clashes;
  previous public.chaotic_preview_damage;
  parts jsonb;
  result public.chaotic_preview_modifiers;
begin
  if actor is null then raise exception 'Faça login'; end if;
  if p_lobby_id is null or p_expected_turn is null or p_expected_turn not between 1 and 120 then
    raise exception 'Turno inválido'; end if;
  select * into m from public.chaotic_match_turns
    where lobby_id=p_lobby_id for update;
  if not found then raise exception 'Partida de teste inexistente'; end if;
  if actor<>m.host_id and actor<>m.guest_id then
    raise exception 'Você não participa desta partida'; end if;
  if m.status<>'active' or m.current_player<>actor or m.turn_no<>p_expected_turn then
    raise exception 'Aguarde sua vez ou atualize o turno'; end if;
  select * into l from public.chaotic_lobbies where id=p_lobby_id;
  if not found or l.status<>'ready' or l.expires_at<=now()
    or l.host_id<>m.host_id or l.guest_id is distinct from m.guest_id then
    raise exception 'Sala indisponível'; end if;
  select * into previous from public.chaotic_preview_damage
    where lobby_id=p_lobby_id and turn_no=p_expected_turn;
  if not found then raise exception 'Calcule o dano base antes dos bônus'; end if;
  select * into clash from public.chaotic_preview_clashes
    where lobby_id=p_lobby_id and turn_no=p_expected_turn;
  if not found or clash.attacker_id<>actor or previous.attacker_id<>actor then
    raise exception 'Apenas o atacante do confronto pode conferir os bônus'; end if;
  if exists(select 1 from public.chaotic_preview_modifiers
    where lobby_id=p_lobby_id and turn_no=p_expected_turn) then
    raise exception 'Os bônus já foram registrados neste turno'; end if;
  parts:=public.chaotic_reference_modifier_formula(
    clash.attack_card,clash.attacker_card,clash.defender_card);
  insert into public.chaotic_preview_modifiers(
    lobby_id,turn_no,attacker_id,attack_card_id,attacker_card_id,defender_card_id,
    base_damage,elemental_bonus,attribute_bonus,reference_subtotal,formula_status,notes
  ) values(
    p_lobby_id,p_expected_turn,actor,clash.attack_card,clash.attacker_card,clash.defender_card,
    (parts->>'base')::integer,(parts->>'elemental')::integer,
    (parts->>'attribute')::integer,(parts->>'subtotal')::integer,
    parts->>'status',
    'Prévia usando apenas atributos/elementos BASE do catálogo; não aplica DNA, equipamentos, imunidades, efeitos, modificadores de local, rolagens, custo, HP nem XP.'
  ) returning * into result;
  return result;
end;
$$;
revoke all on function public.chaotic_preview_calculate_modifiers(uuid,integer)
  from public,anon,authenticated;
grant execute on function public.chaotic_preview_calculate_modifiers(uuid,integer) to authenticated;
do $$
begin
  if not exists(select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public'
      and tablename='chaotic_preview_modifiers') then
    alter publication supabase_realtime add table public.chaotic_preview_modifiers;
  end if;
end $$;
