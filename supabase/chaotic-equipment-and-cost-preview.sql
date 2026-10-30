-- Chaotic GO 0.1.10: experimental equipment reveals and conservative damage diagnostics.
-- No real HP, attack points, equipment effects, XP or economy are changed.
-- The client-writable album is NOT trusted for competitive ownership or anti-cheat.
create table if not exists public.chaotic_preview_equipment_reveals (
 lobby_id uuid not null,
 actor_id uuid not null references auth.users(id) on delete cascade,
 equipment_instance_id text not null,
 equipment_name text not null check (length(equipment_name) between 1 and 120),
 revealed_turn integer not null check (revealed_turn between 1 and 120),
 created_at timestamptz not null default now(),
 primary key(lobby_id, actor_id),
 foreign key(lobby_id,actor_id) references public.chaotic_preview_loadouts(lobby_id,actor_id) on delete cascade
);
alter table public.chaotic_preview_equipment_reveals enable row level security;
revoke all on public.chaotic_preview_equipment_reveals from public,anon,authenticated;
grant select on public.chaotic_preview_equipment_reveals to authenticated;
drop policy if exists chaotic_preview_equipment_member_read on public.chaotic_preview_equipment_reveals;
create policy chaotic_preview_equipment_member_read
 on public.chaotic_preview_equipment_reveals for select to authenticated using (
   exists (select 1 from public.chaotic_match_turns m
     where m.lobby_id=chaotic_preview_equipment_reveals.lobby_id
     and ((select auth.uid())=m.host_id or (select auth.uid())=m.guest_id))
 );

create or replace function public.chaotic_reveal_preview_equipment(
 p_lobby_id uuid,p_expected_turn integer
) returns public.chaotic_preview_equipment_reveals
language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid := auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 item public.chaotic_preview_loadouts;
 result public.chaotic_preview_equipment_reveals;
begin
 if actor is null then raise exception 'Faça login'; end if;
 if p_lobby_id is null or p_expected_turn is null or p_expected_turn not between 1 and 120 then
   raise exception 'Turno inválido'; end if;
 select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id for update;
 if not found then raise exception 'Partida não encontrada'; end if;
 if actor<>m.host_id and actor<>m.guest_id then raise exception 'Acesso negado'; end if;
 if m.status<>'active' or m.current_player<>actor or m.turn_no<>p_expected_turn then
   raise exception 'Não é sua vez ou turno desatualizado'; end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.mode<>'1x1' or l.status<>'ready' or l.expires_at<=now()
   or l.host_id<>m.host_id or l.guest_id is distinct from m.guest_id then
   raise exception 'Apenas em sala 1x1 ativa'; end if;
 select * into item from public.chaotic_preview_loadouts
   where lobby_id=p_lobby_id and actor_id=actor;
 if not found or item.equipment_instance_id is null or item.equipment_name is null then
   raise exception 'Prepare primeiro uma ficha com equipamento válido'; end if;
 if exists(select 1 from public.chaotic_preview_equipment_reveals
   where lobby_id=p_lobby_id and actor_id=actor) then
   raise exception 'Equipamento já revelado nesta partida'; end if;
 insert into public.chaotic_preview_equipment_reveals
 (lobby_id,actor_id,equipment_instance_id,equipment_name,revealed_turn)
 values(p_lobby_id,actor,item.equipment_instance_id,item.equipment_name,p_expected_turn)
 returning * into result;
 return result;
