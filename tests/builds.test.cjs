const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const buildSource = html.slice(html.indexOf('const BUILDS='), html.indexOf('let buildId='));
const builds = vm.runInNewContext(buildSource + '\nJSON.parse(JSON.stringify(BUILDS))');
const build = builds.find(b => b.id === 'mc-scarf-basc');

test('new Basculegion plan has six unique species, items, valid points and moves', () => {
  assert.ok(build);
  assert.equal(build.mons.length, 6);
  assert.equal(new Set(build.mons.map(m => m.n)).size, 6);
  assert.equal(new Set(build.mons.map(m => m.it)).size, 6);
  const moveLine = html.split('\n').find(l => l.startsWith('const MVD='));
  const moves = vm.runInNewContext(moveLine + '\nMVD');
  for (const mon of build.mons) {
    assert.equal(mon.ev.length, 6);
    assert.equal(mon.ev.reduce((a, b) => a + b, 0), 66);
    assert.ok(mon.ev.every(n => Number.isInteger(n) && n >= 0 && n <= 32));
    assert.equal(new Set(mon.mv).size, 4);
    for (const move of mon.mv) assert.ok(moves[move], `${mon.n}: ${move} missing`);
  }
  assert.equal(build.basic.length, 3);
  assert.ok(build.basic.every(n => build.mons.some(m => m.n === n)));
});

test('finisher is Jolly Adaptability Scarf with speed 214 at level 50', () => {
  const basc = build.mons.find(m => m.n === 'イダイトウ(オス)');
  assert.equal(basc.it, 'こだわりスカーフ');
  assert.equal(basc.ab, 'てきおうりょく');
  assert.equal(basc.nat, 'ようき');
  assert.ok(basc.mv.includes('おはかまいり'));
  const bsLine = html.split('\n').find(l => l.startsWith('const BS='));
  const statSource = html.slice(html.indexOf('const NAT='), html.indexOf('/* abilities that matter */'));
  const speed = vm.runInNewContext(bsLine + '\n' + statSource + '\nMath.floor(statOf("イダイトウ(オス)",5,32,"ようき")*1.5)');
  assert.equal(speed, 214);
});

test('new plan documents the late-game scoring limitation and retains saved build IDs', () => {
  assert.match(build.pat, /ひんし0体.*威力50/);
  assert.match(build.pat, /威力150/);
  for (const id of ['mc-owned-heat', 'mc-owned-goli', 'mc-firstturn']) {
    assert.ok(builds.some(b => b.id === id));
  }
  assert.equal(new Set(builds.map(b => b.id)).size, builds.length);
});

test('all inline scripts are syntactically valid', () => {
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) {
    new vm.Script(match[1]);
  }
});
