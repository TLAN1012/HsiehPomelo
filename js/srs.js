/*
 * 間隔重複排程（FSRS-5 預設參數）。不依賴 DOM，可在瀏覽器與 Node 中使用。
 *
 * 每張卡（一個假名或單字）記錄：
 *   s 穩定度（天）：記憶保持 90% 的天數；d 難度 1–10；due 下次複習時間（ms）
 *   last 上次複習時間、reps 次數、lapses 忘記次數
 * 評分：1 忘了、2 答對但很吃力、3 答對、4 輕鬆答對。
 * 目標記憶率 90% 時，下次間隔剛好等於穩定度 s（天）。
 */
(function (root) {
  'use strict';

  const W = [0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192,
    1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621];
  const DECAY = -0.5;
  const FACTOR = 19 / 81;
  const DAY = 86400000;
  const MIN_GAP = 10 * 60 * 1000;   // 同一天內至少隔 10 分鐘再出現
  const MAX_DAYS = 365;
  // 兒童版：新字第一次的穩定度（天）比 FSRS 成人預設短，答對隔天就再見一次，比較記得住也比較有成就感
  const FIRST_S = [W[0], 0.5, 1, 3];

  const clampD = (d) => Math.min(10, Math.max(1, d));

  function retrievability(card, now) {
    if (!card || card.last == null) return 0;
    const t = Math.max(0, (now - card.last) / DAY);
    return Math.pow(1 + FACTOR * t / card.s, DECAY);
  }

  function initDifficulty(g) {
    return clampD(W[4] - Math.exp(W[5] * (g - 1)) + 1);
  }

  function nextDifficulty(d, g) {
    const delta = -W[6] * (g - 3);
    const d1 = d + delta * (10 - d) / 9;              // 越接近 10 變化越小
    return clampD(W[7] * initDifficulty(4) + (1 - W[7]) * d1);
  }

  function recallStability(d, s, r, g) {
    const hard = g === 2 ? W[15] : 1;
    const easy = g === 4 ? W[16] : 1;
    return s * (1 + Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) * (Math.exp(W[10] * (1 - r)) - 1) * hard * easy);
  }

  function forgetStability(d, s, r) {
    const sf = W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r));
    return Math.min(sf, s);
  }

  function shortTermStability(s, g) {
    return s * Math.exp(W[17] * (g - 3 + W[18]));
  }

  // 回傳新的卡片狀態（不修改原物件）
  function review(card, grade, now) {
    const g = Math.min(4, Math.max(1, Math.round(grade)));
    let s, d;
    if (!card || !card.reps) {
      s = FIRST_S[g - 1];
      d = initDifficulty(g);
    } else {
      const elapsed = (now - card.last) / DAY;
      d = nextDifficulty(card.d, g);
      if (elapsed < 1) {
        s = shortTermStability(card.s, g);
      } else {
        const r = retrievability(card, now);
        s = g === 1 ? forgetStability(card.d, card.s, r) : recallStability(card.d, card.s, r, g);
      }
    }
    s = Math.min(MAX_DAYS, Math.max(0.01, s));
    const gap = g === 1 ? MIN_GAP : Math.max(MIN_GAP, s * DAY);
    return {
      s, d,
      last: now,
      due: now + gap,
      reps: ((card && card.reps) || 0) + 1,
      lapses: ((card && card.lapses) || 0) + (g === 1 ? 1 : 0),
    };
  }

  // 由答題結果推評分：錯 → 1；對但很慢 → 2；對 → 3；練過幾次又很快 → 4
  function gradeFrom(correct, ms, card, slowMs = 7000, fastMs = 2000) {
    if (!correct) return 1;
    if (ms >= slowMs) return 2;
    if (ms <= fastMs && card && card.reps >= 2) return 4;
    return 3;
  }

  function isDue(card, now) {
    return !!card && card.reps > 0 && card.due <= now;
  }

  // 「學會了」：記憶能維持 3 天以上
  function isLearned(card) {
    return !!card && card.s >= 3;
  }

  // 熟練度 0–3：0 沒學過、1 剛認識、2 記得、3 學會了
  function level(card) {
    if (!card || !card.reps) return 0;
    if (card.s >= 3) return 3;
    if (card.s >= 1) return 2;
    return 1;
  }

  const SRS = { W, DAY, review, retrievability, gradeFrom, isDue, isLearned, level };
  root.SRS = SRS;
  if (typeof module !== 'undefined' && module.exports) module.exports = SRS;
})(typeof window !== 'undefined' ? window : globalThis);
