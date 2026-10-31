-- v0.1.78 privilege and anonymous-failure smoke (does not insert, update or delete user data).
do $smoke$
declare rejected boolean:=false;
begin
 if pg_catalog.has_function_privilege('anon',
  'public.chaotic_restore_expired_preview_3x3_loans(uuid)'::regprocedure,'execute')
 then raise exception 'Anonymous recovery improperly executable';end if;
 if not pg_catalog.has_function_privilege('authenticated',
  'public.chaotic_restore_expired_preview_3x3_loans(uuid)'::regprocedure,'execute')
 then raise exception 'Authenticated recovery missing';end if;
 begin
  perform public.chaotic_restore_expired_preview_3x3_loans(
    '00000000-0000-4000-8000-000000000001'::uuid);
 exception when others then rejected:=true;end;
 if not rejected then raise exception 'Anonymous recovery unexpectedly succeeded';end if;
end;
$smoke$;
select 'PASS v0.1.78 anonymous blocked, only authenticated role callable' as result;
