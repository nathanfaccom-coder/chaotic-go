import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const [sql,smoke,index,sw,bootstrap,scanner] = await Promise.all([
  readFile(new URL("../supabase/tests/chaotic-privileged-authorization-audit-live-v0165.test.sql",import.meta.url),"utf8"),
  readFile(new URL("../.github/workflows/verify-publication.yml",import.meta.url),"utf8"),
  readFile(new URL("../index.html",import.meta.url),"utf8"),
  readFile(new URL("../sw.js",import.meta.url),"utf8"),
  readFile(new URL("../full-game-bootstrap.js",import.meta.url),"utf8"),
  readFile(new URL("../scanner.html",import.meta.url),"utf8")
]);
test("v0.1.65: SQL authorization audit rolls back and rejects anonymous privileged RPC calls",()=>{
  assert.match(sql,/begin;\s*do \$audit\$/i);
  assert.match(sql,/rollback;\s*select 'PASS v0\.1\.65/i);
  assert.doesNotMatch(sql,/\bcommit\s*;/i);
  assert.match(sql,/has_function_privilege\('anon',p\.oid,'execute'\)/);
  assert.match(sql,/has_function_privilege\('authenticated',p\.oid,'execute'\)/);
  assert.match(sql,/auth\.uid\(\)/);
});
test("v0.1.65: all seven reference and presence tables have non-readable audit protection",()=>{
  for(const table of [
    "chaotic_preview_3x3_creature_element_checks",
    "chaotic_preview_3x3_dynamic_element_checks",
    "chaotic_preview_3x3_element_catalog",
    "chaotic_preview_3x3_equipment_catalog",
    "chaotic_preview_3x3_player_presence",
    "chaotic_preview_card_reference",
    "chaotic_preview_mugic_token_catalog"
  ])assert.ok(sql.includes(table),table);
  assert.match(sql,/c\.relrowsecurity/);
  assert.match(sql,/pg_policies/);
});
test("v0.1.65: publication job reads real Pages endpoint and checks critical files",()=>{
  assert.match(smoke,/api\.github\.com\/repos/);
  assert.match(smoke,/\/pages/);
  for(const asset of ["index.html","scanner.html","login-completo.html",
    "chaotic-lobby.js","sw.js","style.css","logo.png"])
    assert.ok(smoke.includes(asset),asset);
  assert.match(smoke,/expected=/);
  assert.match(smoke,/página pública|Página pública/i);
});
test("v0.1.65: cache busting loads the newest DROME on phone",()=>{
  assert.match(index,/VERSÃO 0\.1\.65/);
  assert.match(index,/sw\.js\?v=release-65/);
  assert.match(sw,/chaotic-go-release-20261031-65/);
  assert.match(scanner,/full-game-bootstrap\.js\?v=release-65/);
  assert.match(bootstrap,/chaotic-lobby\.js\?v=release-65/);
});
