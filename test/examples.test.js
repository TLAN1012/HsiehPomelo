const test = require('node:test');
const assert = require('node:assert/strict');
const Kana = require('../js/kana.js');
const { EXAMPLES, exampleOf, readingOf } = require('../js/examples.js');

const WRITABLE = Kana.ALL_ITEMS.filter((it) => it.group !== 'yoon').map((it) => it.kana);
const KANA_ONLY = /^[ぁ-ゖァ-ヺー]+$/;
const HAS_KANJI = /[一-鿿]/;

test('習字帖的每個假名都有例詞或說明', () => {
  assert.equal(WRITABLE.length, 142);
  for (const kana of WRITABLE) {
    const e = exampleOf(kana);
    assert.ok(e && (e.w || e.note), `缺少 ${kana}`);
  }
  assert.deepEqual(Object.keys(EXAMPLES).filter((k) => !WRITABLE.includes(k)), [], '多出不在習字帖的字');
});

test('例詞的讀音真的含有這個假名', () => {
  for (const [kana, e] of Object.entries(EXAMPLES)) {
    if (!e.w) continue;
    assert.ok(readingOf(e).includes(kana), `${kana}：${readingOf(e)}`);
    assert.ok(e.m, `${kana} 缺少中文意思`);
  }
});

test('漢字片段都有標注假名，假名片段不含漢字', () => {
  for (const [kana, e] of Object.entries(EXAMPLES)) {
    for (const [text, ruby] of e.w || []) {
      if (HAS_KANJI.test(text)) {
        assert.ok(ruby && KANA_ONLY.test(ruby), `${kana}：「${text}」缺少讀音`);
      } else {
        assert.ok(KANA_ONLY.test(text) && !ruby, `${kana}：「${text}」`);
      }
    }
  }
});

test('平假名用平假名讀音，片假名用片假名外來語', () => {
  for (const [kana, e] of Object.entries(EXAMPLES)) {
    if (!e.w) continue;
    const isKata = /[ァ-ヺ]/.test(kana);
    const reading = readingOf(e);
    if (isKata) assert.match(reading, /^[ァ-ヺー]+$/, kana);
    else assert.match(reading, /^[ぁ-ゖー]+$/, kana);
  }
});

test('範例：な→名前、も→桃', () => {
  assert.equal(readingOf(exampleOf('な')), 'なまえ');
  assert.equal(exampleOf('な').w.map(([t]) => t).join(''), '名前');
  assert.equal(readingOf(exampleOf('も')), 'もも');
  assert.equal(readingOf(exampleOf('ヲ')), '');
});
