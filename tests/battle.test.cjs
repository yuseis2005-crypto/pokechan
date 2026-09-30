const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const slice = (start, end) => html.slice(html.indexOf(start), html.indexOf(end));
function engine() {
  const c = vm.createContext({});
  vm.runInContext(slice('const T=', '/* ---- sprites') + '\n' +
    slice('const USAGE_AS_OF=', 'const NOTE=') + '\n' +
    slice('const BUILDS=', 'let buildId=') + '\n' +
    'const FORMS={}; const baseOf=n=>n; const myBuildMon=n=>BUILDS[0].mons.find(m=>m.n===n);\n' +
    slice('const SETS=', 'const ALT_ITEMS='), c);
  return expression => vm.runInContext(expression, c);
}

test('September 30 snapshot has 50 unique, known species and updated top ranks', () => {
  const run = engine();
  assert.equal(run('USAGE_AS_OF'), '2026-09-30');
  assert.equal(run('USAGE.length'), 50);
  assert.equal(run('new Set(USAGE).size'), 50);
  assert.equal(run('USAGE.every(n=>M[n])'), true);
  assert.equal(run('RANK["セグレイブ"]'), 4);
  assert.equal(run('RANK["グソクムシャ"]'), 6);
  assert.equal(run('RANK["イダイトウ(オス)"]'), 20);
});

test('Last Respects uses 50/100/150, validates counts, and leaves other moves alone', () => {
  const run = engine();
  assert.equal(run('[0,1,2].map(lastRespectsPower).join(",")'), '50,100,150');
  assert.equal(run('lastRespectsPower(NaN)'), 50);
  assert.equal(run('lastRespectsPower(-2)'), 50);
  assert.equal(run('lastRespectsPower(10)'), 150);
  assert.equal(run('battlePower("ウェーブタックル",120,2)'), 120);
});

test('actual damage uses the fainted count, Adaptability and the 0.85 minimum roll', () => {
  const run = engine();
  run(`var att={stats:[200,100,100,100,100,100],atk:[200,100,100,100,100,100],types:['ゴースト'],A:{adapt:1},I:{},moves:[{n:'おはかまいり',t:'ゴースト',pow:50,cls:'物',prio:0,hits:1}]};
       var def={stats:[200,100,100,100,100,100],types:['みず'],A:{},I:{}};`);
  assert.equal(run('[0,1,2].map(fainted=>{const k=hitsToKO({...att,fainted},def,null);return k.pmin+"-"+k.pmax}).join(",")'), '20-24,39-46,57-68');
  assert.equal(run('hitsToKO({...att,fainted:2},{...def,types:["ノーマル"]},null)'), null);
});

test('Last Respects is not halved by contact guard and cannot gain Tough Claws', () => {
  const run = engine();
  run(`var a=sideOf('イダイトウ(オス)','イダイトウ(オス)',{fainted:2});a.moves=a.moves.filter(m=>m.n==='おはかまいり');
       var d=sideOf('カバルドン','カバルドン',{build:false});d.A={};d.I={};`);
  assert.equal(run('hitsToKO(a,d,null).pmax'), run('hitsToKO(a,{...d,A:{contactHalf:1}},null).pmax'));
  assert.equal(run('hitsToKO(a,d,null).pmax'), run('hitsToKO({...a,A:{...a.A,claw:1}},d,null).pmax'));
  run(`a.moves=[{n:'アクアジェット',t:'みず',pow:40,cls:'物',prio:1,hits:1}];`);
  assert.ok(run('hitsToKO(a,d,null).pmax') > run('hitsToKO(a,{...d,A:{contactHalf:1}},null).pmax'));
});

test('duel cache separates own/opponent fainted counts and preserves opening evaluation', () => {
  const run = engine();
  run(`var opening=duel('イダイトウ(オス)','イダイトウ(オス)','イダイトウ(オス)');
       var late=duel('イダイトウ(オス)','イダイトウ(オス)','イダイトウ(オス)',{myFainted:2,opFainted:1});`);
  assert.equal(run('late.me.fainted'), 2);
  assert.equal(run('late.op.fainted'), 1);
  assert.equal(run('opening.me.fainted'), 0);
  assert.equal(run('opening.op.fainted'), 0);
  assert.equal(run('duel("イダイトウ(オス)","イダイトウ(オス)","イダイトウ(オス)")===opening'), true);
  assert.ok(run('late.A.pmax') > run('opening.A.pmax'));
  assert.ok(run('late.B.pmax') > run('opening.B.pmax'));
});

test('official move bans filter old sets without modifying the archived statistics', () => {
  const run = engine();
  run('SETS.S[SETS.dex["ブリジュラス"]].mv.push(["ミラーコート",50],["メタルバースト",25])');
  assert.equal(run('setOf("ブリジュラス").mv.some(m=>["ミラーコート","メタルバースト"].includes(m[0]))'), false);
  assert.equal(run('SETS.S[SETS.dex["ブリジュラス"]].mv.some(m=>m[0]==="ミラーコート")'), true);
  assert.equal(run('legalMove("ニョロトノ","はたく")'), false);
  assert.equal(run('legalMove("ミロカロス","ミラーコート")'), true);
});

test('one ability point adds one raw stat, not two', () => {
  const run = engine();
  assert.equal(run('statOf("ガブリアス",1,1,"")-statOf("ガブリアス",1,0,"")'), 1);
  assert.equal(run('statOf("ガブリアス",1,32,"")'), 182);
});
