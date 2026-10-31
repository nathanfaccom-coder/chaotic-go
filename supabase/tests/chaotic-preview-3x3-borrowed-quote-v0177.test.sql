-- v0.1.77: privilege + fail-closed smoke tests; no persistent synthetic users.
begin;
do $audit$
declare
 fn regprocedure:=to_regprocedure('public.chaotic_quote_preview_3x3_borrowed_attack(uuid,uuid,integer)');
 was_rejected boolean:=false;
 body text;
begin
 if fn is null then raise exception 'Borrowed quote RPC not installed';end if;
 if pg_catalog.has_function_privilege('anon',fn,'execute')
 then raise exception 'Anonymous visitors may quote borrowed cards';end if;
 if not pg_catalog.has_function_privilege('authenticated',fn,'execute')
 then raise exception 'Authenticated borrowers cannot quote cards';end if;
 body:=pg_catalog.pg_get_functiondef(fn::oid);
 if body ~* '\m(insert[[:space:]]+into|update[[:space:]]+public[.]|delete[[:space:]]+from)\M'
 then raise exception 'Read-only quote unexpectedly mutates tables';end if;
 perform pg_catalog.set_config('request.jwt.claim.sub','',true);
 begin
  perform public.chaotic_quote_preview_3x3_borrowed_attack(
   '00000000-0000-0000-0000-000000000001'::uuid,
   '00000000-0000-0000-0000-000000000002'::uuid,1);
 exception when others then was_rejected:=true; end;
 if not was_rejected then raise exception 'Anonymous quote unexpectedly succeeded';end if;
 was_rejected:=false;
 perform pg_catalog.set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
 begin
  perform public.chaotic_quote_preview_3x3_borrowed_attack(
   '00000000-0000-0000-0000-000000000001'::uuid,
   '00000000-0000-0000-0000-000000000002'::uuid,1);
 exception when others then was_rejected:=true; end;
 if not was_rejected then raise exception 'Nonmember quote unexpectedly succeeded';end if;
 was_rejected:=false;
 begin
  perform public.chaotic_quote_preview_3x3_borrowed_attack(
   '00000000-0000-0000-0000-000000000001'::uuid,
   '00000000-0000-0000-0000-000000000002'::uuid,121);
 exception when others then was_rejected:=true; end;
 if not was_rejected then raise exception 'Invalid turn quote unexpectedly succeeded';end if;
end;
$audit$;
rollback;
select 'PASS v0.1.77 borrowed private quote fail-closed smoke' as result;