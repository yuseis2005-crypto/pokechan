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

test('both requested counter teams use only the October 14 owned species and valid builds', () => {
  const owned = new Set('ガブリアス|カイリュー|ゲンガー|ミミッキュ|アーマーガア|カバルドン|キラフロル|ゴリランダー|ラグラージ|セグレイブ|オーロンゲ|ウルガモス|ハッサム|ヒスイダイケンキ|サーフゴー|キュウコン(アローラ)|ニンフィア|クチート|ゲッコウガ|ブラッキー|アシレーヌ|イダイトウ(オス)|ルカリオ|ピクシー|ドヒドイデ|バシャーモ|メタグロス|サザンドラ|マスカーニャ|リザードン|ブリジュラス|ミミロップ|ソウブレイズ|ライチュウ|ドドゲザン|ギャラドス|グソクムシャ|ヒートロトム|ボーマンダ|ペリッパー|マフォクシー|エースバーン|ウォッシュロトム|ラウドボーン|ムクホーク|メガニウム'.split('|'));
  const moveLine = html.split('\n').find(l => l.startsWith('const MVD='));
  const moves = vm.runInNewContext(moveLine + '\nMVD');
  for (const id of ['mc-owned-counter-charx', 'mc-owned-counter-mence']) {
    const counter = builds.find(b => b.id === id);
    assert.ok(counter, id);
    assert.equal(counter.mons.length, 6);
    assert.equal(new Set(counter.mons.map(m => m.n.replace(/^メガ/, ''))).size, 6);
    assert.equal(new Set(counter.mons.map(m => m.it)).size, 6);
    assert.equal(counter.foes.length, 6);
    for (const mon of counter.mons) {
      assert.ok(owned.has(mon.n.replace(/^メガ/, '')), `${id}: ${mon.n} is not owned`);
      assert.equal(mon.ev.length, 6);
      assert.equal(mon.ev.reduce((a, b) => a + b, 0), 66);
      assert.ok(mon.ev.every(n => Number.isInteger(n) && n >= 0 && n <= 32));
      assert.equal(new Set(mon.mv).size, 4);
      for (const move of mon.mv) assert.ok(moves[move], `${mon.n}: ${move} is unsupported`);
    }
    for (const trio of [counter.basic, counter.alt]) {
      assert.equal(trio.length, 3);
      assert.equal(new Set(trio).size, 3);
      assert.ok(trio.every(n => counter.mons.some(m => m.n === n)));
    }
  }
});

test('counter speed assumptions distinguish boosted Mega Charizard X and Mega Salamence', () => {
  const statSource = html.slice(html.indexOf('const T='), html.indexOf('/* ---- sprites'));
  const speed = (name, scarf, boosted = false) => vm.runInNewContext(statSource +
    `\nMath.floor(statOf(${JSON.stringify(name)},5,32,"ようき")*${scarf || boosted ? 1.5 : 1})`);
  assert.ok(speed('ガブリアス', true) > speed('メガリザードンX', false, true));
  assert.ok(speed('サザンドラ', true) < speed('メガボーマンダ', false, true));
  const counter = builds.find(b => b.id === 'mc-owned-counter-charx');
  assert.ok(counter.mons.find(m => m.n === 'カバルドン').mv.includes('ふきとばし'));
  assert.match(builds.find(b => b.id === 'mc-owned-counter-mence').mons.find(m => m.n === 'サザンドラ').note, /先制できない/);
});
