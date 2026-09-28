const test = require('node:test');
const assert = require('node:assert/strict');
const SRS = require('../js/srs.js');

const T0 = Date.UTC(2026, 8, 28, 1, 0, 0);
const DAY = SRS.DAY;

test('新卡：答對的間隔比答錯長，答錯 10 分鐘後再出現', () => {
  const good = SRS.review(null, 3, T0);
  const again = SRS.review(null, 1, T0);
  assert.ok(good.s > again.s);
  assert.equal(again.due - T0, 10 * 60 * 1000);
  assert.equal(good.reps, 1);
  assert.equal(again.lapses, 1);
});

test('隔天複習答對，穩定度增加、間隔拉長', () => {
  let c = SRS.review(null, 3, T0);
  const s1 = c.s;
  c = SRS.review(c, 3, T0 + 3 * DAY);
  assert.ok(c.s > s1 * 1.5, `穩定度 ${s1} → ${c.s}`);
  assert.ok(c.due - (T0 + 3 * DAY) >= 3 * DAY);
});

test('忘記：穩定度下降但不會比原本高，難度上升', () => {
  let c = SRS.review(null, 3, T0);
  c = SRS.review(c, 3, T0 + 3 * DAY);
  const before = c;
  c = SRS.review(c, 1, T0 + 20 * DAY);
  assert.ok(c.s <= before.s);
  assert.ok(c.d > before.d);
  assert.equal(c.lapses, 1);
});

test('同一天內重複練習不會把間隔推到好幾天之後', () => {
  let c = SRS.review(null, 3, T0);
  for (let i = 1; i <= 5; i++) c = SRS.review(c, 3, T0 + i * 15 * 60 * 1000);
  assert.ok(c.s < 30, `穩定度 ${c.s}`);
});

test('評分：錯 1、慢 2、一般 3、熟練又快 4', () => {
  assert.equal(SRS.gradeFrom(false, 1000, null), 1);
  assert.equal(SRS.gradeFrom(true, 9000, null), 2);
  assert.equal(SRS.gradeFrom(true, 1500, null), 3);          // 第一次見到不給「輕鬆」
  assert.equal(SRS.gradeFrom(true, 1500, { reps: 3 }), 4);
});

test('熟練度與到期判斷', () => {
  assert.equal(SRS.level(null), 0);
  const c = SRS.review(null, 3, T0);
  assert.equal(SRS.level(c), SRS.isLearned(c) ? 3 : c.s >= 1 ? 2 : 1);
  assert.ok(!SRS.isDue(c, T0));
  assert.ok(SRS.isDue(c, c.due));
  assert.ok(SRS.isLearned({ s: 5, reps: 3 }));
});

test('兒童版：新字第一次答對，隔天就再出現', () => {
  const c = SRS.review(null, 3, T0);
  assert.equal(c.due - T0, DAY);
});
