-- Chaotic GO v0.1.76: PRIVATE read-only borrowed attack details for the borrower.
-- Nothing is copied/moved into the borrower's original album or deck.
-- Original Black Hand 102 remains unpayable; this is an isolated custody preview.
create or replace function public.chaotic_get_preview_3x3_borrowed_attacks(
 p_lobby_id uuid
) returns jsonb
language plpgsql stable security definer set search_path=''
as $borrowed$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 loan public.chaotic_preview_3x3_temporary_card_custody;
 original_card public.chaotic_preview_3x3_attack_hand;
 raw_album jsonb;
 album_items jsonb;
 card_record jsonb;
 matches integer;
 canonical public.chaotic_preview_card_reference;
 borrowed jsonb:='[]'::jsonb;
begin
 if actor is null or p_lobby_id is null
 then raise exception 'Faça login e escolha uma sala de treinamento';end if;
 select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if m.lobby_id is null or l.id is null
   or actor not in(m.host_id,m.guest_id)
   or m.host_id is distinct from l.host_id
   or m.guest_id is distinct from l.guest_id
   or l.mode<>'3x3' or l.status<>'ready'
   or l.expires_at<=pg_catalog.statement_timestamp()
   or m.status<>'active'
 then raise exception 'Somente participantes de uma partida 3x3 ativa podem consultar suas cartas emprestadas';end if;
 for loan in
  select * from public.chaotic_preview_3x3_temporary_card_custody c
  where c.lobby_id=p_lobby_id and c.borrower_id=actor
    and c.custody_state='held' and c.training_only
  order by c.granted_turn,c.id
 loop
  if loan.source_actor_id not in(m.host_id,m.guest_id)
     or loan.source_actor_id=actor or loan.granted_turn>m.turn_no
  then raise exception 'Registro de empréstimo fora da partida/turno';end if;
  select * into original_card from public.chaotic_preview_3x3_attack_hand h
   where h.lobby_id=p_lobby_id and h.actor_id=loan.source_actor_id
     and h.card_slot=loan.source_card_slot;
  if original_card.lobby_id is null
   or original_card.card_state<>'loaned'
   or original_card.attack_instance_id is distinct from loan.source_attack_instance_id
  then raise exception 'Carta emprestada não corresponde ao Deck do dono';end if;
  select g.data into raw_album from public.chaotic_game_nodes g
   where g.user_id=loan.source_actor_id and g.node_path='album';
  if pg_catalog.jsonb_typeof(raw_album)='array' then
    album_items:=raw_album;
  elsif pg_catalog.jsonb_typeof(raw_album)='object' then
    select coalesce(pg_catalog.jsonb_agg(x.value),'[]'::jsonb)
    into album_items from pg_catalog.jsonb_each(raw_album) x;
  else
    raise exception 'Álbum original da carta emprestada indisponível';end if;
  select count(*),min(x.value::text)::jsonb
   into matches,card_record
  from pg_catalog.jsonb_array_elements(album_items) x(value)
  where x.value->>'id'=loan.source_attack_instance_id
    and x.value->>'tipoCarta'='Ataque';
  if matches<>1 then raise exception 'Instância emprestada sem prova única no álbum original';end if;
  select * into canonical from public.chaotic_preview_card_reference c
   where c.kind='attack'
    and c.card_id=loan.catalog_attack_id
    and c.card_name=card_record->>'nome';
  if canonical.card_id is null or canonical.base_damage is null or canonical.attack_cost is null
   or (card_record ? 'danoBase' and
    (card_record->>'danoBase' !~ '^[0-9]{1,3}$'
      or (card_record->>'danoBase')::integer<>canonical.base_damage))
   or (card_record ? 'custo' and
    (card_record->>'custo' !~ '^[0-9]{1,3}$'
      or (card_record->>'custo')::integer<>canonical.attack_cost))
  then raise exception 'Ataque emprestado não corresponde ao catálogo original';end if;
  borrowed:=borrowed||pg_catalog.jsonb_build_array(
    pg_catalog.jsonb_build_object(
      'custody_id',loan.id,
      'catalog_attack_id',canonical.card_id,
      'attack_name',canonical.card_name,
      'attack_cost',canonical.attack_cost,
      'base_damage',canonical.base_damage,
      'borrowed_on_turn',loan.granted_turn,
      'ownership_transferred',false,
      'training_only',true,
      'playable',false,
      'payment_enabled',false));
 end loop;
 return pg_catalog.jsonb_build_object(
   'borrowed_attacks',borrowed,
   'held_count',pg_catalog.jsonb_array_length(borrowed),
   'ownership_transferred',false,
   'training_only',true,
   'playable',false,
   'payment_enabled',false);
end;
$borrowed$;
revoke all on function public.chaotic_get_preview_3x3_borrowed_attacks(uuid)
 from public,anon,authenticated;
grant execute on function public.chaotic_get_preview_3x3_borrowed_attacks(uuid)
 to authenticated;
