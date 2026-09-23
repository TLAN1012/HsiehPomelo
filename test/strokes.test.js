const test = require('node:test');
const assert = require('node:assert/strict');
const Kana = require('../js/kana.js');
const STROKES = require('../js/strokes.js');

test('清音與濁音的每個平假名、片假名都有筆順資料', () => {
  const chars = Kana.ALL_ITEMS.filter((it) => it.group !== 'yoon').map((it) => it.kana);
  assert.equal(chars.length, 142);
  for (const ch of chars) {
    const s = STROKES[ch];
    assert.ok(s, `缺少 ${ch}`);
    assert.ok(s.d.length > 0);
    assert.equal(s.d.length, s.n.length, `${ch} 筆畫與編號數量不一致`);
    for (const d of s.d) assert.match(d, /^M/);
  }
});

test('常見字的筆畫數', () => {
  const expected = { あ: 3, い: 2, し: 1, そ: 1, ぬ: 2, ん: 1, ア: 2, シ: 3, ツ: 3, ヲ: 3, ガ: 4, ぱ: 4 };
  for (const [ch, n] of Object.entries(expected)) assert.equal(STROKES[ch].d.length, n, ch);
});
