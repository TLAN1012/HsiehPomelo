const test = require('node:test');
const assert = require('node:assert/strict');
const Kana = require('../js/kana.js');
const Words = require('../js/words.js');
const Mnemonics = require('../js/mnemonics.js');

const KNOWN = new Set(Kana.ALL_ITEMS.map((it) => it.kana));

test('單字拆字：拗音算一個，長音與促音略過', () => {
  assert.deepEqual(Words.units('でんしゃ'), ['で', 'ん', 'しゃ']);
  assert.deepEqual(Words.units('ケーキ'), ['ケ', 'キ']);
  assert.deepEqual(Words.units('ロボット'), ['ロ', 'ボ', 'ト']);
  assert.deepEqual(Words.units('ジュース'), ['ジュ', 'ス']);
});

test('每個單字的每個字都在假名資料裡，且沒有重複單字', () => {
  const seen = new Set();
  for (const w of Words.WORDS) {
    for (const u of Words.units(w.word)) assert.ok(KNOWN.has(u), `${w.word} 的「${u}」不在資料中`);
    assert.ok(!seen.has(w.word), `重複：${w.word}`);
    seen.add(w.word);
  }
});

test('只認識あ行＋か行時，只會出由這些字組成的單字', () => {
  const known = new Set(['あ', 'い', 'う', 'え', 'お', 'か', 'き', 'く', 'け', 'こ']);
  const words = Words.readable((k) => known.has(k), 'hira').map((w) => w.word);
  assert.ok(words.includes('かお'));
  assert.ok(words.includes('き'));
  assert.ok(!words.includes('いぬ'));
});

test('口訣：清音平假名、片假名各 46 個都有；濁音與拗音沿用清音', () => {
  const seion = Kana.ALL_ITEMS.filter((it) => it.group === 'seion');
  for (const it of seion) assert.ok(Mnemonics.DATA[it.kana], `缺少口訣：${it.kana}`);
  assert.equal(Mnemonics.mnemonicOf('が').base, 'か');
  assert.ok(Mnemonics.mnemonicOf('が').note.includes('゛'));
  assert.equal(Mnemonics.mnemonicOf('ピ').base, 'ヒ');
  assert.equal(Mnemonics.mnemonicOf('きゃ').base, 'き');
});
