const test = require('node:test');
const assert = require('node:assert/strict');
const Kana = require('../js/kana.js');
const SRS = require('../js/srs.js');
require('../js/words.js');
const Progress = require('../js/progress.js');

const NOW = new Date(2026, 8, 28, 9, 0, 0).getTime();
const seq = (seed = 1) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

test('第一次上課：介紹新字，每個新字都會被考到，份量不超過每日上限', () => {
  const steps = Progress.planLesson({ srs: {}, now: NOW, script: 'hira', goal: 10, rand: seq() });
  const intros = steps.filter((s) => s.type === 'intro').map((s) => s.item.kana);
  assert.deepEqual(intros, ['あ', 'い', 'う', 'え']);
  for (const k of intros) {
    const qs = steps.filter((s) => s.type === 'q' && s.item && s.item.kana === k);
    assert.ok(qs.length >= 2, `${k} 應該被考兩次`);
    const first = steps.findIndex((s) => s.type === 'q' && s.item && s.item.kana === k);
    assert.ok(first > steps.findIndex((s) => s.type === 'intro' && s.item.kana === k), '先介紹再考');
  }
});

test('今天已經認識 4 個新字，就不再介紹新字', () => {
  const steps = Progress.planLesson({ srs: {}, now: NOW, script: 'hira', goal: 10, freshToday: 4, rand: seq() });
  assert.equal(steps.filter((s) => s.type === 'intro').length, 0);
});

test('有到期的字時先複習；會讀的字夠多時穿插單字', () => {
  const srs = {};
  const t0 = NOW - 5 * SRS.DAY;
  for (const it of Kana.ALL_ITEMS.filter((i) => i.script === 'hira' && ['a', 'ka', 'sa', 'ta', 'na'].includes(i.row))) {
    srs[it.kana] = SRS.review(null, 3, t0);                  // 1 天後到期 → 現在都到期了
  }
  const steps = Progress.planLesson({ srs, now: NOW, script: 'hira', goal: 12, rand: seq(7) });
  const kanaQ = steps.filter((s) => s.kind === 'kana');
  const wordQ = steps.filter((s) => s.kind === 'word');
  assert.equal(steps.filter((s) => s.type === 'intro').length, 0, '到期的字已經夠多，不加新字');
  assert.ok(kanaQ.every((s) => SRS.isDue(srs[s.item.kana], NOW)));
  assert.ok(wordQ.length >= 1);
  for (const s of wordQ) {
    for (const u of require('../js/words.js').units(s.word.word)) assert.ok(srs[u], `單字 ${s.word.word} 含沒學過的 ${u}`);
  }
});

test('連續天數：有練就算，今天還沒練從昨天算起；中斷就重新算', () => {
  const days = { '2026-09-25': { n: 3 }, '2026-09-26': { n: 12 }, '2026-09-27': { n: 1 } };
  assert.equal(Progress.streak(days, '2026-09-28'), 3);
  assert.equal(Progress.streak({ ...days, '2026-09-28': { n: 2 } }, '2026-09-28'), 4);
  assert.equal(Progress.streak({ '2026-09-20': { n: 5 } }, '2026-09-28'), 0);
});

test('一週集章：達標、有練、沒練', () => {
  const w = Progress.week({ '2026-09-28': { n: 10 }, '2026-09-27': { n: 3 } }, '2026-09-28', 10);
  assert.equal(w.length, 7);
  assert.equal(w[6].state, 'goal');
  assert.equal(w[5].state, 'done');
  assert.equal(w[0].state, '');
});

test('第一天的題數也能達到每日目標', () => {
  for (const goal of [5, 10, 15]) {
    const steps = Progress.planLesson({ srs: {}, now: NOW, script: 'hira', goal, rand: seq(3) });
    assert.ok(steps.filter((s) => s.type === 'q').length >= goal, `目標 ${goal}`);
  }
});

test('今天新字額度用完、會的字也都複習過了，「繼續練習」仍然有題目', () => {
  const srs = {};
  for (const k of ['あ', 'い', 'う', 'え']) srs[k] = SRS.review(null, 3, NOW - 60000);
  const steps = Progress.planLesson({ srs, now: NOW, script: 'hira', goal: 10, freshToday: 4, rand: seq(5) });
  assert.ok(steps.filter((s) => s.type === 'q').length >= 10);
});
