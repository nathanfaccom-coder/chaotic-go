import {test} from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";
const source=await readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8");
const start=source.indexOf("  function parseChaoticInviteCode(raw){");
const end=source.indexOf("  function formatChaoticInvite(currentRoom){",start);
assert.ok(start>0&&end>start,"private invitation parser exists");
const parse=vm.runInNewContext("("+source.slice(start,end).trim()+")");
test("v0.1.128: accepts raw uppercase and lowercase room codes",()=>{
 assert.equal(parse("  abcdef123456  "),"ABCDEF123456");
 assert.equal(parse("ABCDEF123456"),"ABCDEF123456");
});
test("v0.1.128: accepts full shared invitation",()=>{
 assert.equal(parse("Convite Chaotic GO (3x3): abcdef123456 — Abra https://nathanfaccom-coder.github.io/chaotic-go/"),"ABCDEF123456");
});
test("v0.1.128: accepts explicitly labelled room code",()=>{
 assert.equal(parse("Código da sala: abcdef123456"),"ABCDEF123456");
});
test("v0.1.128: refuses unrelated hex token from any other context",()=>{
 assert.equal(parse("Meu cartão: ABCDEF123456"),"");
 assert.equal(parse("Emissor ABCDEF123456"),"");
});
test("v0.1.128: refuses token with extra hex characters",()=>{
 assert.equal(parse("Código: ABCDEF1234567"),"");
});
test("v0.1.128: rejects arbitrary/missing/unsafe invitations",()=>{
 for(const v of ["",null,"https://other.example/ABCDEF123456","Convite Chaotic GO (5x5): ABCDEF123456","<script>alert(1)</script>"])
  assert.equal(parse(v),"");
});
test("v0.1.128: sharing never writes any database records",()=>{
 const from=source.indexOf('    $("lobby-paste-invite").onclick');
 const to=source.indexOf('    $("lobby-refresh").onclick',from);
 assert.ok(from>0&&to>from);
 assert.doesNotMatch(source.slice(from,to),/rpc\(|\.upsert\(|\.insert\(|\.delete\(|\.update\(/);
});
