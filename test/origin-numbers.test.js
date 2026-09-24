const test = require('node:test');
const assert = require('node:assert/strict');
const Kana = require('../js/kana.js');
const NUMBERS = require('../js/numbers.js');

test('每個清音、濁音的假名都有字源漢字', () => {
  for (const it of Kana.ALL_ITEMS.filter((i) => i.group !== 'yoon')) {
    const o = Kana.originOf(it.kana);
    assert.ok(o && o.kanji, `缺少 ${it.kana} 的字源`);
  }
});

test('字源：平假名與片假名分開對應，濁音沿用清音', () => {
  const expected = {
    あ: '安', ア: '阿', い: '以', イ: '伊', け: '計', ケ: '介', ち: '知', チ: '千',
    は: '波', ハ: '八', み: '美', ミ: '三', る: '留', ル: '流', を: '遠', ヲ: '乎',
    ん: '无', が: '加', ガ: '加', ぱ: '波', パ: '八', ぢ: '知', ヂ: '千',
  };
  for (const [kana, kanji] of Object.entries(expected)) assert.equal(Kana.originOf(kana).kanji, kanji, kana);
  assert.equal(Kana.originOf('きゃ'), null);
  assert.ok(Kana.originOf('ン').note);
});

test('數字 1–20 的讀法', () => {
  assert.equal(NUMBERS.length, 20);
  const pick = (n) => NUMBERS[n - 1];
  assert.deepEqual([pick(1).kanji, pick(1).kana], ['一', 'いち']);
  assert.deepEqual([pick(4).kana, pick(4).altKana], ['よん', 'し']);
  assert.deepEqual([pick(9).kana, pick(9).altKana], ['きゅう', 'く']);
  assert.deepEqual([pick(10).kanji, pick(10).kana, pick(10).romaji], ['十', 'じゅう', 'jū']);
  assert.deepEqual([pick(14).kanji, pick(14).kana, pick(14).altKana], ['十四', 'じゅうよん', 'じゅうし']);
  assert.deepEqual([pick(17).kana, pick(17).altKana, pick(17).romaji], ['じゅうなな', 'じゅうしち', 'jūnana']);
  assert.deepEqual([pick(20).kanji, pick(20).kana, pick(20).romaji, pick(20).altKana], ['二十', 'にじゅう', 'nijū', '']);
  assert.equal(pick(11).altKana, '');
});
