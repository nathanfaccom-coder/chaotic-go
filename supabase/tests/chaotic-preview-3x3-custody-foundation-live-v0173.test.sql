-- Chaotic GO 0.1.73 temporary custody: RLS + read-only, transaction rolled back.
begin;
insert into auth.users(id,instance_id,role,aud,email,created_at,updated_at)
select id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',label||'@example.invalid',now(),now()
from (values
('a1730000-0000-4000-8000-000000000173'::uuid,'custody-owner-v173'),
('b1730000-0000-4000-8000-000000000173'::uuid,'custody-borrower-v173'),
('c1730000-0000-4000-8000-000000000173'::uuid,'custody-outsider-v173')) v(id,label);
insert into public.chaotic_lobbies(id,code,host_id,guest_id,mode,status)
values('d1730000-0000-4000-8000-000000000173','A17300000001',
'a1730000-0000-4000-8000-000000000173','b1730000-0000-4000-8000-000000000173','3x3','ready');
insert into public.chaotic_match_turns(lobby_id,host_id,guest_id,current_player,turn_no)
values('d1730000-0000-4000-8000-000000000173',
'a1730000-0000-4000-8000-000000000173','b1730000-0000-4000-8000-000000000173',
'a1730000-0000-4000-8000-000000000173',1);
insert into public.chaotic_preview_3x3_temporary_card_custody
(lobby_id,source_actor_id,borrower_id,source_card_slot,source_attack_instance_id,catalog_attack_id,granted_turn)
values('d1730000-0000-4000-8000-000000000173',
'a1730000-0000-4000-8000-000000000173',
'b1730000-0000-4000-8000-000000000173',3,'private-owner-card','105',1);
set local role authenticated;
do $test$
declare
 lobby uuid:='d1730000-0000-4000-8000-000000000173';
 source uuid:='a1730000-0000-4000-8000-000000000173';
 borrower uuid:='b1730000-0000-4000-8000-000000000173';
 outsider uuid:='c1730000-0000-4000-8000-000000000173';
 cnt integer; failure text;
begin
 perform set_config('request.jwt.claim.sub',source::text,true);
 select count(*) into cnt from public.chaotic_preview_3x3_temporary_card_custody where lobby_id=lobby;
 if cnt<>1 then raise exception 'Owner cannot see custody';end if;
 perform set_config('request.jwt.claim.sub',borrower::text,true);
 select count(*) into cnt from public.chaotic_preview_3x3_temporary_card_custody where lobby_id=lobby;
 if cnt<>1 then raise exception 'Borrower cannot see custody';end if;
 failure:=null;
 begin
 insert into public.chaotic_preview_3x3_temporary_card_custody
 (lobby_id,source_actor_id,borrower_id,source_card_slot,source_attack_instance_id,catalog_attack_id,granted_turn)
 values(lobby,source,borrower,4,'forged-card','104',1);
 exception when others then get stacked diagnostics failure=message_text;end;
 if failure is null then raise exception 'Client forged custody';end if;
 perform set_config('request.jwt.claim.sub',outsider::text,true);
 select count(*) into cnt from public.chaotic_preview_3x3_temporary_card_custody where lobby_id=lobby;
 if cnt<>0 then raise exception 'Outsider can see custody';end if;
end $test$;
reset role;
rollback;
select 'PASS 0.1.73: authenticated owner/borrower see private custody, outsider blocked, client insert denied, rollback' as result;