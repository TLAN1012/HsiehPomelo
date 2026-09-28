/*
 * 每日課程規劃與進度計算（不依賴 DOM）。
 * 原則：每天份量小、先複習到期的字、每天只認識幾個新字、會讀的字夠了就穿插單字；
 * 連續天數只要「有練習」就算，不因沒達標而歸零，避免給孩子壓力。
 */
(function (root) {
  'use strict';

  const Kana = root.Kana || (typeof require !== 'undefined' ? require('./kana.js') : null);
  const SRS = root.SRS || (typeof require !== 'undefined' ? require('./srs.js') : null);
  const Words = root.Words || (typeof require !== 'undefined' ? require('./words.js') : null);

  const NEW_PER_DAY = 4;

  function dateKey(ts) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function addDays(key, n) {
    const [y, m, d] = key.split('-').map(Number);
    return dateKey(new Date(y, m - 1, d + n).getTime());
  }

  // days: { 'YYYY-MM-DD': { n: 題數, ok: 答對, fresh: 新認識 } }
  // 連續天數：從今天（今天還沒練就從昨天）往回數，有練習就算一天
  function streak(days, today) {
    let key = days[today] && days[today].n > 0 ? today : addDays(today, -1);
    let count = 0;
    while (days[key] && days[key].n > 0) {
      count++;
      key = addDays(key, -1);
    }
    return count;
  }

  // 最近 7 天（含今天）的狀態：'goal' 達標、'done' 有練、'' 沒練
  function week(days, today, goal) {
    const out = [];
    for (let i = 6; i >= 0; i--) {
      const key = addDays(today, -i);
      const n = (days[key] && days[key].n) || 0;
      out.push({ key, state: n >= goal ? 'goal' : n > 0 ? 'done' : '' });
    }
    return out;
  }

  // 學習順序：清音 → 濁音 → 拗音；兩種都學時先平假名再片假名
  function learningOrder(script) {
    const groups = ['seion', 'dakuon', 'yoon'];
    const scripts = script === 'both' ? ['hira', 'kata'] : [script];
    const out = [];
    for (const sc of scripts) {
      for (const g of groups) out.push(...Kana.ALL_ITEMS.filter((it) => it.script === sc && it.group === g));
    }
    return out;
  }

  function counts(srs, script) {
    let seen = 0;
    let learned = 0;
    const order = learningOrder(script);
    for (const it of order) {
      const lv = SRS.level(srs[it.kana]);
      if (lv > 0) seen++;
      if (lv === 3) learned++;
    }
    return { seen, learned, total: order.length };
  }

  function pickMode(level, rand) {
    const pool = level <= 1 ? ['pick-romaji', 'listen'] : ['pick-romaji', 'pick-kana', 'listen'];
    return pool[Math.floor(rand() * pool.length)];
  }

  /*
   * 產生今天的課程。回傳步驟陣列：
   *   { type: 'intro', item }                          認識新字（不算題數）
   *   { type: 'q', kind: 'kana', item, mode }          假名題
   *   { type: 'q', kind: 'word', word, mode }          單字題
   * freshToday：今天已經認識過幾個新字（避免一天塞太多）
   */
  function planLesson({ srs, now, script = 'hira', goal = 10, freshToday = 0, rand = Math.random }) {
    const order = learningOrder(script);
    const due = order.filter((it) => SRS.isDue(srs[it.kana], now))
      .sort((a, b) => srs[a.kana].due - srs[b.kana].due)
      .slice(0, goal);

    const unseen = order.filter((it) => !srs[it.kana] || !srs[it.kana].reps);
    const room = Math.max(0, NEW_PER_DAY - freshToday);
    const nNew = due.length >= goal ? 0 : Math.min(room, unseen.length, Math.max(2, Math.ceil((goal - due.length) / 2)));
    const fresh = unseen.slice(0, nNew);

    const seen = order.filter((it) => srs[it.kana] && srs[it.kana].reps);
    const known = new Set(seen.map((it) => it.kana));
    const readable = Words.readable((k) => known.has(k), script);
    const wordDue = readable.filter((w) => !srs[w.key] || SRS.isDue(srs[w.key], now));
    const nWords = readable.length >= 3 ? Math.min(3, Math.floor(goal / 4), wordDue.length || readable.length) : 0;
    const words = Kana.shuffle(wordDue.length ? wordDue : readable, rand).slice(0, nWords);

    const qs = [];
    for (const it of due) qs.push({ type: 'q', kind: 'kana', item: it, mode: pickMode(SRS.level(srs[it.kana]), rand) });
    for (const w of words) qs.push({ type: 'q', kind: 'word', word: w, mode: rand() < 0.5 ? 'word-meaning' : 'word-listen' });

    // 題數不夠：拿記得最不牢的舊字補
    const target = goal - fresh.length * 2;
    if (qs.length < target && seen.length) {
      const inLesson = new Set(due.map((it) => it.kana));
      const extra = seen.filter((it) => !inLesson.has(it.kana))
        .sort((a, b) => SRS.retrievability(srs[a.kana], now) - SRS.retrievability(srs[b.kana], now));
      for (const it of extra.slice(0, target - qs.length)) {
        qs.push({ type: 'q', kind: 'kana', item: it, mode: pickMode(SRS.level(srs[it.kana]), rand) });
      }
      // 還是不夠（會的字都剛複習過）：學過的字換個題型再練，保證「繼續練習」一定有題目
      const again = Kana.shuffle(seen, rand);
      for (let i = 0; qs.length < target && i < goal * 2; i++) {
        const it = again[i % again.length];
        qs.push({ type: 'q', kind: 'kana', item: it, mode: pickMode(3, rand) });
      }
    }

    const steps = Kana.shuffle(qs, rand);
    // 新字：先介紹，隔一兩題考「看字選拼音」，課程後段再考「聽音選字」
    fresh.forEach((it, i) => {
      const at = Math.min(steps.length, i * 3);
      steps.splice(at, 0, { type: 'intro', item: it });
      steps.splice(Math.min(steps.length, at + 2), 0, { type: 'q', kind: 'kana', item: it, mode: 'pick-romaji' });
    });
    for (const it of fresh) steps.push({ type: 'q', kind: 'kana', item: it, mode: 'listen' });
    // 還不到目標題數（例如第一天什麼都還沒學）：新字再用「看拼音選字」考一輪，讓孩子第一天就能達標
    let qCount = steps.filter((s) => s.type === 'q').length;
    for (let i = 0; qCount < goal && fresh.length && i < fresh.length * 2; i++, qCount++) {
      steps.push({ type: 'q', kind: 'kana', item: fresh[i % fresh.length], mode: 'pick-kana' });
    }
    return steps;
  }

  const Progress = { NEW_PER_DAY, dateKey, addDays, streak, week, learningOrder, counts, planLesson };
  root.Progress = Progress;
  if (typeof module !== 'undefined' && module.exports) module.exports = Progress;
})(typeof window !== 'undefined' ? window : globalThis);
