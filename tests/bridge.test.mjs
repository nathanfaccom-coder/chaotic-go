import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const owner='11111111-1111-4111-8111-111111111111';
const stranger='22222222-2222-4222-8222-222222222222';
const records=new Map();
const key=(u,node)=>u+'/'+node;
const errors=[];
const client={from(name) {
  assert.ok(['chaotic_game_nodes','chaotic_player_state'].includes(name));
  const q={
    mode:'select',where:{},pattern:null,
    select(){this.mode='select';return this;},
    eq(k,value){this.where[k]=value;return this;},
    like(k,value){this.pattern={k,value};return this;},
    maybeSingle:async function() {
      if(name==='chaotic_player_state')return {data:null,error:null};
      return {data:[...records.values()].find(row=>Object.entries(this.where).every(([k,v])=>row[k]===v))||null,error:null};
    },
    upsert(payload){
      assert.equal(payload.user_id,owner);
      records.set(key(payload.user_id,payload.node_path), structuredClone(payload));
      return Promise.resolve({error:null});
    },
    delete(){this.mode='delete';return this;},
    then(resolve,reject){
      const matches=[...records.values()].filter(row=>
        Object.entries(this.where).every(([k,v])=>row[k]===v) &&
        (!this.pattern||row[this.pattern.k].startsWith(this.pattern.value.slice(0,-1))));
      let result;
      if(this.mode==='delete') {
        matches.forEach(row=>records.delete(key(row.user_id,row.node_path)));
        result={error:null};
      } else result={data:matches,error:null};
      return Promise.resolve(result).then(resolve,reject);
    }
  };
  return q;
}};
globalThis.window={
  ChaoticAuth:{getClient:()=>client},
  ChaoticAuthUser:{id:owner,email:'player@example.com'},
  dispatchEvent:(event)=>errors.push(event.detail)
};
// Importa o módulo como conteúdo, isolando-o da rede e de dependências externas.
const source=await readFile(new URL('../supabase-game-bridge.js',import.meta.url),'utf8');
const bridge=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const path=n=>bridge.ref(bridge.db,'jogadores/'+owner+'/'+n);

test('save and load a deck', async ()=>{
  await bridge.set(path('decks/6x6_1'),{nome:'Meu Deck',modo:'6x6'});
  assert.equal((await bridge.get(path('decks/6x6_1'))).val().nome,'Meu Deck');
});
test('Original Decks slot naming is preserved',async ()=>{
  await bridge.set(path('decks/6x6_slot_1'),{nome:'Original 6x6',modo:'6x6'});
  const all=(await bridge.get(path('decks'))).val();
  assert.equal(all['6x6_slot_1'].nome,'Original 6x6');
});
test('Drome lists multiple slots by mode',async ()=>{
  await bridge.set(path('decks/1x1_2'),{nome:'Duelo',modo:'1x1'});
  const group=(await bridge.get(path('decks'))).val();
  assert.equal(group['6x6_1'].nome,'Meu Deck');
  assert.equal(group['1x1_2'].nome,'Duelo');
  assert.equal(Object.keys(group).length,2);
});
test('rejects reading or changing another account',async ()=>{
  const p=bridge.ref(bridge.db,'jogadores/'+stranger+'/album');
  await assert.rejects(bridge.get(p),/não foi migrado/);
  assert.throws(()=>bridge.set(p,[]),/não foi migrado/);
});
test('refuses unsafe multiplayer paths',()=>{
  assert.throws(()=>bridge.set(bridge.ref(bridge.db,'salas_drome/a'),{}),/não foi migrado/);
});
test('profile update merges and persists',async ()=>{
  await bridge.set(path('profile'),{nome:'Jogador'});
  await bridge.update(path('profile'),{vitorias:2});
  assert.deepEqual((await bridge.get(path('profile'))).val(),{nome:'Jogador',vitorias:2});
});
test('deleting one deck does not remove the other',async ()=>{
  await bridge.remove(path('decks/6x6_1'));
  const group=(await bridge.get(path('decks'))).val();
  assert.equal(group['6x6_1'],undefined);
  assert.equal(group['1x1_2'].nome,'Duelo');
});
test('no cloud error on expected calls',()=>assert.equal(errors.length,0));
