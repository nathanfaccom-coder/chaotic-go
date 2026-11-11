-- Chaotic GO v0.1.132 — mutual rematch.
-- Applied in two audited migrations:
-- chaotic_mutual_rematch_lobby_v01132 and
-- chaotic_rematch_match_first_lock_order_v01132.
create table if not exists public.chaotic_rematch_requests (
 source_lobby_id uuid primary key references public.chaotic_lobbies(id) on delete cascade,
 host_accepted boolean not null default false,
 guest_accepted boolean not null default false,
 new_lobby_id uuid unique references public.chaotic_lobbies(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint chaotic_rematch_new_lobby_after_both
  check(new_lobby_id is null or(host_accepted and guest_accepted))
);
alter table public.chaotic_rematch_requests enable row level security;
revoke all on table public.chaotic_rematch_requests from public,anon,authenticated;
grant select on table public.chaotic_rematch_requests to authenticated;
drop policy if exists chaotic_rematch_original_participants_read
 on public.chaotic_rematch_requests;
create policy chaotic_rematch_original_participants_read
 on public.chaotic_rematch_requests for select to authenticated
 using(exists(select 1 from public.chaotic_lobbies l
  where l.id=source_lobby_id
   and ((select auth.uid())=l.host_id or (select auth.uid())=l.guest_id)
 ));

CREATE OR REPLACE FUNCTION public.chaotic_request_rematch(p_source_lobby_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 actor uuid:=auth.uid();
 old_room public.chaotic_lobbies;
 finished public.chaotic_match_turns;
 request public.chaotic_rematch_requests;
 new_room public.chaotic_lobbies;
begin
 if actor is null or p_source_lobby_id is null then
   raise exception 'Entre na conta para solicitar revanche';
 end if;
 -- Pre-authorize the participant before acquiring locks. Lock match
 -- first, then lobby, consistent with combat and loan restoration.
 if not exists (select 1 from public.chaotic_lobbies
                where id=p_source_lobby_id
                  and actor in (host_id,guest_id)) then
   raise exception 'Somente os dois participantes originais podem pedir revanche';
 end if;
 select * into finished from public.chaotic_match_turns
 where lobby_id=p_source_lobby_id for update;
 -- The source room lock serializes simultaneous player acceptance.
 select * into old_room from public.chaotic_lobbies
 where id=p_source_lobby_id for update;
 if old_room.id is null or old_room.guest_id is null
    or old_room.host_id=old_room.guest_id
    or actor not in (old_room.host_id,old_room.guest_id) then
   raise exception 'Somente os dois participantes originais podem pedir revanche';
 end if;
 select * into request from public.chaotic_rematch_requests
 where source_lobby_id=p_source_lobby_id for update;
 if request.new_lobby_id is not null then
   select * into new_room from public.chaotic_lobbies
     where id=request.new_lobby_id;
   if new_room.id is not null and new_room.status='ready'
       and new_room.expires_at>pg_catalog.statement_timestamp()
       and new_room.host_id=old_room.host_id
       and new_room.guest_id=old_room.guest_id
       and new_room.mode=old_room.mode then
      return pg_catalog.jsonb_build_object('state','ready',
         'new_lobby_id',new_room.id,'training_only',true);
   end if;
   raise exception 'A revanche anterior não está mais disponível';
 end if;
 if old_room.status<>'ready'
    or old_room.expires_at<=pg_catalog.statement_timestamp() then
   raise exception 'A sala original foi encerrada ou expirou';
 end if;
 if finished.lobby_id is null
   or finished.host_id is distinct from old_room.host_id
   or finished.guest_id is distinct from old_room.guest_id
   or (finished.status<>'finished' and not (
       old_room.mode='3x3' and exists (
        select 1 from public.chaotic_preview_3x3_training_outcomes out
        where out.lobby_id=old_room.id
         and out.outcome_scope='training_only_no_official_victory'
         and out.winner_id in (old_room.host_id,old_room.guest_id)
         and out.defeated_id in (old_room.host_id,old_room.guest_id)
         and out.winner_id<>out.defeated_id
       )
   )) then
   raise exception 'A revanche só é permitida depois da conclusão do treino';
 end if;
 if old_room.mode='3x3' and exists (
   select 1 from public.chaotic_preview_3x3_temporary_card_custody c
   where c.lobby_id=old_room.id
     and c.custody_state in ('held','reserved','used')
 ) then
   raise exception 'Devolva as cartas temporárias antes de iniciar a revanche';
 end if;
 if request.source_lobby_id is null then
   insert into public.chaotic_rematch_requests(source_lobby_id)
   values(p_source_lobby_id)
   returning * into request;
 end if;
 update public.chaotic_rematch_requests set
   host_accepted=host_accepted or actor=old_room.host_id,
   guest_accepted=guest_accepted or actor=old_room.guest_id,
   updated_at=pg_catalog.now()
 where source_lobby_id=p_source_lobby_id
 returning * into request;
 if not (request.host_accepted and request.guest_accepted) then
   return pg_catalog.jsonb_build_object('state','waiting_for_other_player',
       'new_lobby_id',null,'training_only',true);
 end if;
 -- Exactly one room is inserted: the source row lock and one-row PK
 -- serialize both acceptances. Close only THIS old lobby, never any
 -- unrelated active room of either participant.
 update public.chaotic_lobbies
   set status='cancelled',updated_at=pg_catalog.now()
 where id=old_room.id and status='ready';
 insert into public.chaotic_lobbies(
   code,host_id,guest_id,mode,status,expires_at
 ) values (
   pg_catalog.upper(pg_catalog.substr(
     pg_catalog.replace(pg_catalog.gen_random_uuid()::text,'-',''),1,12)),
   old_room.host_id,old_room.guest_id,old_room.mode,
   'ready',pg_catalog.now()+interval '2 hours'
 ) returning * into new_room;
 update public.chaotic_rematch_requests
   set new_lobby_id=new_room.id,updated_at=pg_catalog.now()
 where source_lobby_id=p_source_lobby_id;
 return pg_catalog.jsonb_build_object('state','ready',
   'new_lobby_id',new_room.id,'training_only',true);
end;
$function$

revoke all on function public.chaotic_request_rematch(uuid) from public,anon,authenticated;
grant execute on function public.chaotic_request_rematch(uuid) to authenticated;
