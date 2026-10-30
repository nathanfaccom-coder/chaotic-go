-- Chaotic GO: authoritative read-only snapshots of original cards for BASE DAMAGE diagnostics.
-- Not a replacement for original damage engine (effects, burst, elemental, immunities).
create table if not exists public.chaotic_preview_card_reference (
  kind text not null check (kind in ('attack','creature')),
  card_id text not null,
  card_name text not null,
  base_damage integer check(base_damage between 0 and 500),
  energy_base integer check(energy_base between 0 and 500),
  attack_cost integer check(attack_cost between 0 and 50),
  effect_text text,
  primary key(kind,card_id,card_name)
);
alter table public.chaotic_preview_card_reference enable row level security;
revoke all on public.chaotic_preview_card_reference from public,anon,authenticated;
insert into public.chaotic_preview_card_reference
(kind,card_id,card_name,base_damage,energy_base,attack_cost,effect_text) values
  ('attack','101','Ácido Gástrico',10,NULL,3,'Remove o equipamento do campeão ativo do oponente.'),
  ('attack','102','Mão Negra',0,NULL,0,'Pegue uma carta aleatória de ataque da mão do seu oponente.'),
  ('attack','103','Aliança',0,NULL,2,'Escolha um campeão derrotado seu, o valor da metade da energia dele é recuperado no seu campeão ativo.'),
  ('attack','104','Fogo Primordial 2.0',5,NULL,2,'Rode um dado de 6 lados. O valor será multiplicado com o dano base desta carta e passa a ser o dano total.'),
  ('attack','105','Vento Forte',5,NULL,1,'Se este ataque for bem sucedido você pode revelar 1 campeão que esteja virado para baixo do seu oponente.'),
  ('attack','106','Armadilha de Víbora',15,NULL,3,'Causa envenenamento. A cada turno do seu oponente, a criatura atingida perde 5 de energia. Este efeito não pode ser curado.'),
  ('attack','107','Armadilha de Vinha',5,NULL,1,'Causa 5 de dano de Terra. Seu oponente não pode atacar, ativar habilidades, magias e nem comprar cartas no próximo turno.'),
  ('attack','108','SPEED',0,NULL,0,'Compre mais 1 carta do monte de cartas de ataque.'),
  ('attack','109','TORNADO',0,NULL,0,'Seu oponente embaralha a mão de cartas de ataque dele no monte e depois compra 2 cartas. Só pode ser usado se o seu campeão ativo tiver o elemento Ar.'),
  ('attack','110','SONAR',0,NULL,2,'Pegue uma carta de ataque de custo 1 ou inferior do monte e adicione na sua mão.'),
  ('attack','111','MÃO ELETRÔNICA',10,NULL,3,'Causa 10 de Dano. Seu oponente não pode atacar nos 2 próximos turnos.'),
  ('attack','112','MÃO MÃO',5,NULL,1,'Causa 5 de Dano. Seu oponente não pode atacar no próximo turno.'),
  ('attack','113','PURGATÓRIO',0,NULL,0,'Causa 0 de Dano. Ganha +5 de Dano extra para cada campeão seu derrotado (no cemitério).'),
  ('attack','114','ESQUELETO',10,NULL,2,'Causa 10 de Dano. Ganha +5 de Dano extra para cada campeão seu derrotado (no cemitério).'),
  ('attack','115','SOPRO',0,NULL,0,'Pegue uma carta aleatória de ataque da mão do seu oponente e descarte.'),
  ('attack','104','Golpe de Bravura',10,NULL,1,'Ganha +10 de dano extra se você for mais corajoso que o oponente.'),
  ('creature','1','Johnes',NULL,45,NULL,NULL),
  ('creature','2','Promos',NULL,25,NULL,NULL),
  ('creature','3','Alakazaz',NULL,10,NULL,NULL),
  ('creature','4','Alfel',NULL,40,NULL,NULL),
  ('creature','5','Ferez',NULL,40,NULL,NULL),
  ('creature','6','Frador',NULL,35,NULL,NULL),
  ('creature','7','Gaturno',NULL,50,NULL,NULL),
  ('creature','8','Guru',NULL,25,NULL,NULL),
  ('creature','9','Horn-ey',NULL,50,NULL,NULL),
  ('creature','10','Leona',NULL,35,NULL,NULL),
  ('creature','11','Lion',NULL,25,NULL,NULL),
  ('creature','12','Naty',NULL,35,NULL,NULL),
  ('creature','13','Rex',NULL,25,NULL,NULL),
  ('creature','14','Spedman',NULL,35,NULL,NULL),
  ('creature','15','Vidal',NULL,30,NULL,NULL),
  ('creature','16','Xamã',NULL,15,NULL,NULL)
on conflict (kind,card_id,card_name) do update
  set base_damage=excluded.base_damage,energy_base=excluded.energy_base,
      attack_cost=excluded.attack_cost,effect_text=excluded.effect_text;

