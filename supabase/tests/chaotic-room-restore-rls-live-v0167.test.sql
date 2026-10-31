-- Chaotic GO v0.1.67: independently validate RLS on saved room IDs.
-- Synthetic auth identities and room exist only inside this rolled-back transaction.
begin;
insert into auth.users(id,instance_id,role,aud,email,created_at,updated_at)
values
('a1670000-0000-4000-8000-000000000167','00000000-0000-0000-0000-000000000000','authenticated','authenticated','chaotic-v167-host@example.invalid',now(),now()),
('b1670000-0000-4000-8000-000000000167','00000000-0000-0000-0000-000000000000','authenticated','authenticated','chaotic-v167-guest@example.invalid',now(),now());
insert into public.chaotic_lobbies(id,code,host_id,guest_id,mode,status)
values('c1670000-0000-4000-8000-000000000167','C16700000001',
 'a1670000-0000-4000-8000-000000000167',
 'b1670000-0000-4000-8000-000000000167','3x3','ready');
set local role authenticated;
do $rls$
declare
 target_room uuid:='c1670000-0000-4000-8000-000000000167';
 host_actor uuid:='a1670000-0000-4000-8000-000000000167';
 guest_actor uuid:='b1670000-0000-4000-8000-000000000167';
 outsider_actor uuid:='d1670000-0000-4000-8000-000000000167';
 n integer;
begin
 perform set_config('request.jwt.claim.sub',host_actor::text,true);
 select count(*) into n from public.chaotic_lobbies l where l.id=target_room;
 if n<>1 then raise exception 'Host cannot restore own room (%)',n;end if;
 perform set_config('request.jwt.claim.sub',guest_actor::text,true);
 select count(*) into n from public.chaotic_lobbies l where l.id=target_room;
 if n<>1 then raise exception 'Guest cannot restore invited room (%)',n;end if;
 perform set_config('request.jwt.claim.sub',outsider_actor::text,true);
 select count(*) into n from public.chaotic_lobbies l where l.id=target_room;
 if n<>0 then raise exception 'Outsider may read forged room ID (%)',n;end if;
end $rls$;
reset role;
rollback;
select 'PASS v0.1.67: host/guest can reload private room, outsider blocked by RLS, rolled back' as result;