end;
$fn$;
revoke all on function public.chaotic_reveal_preview_equipment(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_reveal_preview_equipment(uuid,integer)
 to authenticated;

alter table public.chaotic_preview_individual_damage
 add column if not exists attack_cost integer check (attack_cost between 0 and 50),
 add column if not exists cost_status text not null default 'not_verified' check (cost_status='not_verified'),
 add column if not exists equipment_bonus integer not null default 0 check (equipment_bonus between 0 and 50),
 add column if not exists attacker_equipment_revealed boolean not null default false,
 add column if not exists defender_equipment_revealed boolean not null default false,
 add column if not exists immunity_reason text;

-- Deterministic *diagnostic*, not the real burst engine. Unknown interactions
-- deliberately produce NO subtotal/HP. Equipment affects calculations only
-- after server recorded its reveal; no retroactive edits to earlier snapshots.
create or replace function public.chaotic_preview_equipment_formula(
 p_attack_id text,
 p_attacker_name text,
 p_attacker_stats jsonb,
 p_defender_stats jsonb,
 p_attacker_equipment text,
 p_attacker_revealed boolean,
 p_defender_name text,
 p_defender_equipment text,
 p_defender_revealed boolean
) returns jsonb
language plpgsql stable security invoker set search_path=''
as $fn$
declare
 parts jsonb;
 reference public.chaotic_preview_card_reference;
 attack_count integer;
 elem integer;
 bonus integer:=0;
 attr integer;
 base integer;
 subtotal integer;
 special boolean;
 unresolved boolean:=false;
 wind_damage boolean:=false;
 earth_damage boolean:=false;
 water_damage boolean:=false;
 immunity text:=null;
 explanation text:='';
 attacker_eq text:=pg_catalog.lower(pg_catalog.btrim(coalesce(p_attacker_equipment,'')));
 defender_eq text:=pg_catalog.lower(pg_catalog.btrim(coalesce(p_defender_equipment,'')));
 defender_label text:=pg_catalog.regexp_replace(coalesce(p_defender_name,''),' [(]Max[)]$','');
begin
 parts:=public.chaotic_preview_individual_parts(
   p_attack_id,p_attacker_name,p_attacker_stats,p_defender_stats);
 select count(*) into attack_count from public.chaotic_preview_card_reference
   where kind='attack' and card_id=p_attack_id;
 if attack_count<>1 then raise exception 'Ataque ambíguo'; end if;
 select * into reference from public.chaotic_preview_card_reference
   where kind='attack' and card_id=p_attack_id;
 base:=(parts->>'base')::integer;
 elem:=(parts->>'elemental')::integer;
 attr:=(parts->>'attribute')::integer;
 wind_damage:=coalesce((reference.element_damage->>'ar')::integer,0)>0
   or coalesce((reference.element_damage->>'vento')::integer,0)>0;
 earth_damage:=coalesce((reference.element_damage->>'terra')::integer,0)>0;
 water_damage:=coalesce((reference.element_damage->>'agua')::integer,0)>0;

 if p_attacker_revealed then
   if attacker_eq in ('bracelete de cristal','bracelete da terra') and earth_damage then
     bonus:=bonus+5;
   elsif attacker_eq in ('bracelete de água','bracelete de agua') and water_damage then
     bonus:=bonus+5;
   elsif attacker_eq not in ('bracelete de cristal','bracelete da terra','bracelete de água',
      'bracelete de agua','anel precioso','amuleto do vácuo') then
      unresolved:=true;
      explanation:=explanation||'Equipamento atacante exige efeito ainda não resolvido. ';
   end if;
 end if;
 if p_defender_revealed then
   if defender_eq='anel precioso' then
     elem:=0;
     unresolved:=true;
     explanation:=explanation||'Anel Precioso neutraliza bônus elementais e retira 15 de energia ao revelar; HP não simulado. ';
   elsif defender_eq not in ('amuleto do vácuo','bracelete de cristal','bracelete da terra',
      'bracelete de água','bracelete de agua') then
     unresolved:=true;
     explanation:=explanation||'Efeito do equipamento defensor ainda não resolvido. ';
   end if;
 end if;

 if wind_damage and (defender_label='Rex' or
   (p_defender_revealed and defender_eq='amuleto do vácuo')) then
   immunity:=case when defender_label='Rex' then 'Rex: imune a Ar'
      else 'Amuleto do Vácuo revelado: imune a Ar' end;
 end if;

 special:=parts->>'status'='special_resolution_required';
 if special then explanation:=explanation||'Ataque exige dado ou efeito especial. ';end if;
 -- Insufficient server-verified resources, attack hand, equipment state or
 -- special effects must never be advertised as *actual* applied damage.
 subtotal:=case when special or unresolved then null
    when immunity is not null then 0
    else greatest(0,base+elem+attr+bonus) end;
 return pg_catalog.jsonb_build_object(
   'status',case when subtotal is null then 'special_resolution_required' else 'partial_estimate' end,
   'base',base,'elemental',elem,'attribute',attr,'equipment_bonus',bonus,
   'immunity_reason',immunity,'subtotal',subtotal,
   'explanation',pg_catalog.btrim(explanation));
end;
$fn$;
revoke all on function public.chaotic_preview_equipment_formula(text,text,jsonb,jsonb,text,boolean,text,text,boolean)
 from public,anon,authenticated;

create or replace function public.chaotic_calculate_individual_preview(
 p_lobby_id uuid,p_expected_turn integer
) returns public.chaotic_preview_individual_damage
language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid := auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 clash public.chaotic_preview_clashes;
 attack public.chaotic_preview_attack_instances;
 attacker public.chaotic_preview_loadouts;
 defender public.chaotic_preview_loadouts;
 equip_a public.chaotic_preview_equipment_reveals;
 equip_d public.chaotic_preview_equipment_reveals;
 revealed_a boolean:=false;
 revealed_d boolean:=false;
 parts jsonb;
 subtotal integer;
 energy integer;
 result public.chaotic_preview_individual_damage;
begin
 if actor is null then raise exception 'Faça login'; end if;
 if p_lobby_id is null or p_expected_turn is null or p_expected_turn not between 1 and 120 then
   raise exception 'Turno inválido'; end if;
 select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id for update;
 if not found then raise exception 'Partida inexistente';end if;
 if actor<>m.host_id and actor<>m.guest_id then raise exception 'Não é participante';end if;
 if m.status<>'active' or m.current_player<>actor or m.turn_no<>p_expected_turn then
   raise exception 'Não é sua vez ou turno desatualizado';end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.mode<>'1x1' or l.status<>'ready' or l.expires_at<=now()
    or l.host_id<>m.host_id or l.guest_id is distinct from m.guest_id then
    raise exception 'Sala de teste 1x1 indisponível';end if;
 select * into clash from public.chaotic_preview_clashes
    where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 if not found or clash.attacker_id<>actor then raise exception 'Registre confronto primeiro';end if;
 select * into attack from public.chaotic_preview_attack_instances
    where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 if not found or attack.actor_id<>actor
   or attack.attack_instance_id<>clash.attack_card then
   raise exception 'Ataque individual inválido ou não validado'; end if;
 select * into attacker from public.chaotic_preview_loadouts
    where lobby_id=p_lobby_id and actor_id=actor;
 if not found or attacker.card_instance_id<>clash.attacker_card then
    raise exception 'Ficha individual atacante incompatível';end if;
 select * into defender from public.chaotic_preview_loadouts
    where lobby_id=p_lobby_id and actor_id=clash.defender_id;
 if not found or defender.card_instance_id<>clash.defender_card then
    raise exception 'Ficha individual defensora incompatível';end if;
 if exists(select 1 from public.chaotic_preview_individual_damage
   where lobby_id=p_lobby_id and turn_no=p_expected_turn) then
   raise exception 'Simulação já registrada';end if;

 select * into equip_a from public.chaotic_preview_equipment_reveals
   where lobby_id=p_lobby_id and actor_id=actor and revealed_turn<=p_expected_turn;
 revealed_a:=found;
 select * into equip_d from public.chaotic_preview_equipment_reveals
   where lobby_id=p_lobby_id and actor_id=clash.defender_id and revealed_turn<=p_expected_turn;
 revealed_d:=found;

 parts:=public.chaotic_preview_equipment_formula(
   attack.catalog_attack_id,attacker.creature_name,attacker.stats,defender.stats,
   attacker.equipment_name,revealed_a,
   defender.creature_name,defender.equipment_name,revealed_d);
 subtotal:=(parts->>'subtotal')::integer;
 energy:=(defender.stats->>'e')::integer;
 if energy not between 1 and 500 then raise exception 'Energia individual inválida';end if;
 if attack.attack_cost not between 0 and 50 then
    raise exception 'Custo inválido';end if;
 insert into public.chaotic_preview_individual_damage (
   lobby_id,turn_no,attacker_id,defender_id,attack_instance_id,catalog_attack_id,
   attack_name,attacker_instance_id,defender_instance_id,attacker_name,defender_name,
   defender_energy_initial,base_damage,elemental_bonus,attribute_bonus,
   preview_subtotal,preview_energy_remaining,calculation_status,notes,
   attack_cost,cost_status,equipment_bonus,attacker_equipment_revealed,
   defender_equipment_revealed,immunity_reason
 ) values(
   p_lobby_id,p_expected_turn,actor,clash.defender_id,attack.attack_instance_id,
   attack.catalog_attack_id,attack.attack_name,attacker.card_instance_id,
   defender.card_instance_id,attacker.creature_name,defender.creature_name,
   energy,(parts->>'base')::integer,(parts->>'elemental')::integer,
   (parts->>'attribute')::integer,subtotal,
   case when subtotal is null then null else greatest(0,energy-subtotal) end,
   parts->>'status',
   'Prévia NÃO-oficial: pontos de ataque e mão NÃO são verificados; custos NÃO são debitados. Equipamentos sem efeitos completos, habilidades, imunidades adicionais, locais, Burst e vitórias NÃO são resolvidos. '
    || coalesce(parts->>'explanation',''),
   attack.attack_cost,'not_verified',
   (parts->>'equipment_bonus')::integer,revealed_a,revealed_d,
   parts->>'immunity_reason'
 ) returning * into result;
 return result;
end;
$fn$;
revoke all on function public.chaotic_calculate_individual_preview(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_calculate_individual_preview(uuid,integer) to authenticated;

do $$
begin
 if not exists (select 1 from pg_publication_tables
   where pubname='supabase_realtime' and schemaname='public'
   and tablename='chaotic_preview_equipment_reveals') then
   alter publication supabase_realtime add table public.chaotic_preview_equipment_reveals;
 end if;
end $$;
