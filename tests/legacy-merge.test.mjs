import {test} from "node:test";
import assert from "node:assert/strict";
import {mergeAlbum,normalizeDecks,selectMissingDecks} from "../legacy-merge-core.js";

test("Old card album merges with no deletes or exact duplicates",()=>{
  const current=[{id:1,nome:"Cidade de Kiru",tipoCarta:"Local",quantidade:1}];
  const legacy=[{quantidade:1,tipoCarta:"Local",nome:"Cidade de Kiru",id:1},
                {id:33,nome:"Criatura",stats:{c:50,p:60},quantidade:2}];
  const result=mergeAlbum(current,legacy);
  assert.equal(result.cards.length,2);
  assert.equal(result.added,1);
  assert.equal(result.alreadyPresent,1);
  assert.deepEqual(current,[{id:1,nome:"Cidade de Kiru",tipoCarta:"Local",quantidade:1}]);
  assert.deepEqual(result.cards[1],legacy[1]);
});
test("Identical IDs with different DNA are preserved as independent cards",()=>{
  const v=mergeAlbum([{id:3,stats:{c:20}}],[{id:3,stats:{c:30}}]);
  assert.equal(v.cards.length,2);
});
test("Firebase indexed album is converted without dropping valid cards",()=>{
  const v=mergeAlbum([],{0:{id:10,nome:"A"},1:null,2:{id:11,nome:"B"}});
  assert.equal(v.cards.length,2);
});
test("Deck keys use the existing slot format",()=>{
  const decks=normalizeDecks({"6x6_slot_1":{nome:"Principal"},"3x3_2":{nome:"Curto"},"bad":{}});
  assert.deepEqual(Object.keys(decks).sort(),["3x3_slot_2","6x6_slot_1"]);
});
test("Never overwrite a deck already saved in Supabase",()=>{
  const v=selectMissingDecks({"6x6_slot_1":{nome:"Antigo"},"1x1_2":{nome:"Duelo"}},
                             {"6x6_slot_1":{nome:"Atual"}});
  assert.equal(v.foundCount,2);
  assert.equal(v.skipped,1);
  assert.deepEqual(Object.keys(v.missing),["1x1_slot_2"]);
});
test("Empty old data do not delete current cards or decks",()=>{
  assert.equal(mergeAlbum([{id:1}],null).cards.length,1);
  assert.equal(selectMissingDecks({},{"3x3_slot_1":{nome:"A"}}).foundCount,0);
});