-- Does NOT change hit points: merely records which base damage and energy values
-- the original definitions imply, if and only if both card IDs are unambiguous.
create table if not exists public.chaotic_preview_damage (
  lobby_id uuid not null,
  turn_no integer not null,
  attacker_id uuid not null references auth.users(id),
  defender_id uuid not null references auth.users(id),
  attack_card_id text not null,
  attack_name text,
  base_damage integer,
  defender_name text,
  defender_energy_base integer,
  energy_after_base integer,
  calculation_status text not null check (
    calculation_status in ('base_only','ambiguous_attack_id','unknown_attack_id',
      'ambiguous_creature_id','unknown_creature_id')
  ),
  created_at timestamptz not null default now(),
  primary key(lobby_id,turn_no),
  foreign key(lobby_id,turn_no)
    references public.chaotic_preview_clashes(lobby_id,turn_no) on delete cascade
);
alter table public.chaotic_preview_damage enable row level security;
revoke all on public.chaotic_preview_damage from public,anon,authenticated;
grant select on public.chaotic_preview_damage to authenticated;
drop policy if exists chaotic_preview_damage_member_read on public.chaotic_preview_damage;
create policy chaotic_preview_damage_member_read on public.chaotic_preview_damage
  for select to authenticated using (
    exists (select 1 from public.chaotic_match_turns m
      where m.lobby_id=chaotic_preview_damage.lobby_id
        and ((select auth.uid())=m.host_id or (select auth.uid())=m.guest_id))
  );

create or replace function public.chaotic_preview_calculate_base_damage(
  p_lobby_id uuid,p_expected_turn integer
) returns public.chaotic_preview_damage
language plpgsql security definer set search_path=''
as $$
declare
  actor uuid:=auth.uid();
  m public.chaotic_match_turns;
  l public.chaotic_lobbies;
  clash public.chaotic_preview_clashes;
  attack_count integer;
  defender_count integer;
  base integer;
  max_energy integer;
  attack_name text;
  defender_name text;
  decision text;
  result public.chaotic_preview_damage;
begin
  if actor is null then raise exception 'Faça login'; end if;
  if p_lobby_id is null or p_expected_turn is null or p_expected_turn not between 1 and 120 then
    raise exception 'Turno inválido'; end if;
  select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id for update;
  if not found then raise exception 'Partida de teste inexistente'; end if;
  if actor<>m.host_id and actor<>m.guest_id then raise exception 'Jogador não autorizado'; end if;
  if m.status<>'active' or m.current_player<>actor or m.turn_no<>p_expected_turn then
    raise exception 'Não é sua vez ou o turno mudou'; end if;
  select * into l from public.chaotic_lobbies where id=p_lobby_id;
  if not found or l.status<>'ready' or l.expires_at<=now()
    or l.host_id<>m.host_id or l.guest_id is distinct from m.guest_id then
    raise exception 'Sala indisponível'; end if;
  select * into clash from public.chaotic_preview_clashes
    where lobby_id=p_lobby_id and turn_no=p_expected_turn;
  if not found then raise exception 'Registre um confronto validado antes do cálculo'; end if;
  if clash.attacker_id<>actor then raise exception 'Apenas o atacante calcula esta prévia'; end if;
  if exists(select 1 from public.chaotic_preview_damage
    where lobby_id=p_lobby_id and turn_no=p_expected_turn) then
    raise exception 'O cálculo já foi registrado para este turno'; end if;

  select count(*),min(base_damage),min(card_name) into attack_count,base,attack_name
    from public.chaotic_preview_card_reference
    where kind='attack' and card_id=clash.attack_card;
  select count(*),min(energy_base),min(card_name) into defender_count,max_energy,defender_name
    from public.chaotic_preview_card_reference
    where kind='creature' and card_id=clash.defender_card;
  decision:=case
    when attack_count=0 then 'unknown_attack_id'
    when attack_count>1 then 'ambiguous_attack_id'
    when defender_count=0 then 'unknown_creature_id'
    when defender_count>1 then 'ambiguous_creature_id'
    else 'base_only'
  end;
  if decision<>'base_only' then
    base:=null;max_energy:=null;attack_name:=null;defender_name:=null;
  end if;
  insert into public.chaotic_preview_damage(
    lobby_id,turn_no,attacker_id,defender_id,attack_card_id,
    attack_name,base_damage,defender_name,defender_energy_base,energy_after_base,
    calculation_status
  ) values (
    p_lobby_id,p_expected_turn,actor,clash.defender_id,clash.attack_card,
    attack_name,base,defender_name,max_energy,
    case when decision='base_only' then greatest(0,max_energy-base) else null end,
    decision
  ) returning * into result;
  return result;
end;
$$;
revoke all on function public.chaotic_preview_calculate_base_damage(uuid,integer)
  from public,anon,authenticated;
grant execute on function public.chaotic_preview_calculate_base_damage(uuid,integer) to authenticated;
do $$
begin
  if not exists(select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public'
      and tablename='chaotic_preview_damage') then
    alter publication supabase_realtime add table public.chaotic_preview_damage;
  end if;
end $$;
