const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createPokeStore}=require('../persistence.js');
function memory(entries={}){const map=new Map(Object.entries(entries));return{getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),map};}
const make=(s,legacy=()=>undefined)=>createPokeStore({storage:()=>s,legacy});
test('a new deployment reads existing ownership without seeding defaults',async()=>{
 const s=memory({'pc:owned':'["グソクムシャ","アシレーヌ"]'});
 const first=make(s);first.set('pc:party','[]');
 const updated=make(s);assert.equal(await updated.get('pc:owned'),'["グソクムシャ","アシレーヌ"]');assert.equal(await updated.get('pc:party'),'[]');
});
test('fresh origin remains empty and does not manufacture or save seven defaults',async()=>{
 const s=memory();assert.equal(await make(s).get('pc:owned'),null);assert.equal(s.map.size,0);
});
test('local save including an intentionally empty list wins over stale legacy storage',async()=>{
 const s=memory({'pc:owned':'[]'});let reads=0;
 const p=make(s,()=>({get:async()=>{reads++;return{value:'["ガブリアス"]'};}}));
 assert.equal(await p.get('pc:owned'),'[]');assert.equal(reads,0);
});
test('legacy ownership is migrated once and survives disappearance of legacy provider',async()=>{
 const s=memory();const p=make(s,()=>({get:async()=>({value:'["グソクムシャ"]'})}));
 assert.equal(await p.get('pc:owned'),'["グソクムシャ"]');assert.equal(await make(s).get('pc:owned'),'["グソクムシャ"]');
});
test('late legacy read cannot overwrite a newer save from another tab',async()=>{
 const s=memory();let finish;const delayed=new Promise(r=>finish=r);
 const p=make(s,()=>({get:()=>delayed}));const pending=p.get('pc:owned');
 make(s).set('pc:owned','["サーフゴー"]');finish({value:'["ガブリアス"]'});
 assert.equal(await pending,'["サーフゴー"]');assert.equal(s.getItem('pc:owned'),'["サーフゴー"]');
});
test('ownership deletion keeps prior generation, and repeated saves do not erase backup',()=>{
 const s=memory({'pc:owned':'["グソクムシャ","ガブリアス"]'});const p=make(s);
 p.set('pc:owned','["グソクムシャ"]');p.set('pc:owned','["グソクムシャ"]');
 assert.equal(p.previous('pc:owned'),'["グソクムシャ","ガブリアス"]');
});
test('corrupt primary recovers backup; corrupt backup is never treated as ownership',async()=>{
 const s=memory({'pc:owned':'broken','pc:backup:owned':'["グソクムシャ"]'});const p=make(s);
 assert.equal(await p.get('pc:owned'),'["グソクムシャ"]');assert.equal(s.getItem('pc:owned'),'["グソクムシャ"]');assert.ok(p.issues().length);
 const bad=memory({'pc:owned':'broken','pc:backup:owned':'{}'});assert.equal(await make(bad).get('pc:owned'),null);assert.equal(bad.getItem('pc:owned'),'broken');
});
test('blocked storage and quota failure are visible and do not claim success',async()=>{
 const p=createPokeStore({storage:()=>{throw Error('blocked');},legacy:()=>undefined});
 assert.equal(await p.get('pc:owned'),null);assert.equal(p.set('pc:owned','["グソクムシャ"]'),false);assert.ok(p.issues().length);
 const s=memory({'pc:owned':'["ガブリアス"]'});s.setItem=()=>{throw Error('quota');};
 const q=make(s);assert.equal(q.set('pc:owned','[]'),false);assert.equal(s.getItem('pc:owned'),'["ガブリアス"]');
});
test('malformed writes preserve valid ownership',()=>{
 const s=memory({'pc:owned':'["グソクムシャ"]'});const p=make(s);
 assert.equal(p.set('pc:owned','{"owned":[]}'),false);assert.equal(p.current('pc:owned'),'["グソクムシャ"]');
});
