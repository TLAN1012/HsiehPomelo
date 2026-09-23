const test = require('node:test');
const assert = require('node:assert/strict');
const Kana = require('../js/kana.js');

const find = (kana) => Kana.ALL_ITEMS.find((it) => it.kana === kana);

test('資料數量：清音 46、濁音半濁音 25、拗音 33，平假名片假名各一份', () => {
  const hira = Kana.ALL_ITEMS.filter((it) => it.script === 'hira');
  const count = (g) => hira.filter((it) => it.group === g).length;
  assert.equal(count('seion'), 46);
  assert.equal(count('dakuon'), 25);
  assert.equal(count('yoon'), 33);
  assert.equal(Kana.ALL_ITEMS.length, hira.length * 2);
});

test('片假名轉換', () => {
  assert.equal(Kana.toKatakana('きゃ'), 'キャ');
  assert.equal(Kana.toKatakana('を'), 'ヲ');
  assert.equal(find('ヂ').romaji[0], 'ji');
});

test('羅馬拼音接受多種寫法', () => {
  assert.ok(Kana.checkAnswer(find('し'), 'shi'));
  assert.ok(Kana.checkAnswer(find('し'), ' SI '));
  assert.ok(Kana.checkAnswer(find('ツ'), 'tu'));
  assert.ok(Kana.checkAnswer(find('ん'), 'nn'));
  assert.ok(Kana.checkAnswer(find('を'), 'o'));
  assert.ok(Kana.checkAnswer(find('じゃ'), 'zya'));
  assert.ok(!Kana.checkAnswer(find('し'), 'chi'));
  assert.ok(!Kana.checkAnswer(find('か'), ''));
});

test('buildPool 依文字與行篩選', () => {
  assert.equal(Kana.buildPool('hira', ['a']).length, 5);
  assert.equal(Kana.buildPool('both', ['a', 'wa']).length, 14);
  assert.ok(Kana.buildPool('kata', ['kya']).every((it) => it.script === 'kata'));
});

test('makeChoices：含正解、不重複、同文字、沒有同音干擾項', () => {
  const pool = Kana.buildPool('both', Kana.ROWS.map((r) => r.id));
  for (const answer of pool) {
    const choices = Kana.makeChoices(answer, pool, 4);
    assert.equal(choices.length, 4);
    assert.equal(choices.filter((c) => c === answer).length, 1);
    assert.equal(new Set(choices.map((c) => c.kana)).size, 4);
    for (const c of choices) {
      assert.equal(c.script, answer.script);
      if (c !== answer) assert.ok(!Kana.shareRomaji(c, answer), `${answer.kana} vs ${c.kana}`);
    }
  }
});

test('makeChoices：練習範圍很小時會自動補足選項', () => {
  const pool = Kana.buildPool('hira', ['n']);
  const choices = Kana.makeChoices(pool[0], pool, 4);
  assert.equal(choices.length, 4);
});

test('pickWeighted 避開最近出過的字，且常錯的字較常出現', () => {
  const pool = Kana.buildPool('hira', ['a']);
  for (let i = 0; i < 50; i++) {
    const it = Kana.pickWeighted(pool, {}, ['あ', 'い']);
    assert.ok(!['あ', 'い'].includes(it.kana));
  }
  const stats = { あ: { c: 0, w: 20, last: 0 } };
  for (const k of 'いうえお') stats[k] = { c: 20, w: 0, last: 1 };
  let hits = 0;
  for (let i = 0; i < 2000; i++) if (Kana.pickWeighted(pool, stats).kana === 'あ') hits++;
  assert.ok(hits > 2000 * 0.4, `hits=${hits}`);
});
