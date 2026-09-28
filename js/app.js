(function () {
  'use strict';

  const { GROUPS, ROWS, SCRIPTS } = Kana;
  const SETTINGS_KEY = 'kana-drill:settings';
  const STATS_KEY = 'kana-drill:stats';
  const SRS_KEY = 'kana-drill:srs';
  const DAILY_KEY = 'kana-drill:daily';

  const $ = (id) => document.getElementById(id);
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };
  const pickOne = (list) => list[Math.floor(Math.random() * list.length)];

  // ---------- 儲存 ----------

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? Object.assign(fallback, JSON.parse(raw)) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      // 無痕模式等情況下無法儲存，不影響練習
    }
  }

  const settings = load(SETTINGS_KEY, {
    script: 'hira',
    mode: 'type',
    count: '20',
    speak: false,
    rows: ['a', 'ka', 'sa', 'ta', 'na'],
  });
  let stats = load(STATS_KEY, {});
  let srs = load(SRS_KEY, {});
  const daily = load(DAILY_KEY, { goal: 10, script: 'hira', sfx: true, days: {} });

  const today = () => Progress.dateKey(Date.now());
  function todayLog() {
    const k = today();
    daily.days[k] = daily.days[k] || { n: 0, ok: 0, fresh: 0 };
    return daily.days[k];
  }

  function recordResult(key, correct, ms, isKana) {
    if (isKana) {
      const s = stats[key] || { c: 0, w: 0 };
      if (correct) s.c++; else s.w++;
      s.last = correct ? 1 : 0;
      stats[key] = s;
      save(STATS_KEY, stats);
    }
    const before = srs[key];
    srs[key] = SRS.review(before, SRS.gradeFrom(correct, ms, before), Date.now());
    save(SRS_KEY, srs);
    const log = todayLog();
    log.n++;
    if (correct) log.ok++;
    save(DAILY_KEY, daily);
  }

  // ---------- 發音與音效 ----------

  const canSpeak = 'speechSynthesis' in window;
  let jaVoice = null;
  function pickVoice() {
    if (!canSpeak) return;
    const voices = speechSynthesis.getVoices();
    jaVoice = voices.find((v) => v.lang === 'ja-JP') || voices.find((v) => /^ja/i.test(v.lang)) || null;
  }
  if (canSpeak) {
    pickVoice();
    speechSynthesis.addEventListener('voiceschanged', pickVoice);
  }

  function speak(text) {
    if (!canSpeak) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP';
    u.rate = 0.8;
    if (jaVoice) u.voice = jaVoice;
    speechSynthesis.speak(u);
  }

  let audio = null;
  function chime(notes) {
    if (!daily.sfx) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const t0 = audio.currentTime;
      notes.forEach(([freq, at, dur]) => {
        const o = audio.createOscillator();
        const g = audio.createGain();
        o.type = 'sine';
        o.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, t0 + at);
        g.gain.exponentialRampToValueAtTime(0.18, t0 + at + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
        o.connect(g).connect(audio.destination);
        o.start(t0 + at);
        o.stop(t0 + at + dur + 0.05);
      });
    } catch (e) {
      // 沒有音效也沒關係
    }
  }
  const SFX = {
    good: () => chime([[784, 0, 0.18], [1175, 0.09, 0.3]]),
    combo: () => chime([[784, 0, 0.15], [988, 0.08, 0.15], [1319, 0.16, 0.35]]),
    done: () => chime([[523, 0, 0.2], [659, 0.12, 0.2], [784, 0.24, 0.2], [1047, 0.36, 0.5]]),
  };

  // ---------- 畫面切換 ----------

  const VIEWS = ['home', 'setup', 'quiz', 'result', 'write', 'numbers', 'chart', 'stickers'];
  const PRACTICE_VIEWS = ['setup', 'quiz', 'result'];
  let practiceView = 'setup';

  function showView(name) {
    for (const v of VIEWS) $('view-' + v).hidden = v !== name;
    if (PRACTICE_VIEWS.includes(name) && !(session && session.lesson)) practiceView = name;
    const tab = name === 'stickers' ? 'home' : PRACTICE_VIEWS.includes(name) ? (session && session.lesson ? 'home' : 'setup') : name;
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('is-active', t.dataset.view === tab));
    document.body.classList.toggle('in-quiz', name === 'quiz');
    if (name !== 'result') $('confetti').hidden = true;
    window.scrollTo(0, 0);
  }

  document.querySelectorAll('.tab').forEach((t) => {
    t.addEventListener('click', () => {
      const v = t.dataset.view;
      if (v === 'home') { renderHome(); showView('home'); }
      else if (v === 'chart') { renderChart(); showView('chart'); }
      else if (v === 'write') { showView('write'); window.KanaWrite.show(); }
      else if (v === 'numbers') { showView('numbers'); window.KanaNumbersView.show(); }
      else showView(practiceView === 'quiz' && session && session.lesson ? 'setup' : practiceView);
    });
  });

  // ---------- 口訣卡（底部彈出） ----------

  function mnemonicBlock(kana, compact) {
    const m = Mnemonics.mnemonicOf(kana);
    if (!m) return null;
    const box = el('div', 'mn' + (compact ? ' mn--compact' : ''));
    const img = el('img', 'mn-img');
    img.src = m.img;
    img.alt = '';
    img.loading = 'lazy';
    img.onerror = () => img.remove();
    box.appendChild(img);
    const txt = el('div', 'mn-text');
    txt.appendChild(el('div', 'mn-line', m.text));
    if (m.note) txt.appendChild(el('div', 'mn-note', m.note));
    box.appendChild(txt);
    return box;
  }

  function openSheet(kana) {
    const item = Kana.ALL_ITEMS.find((it) => it.kana === kana);
    const body = $('sheet-body');
    body.textContent = '';
    const head = el('div', 'sheet-head');
    const k = el('span', 'sheet-kana', kana);
    k.lang = 'ja';
    head.appendChild(k);
    if (item) head.appendChild(el('span', 'sheet-romaji', item.romaji[0]));
    body.appendChild(head);
    const mn = mnemonicBlock(kana);
    if (mn) body.appendChild(mn);
    const lv = SRS.level(srs[kana]);
    body.appendChild(el('p', 'sheet-level', ['還沒認識', '剛認識 🌱', '記得了 🌼', '學會了 🍈'][lv]));
    $('sheet').hidden = false;
    speak(kana);
  }
  $('sheet-close').addEventListener('click', () => { $('sheet').hidden = true; });
  $('sheet').addEventListener('click', (e) => { if (e.target === $('sheet')) $('sheet').hidden = true; });
  $('sheet-speak').addEventListener('click', () => speak($('sheet-body').querySelector('.sheet-kana').textContent));

  // ---------- 首頁「今天」 ----------

  const TREE_SPOTS = (() => {
    // 黃金角螺旋，在樹冠裡平均撒點；位置固定，每次畫都一樣
    const pts = [];
    for (let i = 0; i < 120; i++) {
      const r = 50 * Math.sqrt((i + 0.5) / 120);
      const a = i * 2.39996;
      pts.push([100 + r * Math.cos(a) * 1.25, 70 + r * Math.sin(a) * 0.9]);
    }
    // 用固定種子洗牌：前幾朵花就散佈在整個樹冠，每次畫的位置又都一樣
    let seed = 20260928;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = pts.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [pts[i], pts[j]] = [pts[j], pts[i]];
    }
    return pts;
  })();

  function treeSvg(flowers, fruits) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 200 170');
    svg.setAttribute('class', 'tree');
    const add = (tag, attrs) => {
      const n = document.createElementNS(ns, tag);
      for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
      svg.appendChild(n);
      return n;
    };
    add('ellipse', { cx: 100, cy: 160, rx: 70, ry: 8, class: 'tree-ground' });
    add('path', { d: 'M92 160 Q95 120 90 95 L110 95 Q105 120 108 160 Z', class: 'tree-trunk' });
    add('ellipse', { cx: 100, cy: 70, rx: 72, ry: 55, class: 'tree-leaves' });
    add('ellipse', { cx: 70, cy: 55, rx: 35, ry: 28, class: 'tree-leaves tree-leaves--light' });
    const total = Math.min(TREE_SPOTS.length, flowers + fruits);
    for (let i = 0; i < total; i++) {
      const [x, y] = TREE_SPOTS[i];
      if (i < fruits) {
        add('circle', { cx: x, cy: y, r: 6.5, class: 'tree-fruit' });
        add('circle', { cx: x - 2, cy: y - 2, r: 1.8, class: 'tree-fruit-shine' });
      } else {
        add('circle', { cx: x, cy: y, r: 3.2, class: 'tree-flower' });
      }
    }
    return svg;
  }

  function greeting() {
    const h = new Date().getHours();
    if (h < 11) return '早安！☀️';
    if (h < 18) return '午安！🌤️';
    return '晚安！🌙';
  }

  function renderHome() {
    const log = todayLog();
    const days = daily.days;
    const st = Progress.streak(days, today());
    const yesterdayGap = !days[Progress.addDays(today(), -1)] && Object.keys(days).some((k) => k < today() && days[k].n > 0);
    $('home-greet').textContent = greeting();
    $('home-streak').textContent = st > 0 ? `🔥 連續 ${st} 天` : yesterdayGap ? '歡迎回來！我們繼續 😊' : '一起開始吧！';

    const pct = Math.min(1, log.n / daily.goal);
    $('goal-ring').style.setProperty('--p', pct);
    $('goal-text').textContent = `${Math.min(log.n, daily.goal)}/${daily.goal}`;
    const done = log.n >= daily.goal;
    $('btn-lesson').textContent = done ? '今天完成了 🎉 再玩一下' : log.n > 0 ? '繼續今天的練習 ▶' : '開始今天的練習 ▶';
    $('home-sub').textContent = done ? '目標達成！想多練也可以，不練也很棒。' : `今天的目標：${daily.goal} 題，大約 3 分鐘`;

    const wk = $('home-week');
    wk.textContent = '';
    const names = '日一二三四五六';
    for (const d of Progress.week(days, today(), daily.goal)) {
      const cell = el('div', 'day' + (d.key === today() ? ' is-today' : ''));
      const [y, m, dd] = d.key.split('-').map(Number);
      cell.appendChild(el('span', 'day-name', names[new Date(y, m - 1, dd).getDay()]));
      cell.appendChild(el('span', 'day-stamp ' + (d.state ? 'is-' + d.state : ''), d.state === 'goal' ? '🍈' : d.state === 'done' ? '🌱' : ''));
      wk.appendChild(cell);
    }

    const c = Progress.counts(srs, 'both');
    const tree = $('home-tree');
    tree.textContent = '';
    tree.appendChild(treeSvg(c.seen - c.learned, c.learned));
    $('tree-caption').textContent = c.seen === 0
      ? '每認識一個新字，樹上就會開一朵花；記牢了，花就會長成文旦 🍈'
      : `🌼 ${c.seen - c.learned} 朵花　🍈 ${c.learned} 顆文旦`;

    const sc = Progress.counts(srs, daily.script);
    $('home-progress').textContent = `${SCRIPTS[daily.script] || '平假名＋片假名'}：認識 ${sc.seen} / ${sc.total} 個字`;
    $('sticker-count').textContent = `${stickerCount()} / 92`;

    document.querySelectorAll('input[name="home-script"]').forEach((i) => { i.checked = i.value === daily.script; });
    document.querySelectorAll('input[name="home-goal"]').forEach((i) => { i.checked = Number(i.value) === daily.goal; });
    $('home-sfx').checked = daily.sfx;
  }

  document.querySelectorAll('input[name="home-script"]').forEach((i) => i.addEventListener('change', () => {
    daily.script = i.value; save(DAILY_KEY, daily); renderHome();
  }));
  document.querySelectorAll('input[name="home-goal"]').forEach((i) => i.addEventListener('change', () => {
    daily.goal = Number(i.value); save(DAILY_KEY, daily); renderHome();
  }));
  $('home-sfx').addEventListener('change', (e) => { daily.sfx = e.target.checked; save(DAILY_KEY, daily); });

  $('btn-lesson').addEventListener('click', () => {
    const steps = Progress.planLesson({ srs, now: Date.now(), script: daily.script, goal: daily.goal, freshToday: todayLog().fresh });
    if (!steps.length) return;
    startLesson(steps);
  });
  $('btn-stickers').addEventListener('click', () => { renderStickers(); showView('stickers'); });

  // ---------- 貼紙簿 ----------

  const STICKER_KANA = Object.keys(Mnemonics.DATA);
  function stickerCount() {
    return STICKER_KANA.filter((k) => SRS.level(srs[k]) > 0).length;
  }

  let stickerScript = 'hira';
  document.querySelectorAll('input[name="sticker-script"]').forEach((i) => i.addEventListener('change', () => {
    stickerScript = i.value; renderStickers();
  }));
  $('stickers-back').addEventListener('click', () => { renderHome(); showView('home'); });

  function renderStickers() {
    const grid = $('sticker-grid');
    grid.textContent = '';
    const list = STICKER_KANA.filter((k) => (stickerScript === 'kata') === /[ァ-ヺ]/.test(k));
    let got = 0;
    for (const k of list) {
      const lv = SRS.level(srs[k]);
      const b = el('button', 'sticker' + (lv === 3 ? ' is-gold' : lv > 0 ? ' is-got' : ''));
      b.type = 'button';
      if (lv > 0) {
        got++;
        const img = el('img');
        img.src = Mnemonics.mnemonicOf(k).img;
        img.alt = '';
        img.loading = 'lazy';
        b.appendChild(img);
        const tag = el('span', 'sticker-kana', k);
        tag.lang = 'ja';
        b.appendChild(tag);
        b.addEventListener('click', () => openSheet(k));
      } else {
        b.appendChild(el('span', 'sticker-lock', '?'));
        b.disabled = true;
      }
      grid.appendChild(b);
    }
    $('sticker-summary').textContent = got === 0
      ? '認識新字就能得到那個字的貼紙喔！'
      : `收集了 ${got} / ${list.length} 張${list.length === got ? '，全部集滿了！🏆' : '，加油！'}`;
  }

  // ---------- 設定畫面（自選練習） ----------

  function bindRadios(name, key, onChange) {
    document.querySelectorAll(`input[name="${name}"]`).forEach((input) => {
      input.checked = input.value === settings[key];
      input.addEventListener('change', () => {
        settings[key] = input.value;
        save(SETTINGS_KEY, settings);
        if (onChange) onChange();
      });
    });
  }

  bindRadios('script', 'script', () => { renderRowPicker(); updatePoolSize(); });
  bindRadios('mode', 'mode', updatePoolSize);
  bindRadios('count', 'count', updateCountHint);

  $('opt-speak').checked = settings.speak;
  $('opt-speak').addEventListener('change', (e) => {
    settings.speak = e.target.checked;
    save(SETTINGS_KEY, settings);
  });
  if (!canSpeak) {
    $('opt-speak').closest('label').hidden = true;
    document.querySelectorAll('input[value="listen"], input[value="word-listen"]').forEach((i) => { i.closest('label').hidden = true; });
  }

  function updateCountHint() {
    const hints = {
      round: '範圍內每個字各出一次，答錯的字會在最後再出現，直到全部答對為止。',
      endless: '一直出題，按左上角的 ✕ 停止。',
    };
    $('count-hint').textContent = hints[settings.count] || '常答錯或還沒練過的字會比較常出現。';
  }

  function renderRowPicker() {
    const picker = $('row-picker');
    picker.textContent = '';
    const displayScript = settings.script === 'kata' ? 'kata' : 'hira';
    const selected = new Set(settings.rows);

    for (const group of GROUPS) {
      const rows = ROWS.filter((r) => r.group === group.id);
      const section = el('div', 'row-group');
      const head = el('div', 'row-group-head');
      head.appendChild(el('h3', null, group.label));
      const toggleAll = el('button', 'btn-link');
      toggleAll.type = 'button';
      const allOn = () => rows.every((r) => selected.has(r.id));
      toggleAll.textContent = allOn() ? '全不選' : '全選';
      toggleAll.addEventListener('click', () => {
        const turnOn = !allOn();
        for (const r of rows) {
          if (turnOn) selected.add(r.id); else selected.delete(r.id);
        }
        commitRows(selected);
      });
      head.appendChild(toggleAll);
      section.appendChild(head);

      const chips = el('div', 'chips');
      for (const row of rows) {
        const label = el('label', 'chip');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = selected.has(row.id);
        cb.addEventListener('change', () => {
          if (cb.checked) selected.add(row.id); else selected.delete(row.id);
          commitRows(selected);
        });
        label.appendChild(cb);
        const text = el('span');
        text.lang = 'ja';
        const kana = row.items.filter(Boolean).map((c) => c[0]).join('');
        text.textContent = displayScript === 'kata' ? Kana.toKatakana(kana) : kana;
        label.appendChild(text);
        chips.appendChild(label);
      }
      section.appendChild(chips);
      picker.appendChild(section);
    }
  }

  function commitRows(selected) {
    settings.rows = ROWS.map((r) => r.id).filter((id) => selected.has(id));
    save(SETTINGS_KEY, settings);
    renderRowPicker();
    updatePoolSize();
  }

  const isWordMode = (mode) => mode === 'word-meaning' || mode === 'word-listen';

  function currentPool() {
    const kana = Kana.buildPool(settings.script, settings.rows);
    if (!isWordMode(settings.mode)) return kana;
    const inRange = new Set(kana.map((it) => it.kana));
    return Words.readable((k) => inRange.has(k), settings.script);
  }

  function updatePoolSize() {
    const n = currentPool().length;
    const words = isWordMode(settings.mode);
    const enough = words ? n >= 4 : n > 0;
    $('pool-size').textContent = words
      ? (enough ? `可以讀 ${n} 個單字` : `目前只能組成 ${n} 個單字，多選幾行試試`)
      : (n ? `共 ${n} 個字` : '請至少選一行');
    $('btn-start').disabled = !enough;
  }

  // ---------- 練習引擎 ----------

  let session = null;
  const PRAISE = ['太棒了！', '答對了！', '好厲害！', 'すごい！', '完美！✨', '正確！👍', '你記住了！', 'やった！'];
  const NEAR = ['差一點點！', '沒關係，再看一次 👀', '快記住了！', '下次一定會 💪'];

  function newSession(extra) {
    $('burst').hidden = true;
    return Object.assign({
      asked: 0, correct: 0, combo: 0, best: 0, mistakes: new Map(), recent: [],
      current: null, choices: null, answered: false, startTime: Date.now(), qStart: 0,
      freshNames: [], seenBefore: Progress.counts(srs, 'both'),
    }, extra);
  }

  // 自選練習：依設定出題
  function startSession(pool, mode, count) {
    session = newSession({ lesson: false, pool, mode, count, queue: count === 'round' ? Kana.shuffle(pool) : null });
    showView('quiz');
    nextQuestion();
  }

  // 今日課程：照課程表走，答錯的字 3 題後再出一次（只補一次）
  function startLesson(steps) {
    session = newSession({ lesson: true, steps: steps.slice(), total: steps.filter((s) => s.type === 'q').length, retried: new Set() });
    showView('quiz');
    nextQuestion();
  }

  function sessionTotal() {
    if (session.lesson) return session.total;
    if (session.count === 'endless') return null;
    if (session.count === 'round') {
      const pending = session.current && !session.answered ? 1 : 0;
      return session.asked + session.queue.length + pending;
    }
    return Number(session.count);
  }

  function lessonPool() {
    // 課程中的選項：從已認識的字（和這堂課的新字）挑，不夠時 makeChoices 會自己補
    const known = Kana.ALL_ITEMS.filter((it) => srs[it.kana] && srs[it.kana].reps);
    return known.length >= 4 ? known : Progress.learningOrder(daily.script).slice(0, 10);
  }

  function nextQuestion() {
    let q;
    if (session.lesson) {
      const step = session.steps.shift();
      if (!step) { finishSession(); return; }
      if (step.type === 'intro') { renderIntro(step.item); return; }
      q = step;
    } else {
      const total = sessionTotal();
      if (total !== null && session.asked >= total) { finishSession(); return; }
      if (isWordMode(session.mode)) {
        const cands = session.pool.filter((w) => !session.recent.includes(w.key));
        q = { kind: 'word', word: pickOne(cands.length ? cands : session.pool), mode: session.mode };
      } else {
        const item = session.count === 'round' ? session.queue.shift() : Kana.pickWeighted(session.pool, stats, session.recent);
        q = { kind: 'kana', item, mode: session.mode };
      }
      const key = q.kind === 'word' ? q.word.key : q.item.kana;
      const memory = Math.min(3, session.pool.length - 1);
      session.recent = memory > 0 ? session.recent.concat(key).slice(-memory) : [];
    }
    session.current = q;
    session.answered = false;
    renderQuestion();
  }

  function setStatus() {
    const total = sessionTotal();
    const n = session.asked + (session.answered ? 0 : 1);
    $('quiz-progress-text').textContent = total === null ? `第 ${n} 題` : `${Math.min(n, total)} / ${total}`;
    $('quiz-progress').style.width = total === null ? '0' : `${(session.asked / total) * 100}%`;
    $('quiz-progress').parentElement.hidden = total === null;
    const combo = $('quiz-combo');
    combo.hidden = session.combo < 2;
    combo.textContent = `🔥 ${session.combo}`;
  }

  function resetCard() {
    $('feedback').textContent = '';
    $('feedback').className = 'feedback';
    $('btn-next').hidden = true;
    $('btn-speak').hidden = true;
    $('intro').hidden = true;
    $('type-form').hidden = true;
    $('choices').hidden = true;
    $('choices').textContent = '';
    $('prompt').hidden = false;
    $('prompt-tag').hidden = false;
  }

  function renderIntro(item) {
    session.current = { kind: 'intro', item };
    session.answered = true;
    resetCard();
    setStatus();
    $('prompt-tag').textContent = '✨ 認識新朋友';
    const prompt = $('prompt');
    prompt.className = 'prompt prompt--intro';
    prompt.textContent = item.kana;
    prompt.lang = 'ja';
    const box = $('intro');
    box.textContent = '';
    box.appendChild(el('div', 'intro-romaji', item.romaji[0]));
    const mn = mnemonicBlock(item.kana);
    if (mn) box.appendChild(mn);
    box.hidden = false;
    $('btn-speak').hidden = !canSpeak;
    $('btn-next').textContent = '記住了 👍';
    $('btn-next').hidden = false;
    speak(item.kana);
    // 認識了就發一張貼紙（開一朵花）
    if (!srs[item.kana] || !srs[item.kana].reps) {
      session.freshNames.push(item.kana);
      todayLog().fresh++;
      save(DAILY_KEY, daily);
    }
  }

  function renderQuestion() {
    const q = session.current;
    resetCard();
    setStatus();
    const prompt = $('prompt');
    prompt.className = 'prompt';
    const tag = $('prompt-tag');
    const listen = q.mode === 'listen' || q.mode === 'word-listen';

    if (listen) {
      tag.textContent = q.kind === 'word' ? '聽聽看，是哪個單字？' : '聽聽看，是哪個字？';
      prompt.textContent = '🔊';
      prompt.lang = 'en';
      prompt.classList.add('prompt--listen');
      prompt.onclick = () => speak(q.kind === 'word' ? q.word.word : q.item.kana);
      setTimeout(() => speak(q.kind === 'word' ? q.word.word : q.item.kana), 250);
    } else {
      prompt.onclick = null;
      if (q.kind === 'word') {
        tag.textContent = '這個單字是什麼意思？';
        prompt.textContent = q.word.word;
        prompt.lang = 'ja';
        prompt.classList.add('prompt--word');
      } else if (q.mode === 'pick-kana') {
        tag.textContent = `哪一個是 ${q.item.romaji[0]}？`;
        prompt.textContent = q.item.romaji[0];
        prompt.lang = 'en';
        prompt.classList.add('prompt--romaji');
      } else {
        tag.textContent = q.mode === 'type' ? '打出讀音' : '這個字怎麼唸？';
        prompt.textContent = q.item.kana;
        prompt.lang = 'ja';
      }
    }

    if (q.mode === 'type') {
      const input = $('type-input');
      $('type-form').hidden = false;
      input.value = '';
      input.disabled = false;
      input.className = '';
      $('btn-check').textContent = '確認';
      input.focus();
    } else {
      const choices = $('choices');
      choices.hidden = false;
      session.choices = buildChoices(q);
      session.choices.forEach((c, i) => {
        const b = el('button', 'choice');
        b.type = 'button';
        b.dataset.key = c.key;
        b.appendChild(el('span', 'choice-key', String(i + 1)));
        const label = el('span', 'choice-label');
        if (q.mode === 'word-meaning') {
          label.textContent = `${c.word.emoji} ${c.word.meaning}`;
          b.classList.add('choice--meaning');
        } else if (q.kind === 'word') {
          label.textContent = c.word.word;
          label.lang = 'ja';
          b.classList.add('choice--kana', 'choice--word');
        } else if (q.mode === 'pick-romaji') {
          label.textContent = c.item.romaji[0];
          label.lang = 'en';
        } else {
          label.textContent = c.item.kana;
          label.lang = 'ja';
          b.classList.add('choice--kana');
        }
        b.appendChild(label);
        b.addEventListener('click', () => answerChoice(c, b));
        choices.appendChild(b);
      });
      if (document.activeElement) document.activeElement.blur();
    }
    session.qStart = Date.now();
  }

  function buildChoices(q) {
    if (q.kind === 'word') {
      const sameScript = Words.WORDS.filter((w) => Words.isKata(w) === Words.isKata(q.word) && w.key !== q.word.key
        && w.meaning !== q.word.meaning);
      let pool = sameScript;
      if (q.mode === 'word-listen') {
        // 聽音選單字：干擾項盡量用讀得懂的單字
        const known = new Set(Kana.ALL_ITEMS.filter((it) => srs[it.kana] && srs[it.kana].reps).map((it) => it.kana));
        const readable = sameScript.filter((w) => Words.units(w.word).every((u) => known.has(u)));
        if (readable.length >= 3) pool = readable;
      }
      return Kana.shuffle([q.word].concat(Kana.shuffle(pool).slice(0, 3))).map((w) => ({ key: w.key, word: w }));
    }
    const pool = session.lesson ? lessonPool() : session.pool;
    return Kana.makeChoices(q.item, pool, 4).map((it) => ({ key: it.kana, item: it }));
  }

  function currentKey() {
    const q = session.current;
    return q.kind === 'word' ? q.word.key : q.item.kana;
  }

  function answerChoice(choice, button) {
    if (session.answered) return;
    const correct = choice.key === currentKey();
    for (const b of $('choices').children) {
      b.disabled = true;
      if (b.dataset.key === currentKey()) b.classList.add('is-correct');
    }
    if (!correct) button.classList.add('is-wrong');
    settle(correct, choice.word ? choice.word.word : session.current.mode === 'pick-romaji' ? choice.item.romaji[0] : choice.item.kana);
    $('btn-next').focus();
  }

  function answerTyped() {
    const input = $('type-input');
    const value = input.value.trim();
    if (!value) return;
    const correct = Kana.checkAnswer(session.current.item, value);
    input.disabled = true;
    input.className = correct ? 'is-correct' : 'is-wrong';
    settle(correct, value);
    $('btn-check').textContent = '下一題';
    $('btn-check').focus();
  }

  function settle(correct, given) {
    const q = session.current;
    const ms = Date.now() - session.qStart;
    session.answered = true;
    session.asked++;
    if (correct) {
      session.correct++;
      session.combo++;
      session.best = Math.max(session.best, session.combo);
    } else {
      session.combo = 0;
      const key = currentKey();
      const m = session.mistakes.get(key) || { q, answers: [] };
      m.answers.push(given);
      session.mistakes.set(key, m);
      if (session.queue && !session.queue.includes(q.item)) session.queue.push(q.item);
      // 課程：答錯的題目 3 題後再來一次，讓孩子有機會答對（每題只補一次，不增加總題數壓力）
      if (session.lesson && !session.retried.has(key)) {
        session.retried.add(key);
        session.steps.splice(Math.min(3, session.steps.length), 0, Object.assign({}, q, { retry: true }));
        session.total++;
      }
    }
    recordResult(currentKey(), correct, ms, q.kind === 'kana');

    const fb = $('feedback');
    fb.textContent = '';
    fb.className = 'feedback ' + (correct ? 'is-correct' : 'is-near');
    const head = correct ? pickOne(PRAISE) : pickOne(NEAR);
    fb.appendChild(el('span', 'feedback-mark', head));
    const pair = el('span', 'feedback-pair');
    if (q.kind === 'word') {
      const w = el('span', 'feedback-kana', q.word.word);
      w.lang = 'ja';
      pair.appendChild(w);
      pair.appendChild(document.createTextNode(` ${q.word.romaji} ＝ ${q.word.emoji} ${q.word.meaning}`));
    } else {
      const k = el('span', 'feedback-kana', q.item.kana);
      k.lang = 'ja';
      pair.appendChild(k);
      pair.appendChild(document.createTextNode(' = ' + q.item.romaji[0]));
    }
    fb.appendChild(pair);
    if (q.kind === 'kana' && q.item.romaji.length > 1) {
      fb.appendChild(el('span', 'feedback-note', `也可寫作 ${q.item.romaji.slice(1).join('、')}`));
    }
    if (!correct && q.mode === 'type') fb.appendChild(el('span', 'feedback-note', `你寫的是：${given}`));
    if (!correct && q.kind === 'kana') {
      const mn = mnemonicBlock(q.item.kana, true);
      if (mn) fb.appendChild(mn);
    }

    if (correct) {
      if (session.combo > 0 && session.combo % 5 === 0) {
        burst(`連續答對 ${session.combo} 題！🎉`);
        SFX.combo();
      } else {
        SFX.good();
      }
      pop($('prompt'));
    }

    setStatus();
    $('btn-speak').hidden = !canSpeak;
    $('btn-next').textContent = '下一題 ↵';
    $('btn-next').hidden = q.mode === 'type';
    if (settings.speak || session.lesson || q.kind === 'word') speak(q.kind === 'word' ? q.word.word : q.item.kana);
  }

  function pop(node) {
    node.classList.remove('is-pop');
    void node.offsetWidth;
    node.classList.add('is-pop');
  }

  function burst(text) {
    const b = $('burst');
    b.textContent = text;
    b.hidden = false;
    b.classList.remove('is-on');
    void b.offsetWidth;
    b.classList.add('is-on');
    clearTimeout(burst.t);
    burst.t = setTimeout(() => { b.hidden = true; }, 1600);
  }

  $('type-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (session.answered) nextQuestion();
    else answerTyped();
  });
  $('btn-next').addEventListener('click', nextQuestion);
  $('btn-speak').addEventListener('click', () => {
    const q = session.current;
    speak(q.kind === 'word' ? q.word.word : q.item.kana);
  });
  $('btn-quit').addEventListener('click', () => {
    if (session.asked === 0) {
      if (session.lesson) { renderHome(); showView('home'); } else showView('setup');
    } else {
      finishSession();
    }
  });

  document.addEventListener('keydown', (e) => {
    if ($('view-quiz').hidden || !session || !session.current) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (session.current.kind === 'intro' && e.key === 'Enter') { e.preventDefault(); nextQuestion(); return; }
    if (session.current.mode === 'type') return;
    const idx = Number(e.key) - 1;
    if (!session.answered && idx >= 0 && idx < session.choices.length) {
      e.preventDefault();
      $('choices').children[idx].click();
    }
  });

  // ---------- 結果 ----------

  function formatDuration(ms) {
    const s = Math.round(ms / 1000);
    const m = Math.floor(s / 60);
    return m ? `${m} 分 ${s % 60} 秒` : `${s} 秒`;
  }

  function confetti() {
    const box = $('confetti');
    box.textContent = '';
    const bits = ['🍈', '⭐', '🌼', '✨', '🎉'];
    for (let i = 0; i < 18; i++) {
      const s = el('span', 'confetti-bit', pickOne(bits));
      s.style.left = `${Math.random() * 100}%`;
      s.style.animationDelay = `${Math.random() * 0.6}s`;
      s.style.fontSize = `${18 + Math.random() * 16}px`;
      box.appendChild(s);
    }
    box.hidden = false;
    setTimeout(() => { box.hidden = true; }, 3200);
  }

  function finishSession() {
    const { asked, correct, mistakes } = session;
    const pct = asked ? correct / asked : 0;
    const after = Progress.counts(srs, 'both');
    const newFlowers = session.freshNames.length;
    const newFruits = Math.max(0, after.learned - session.seenBefore.learned);

    const [emoji, title] = pct >= 0.9 ? ['🌟', '太厲害了！'] : pct >= 0.7 ? ['👏', '做得很好！'] : ['💪', '有進步喔！'];
    $('result-emoji').textContent = asked ? emoji : '👋';
    $('result-title').textContent = asked ? title : '下次見！';
    $('result-score').textContent = asked ? `答對 ${correct} / ${asked} 題` : '';

    const gains = $('result-gains');
    gains.textContent = '';
    const addGain = (icon, text) => { const g = el('div', 'gain'); g.appendChild(el('span', 'gain-icon', icon)); g.appendChild(el('span', null, text)); gains.appendChild(g); };
    if (newFlowers) addGain('🌼', `認識了 ${newFlowers} 個新字：${session.freshNames.join(' ')}（貼紙 +${newFlowers}）`);
    if (newFruits) addGain('🍈', `${newFruits} 個字記牢了，長成文旦！`);
    if (session.best >= 3) addGain('🔥', `最多連續答對 ${session.best} 題`);
    const log = todayLog();
    if (session.lesson) addGain('📅', log.n >= daily.goal ? `今天的目標達成了（${log.n} 題）` : `今天練了 ${log.n} 題，目標 ${daily.goal} 題`);
    addGain('⏱️', `用時 ${formatDuration(Date.now() - session.startTime)}`);

    const list = $('result-mistakes');
    list.textContent = '';
    for (const { q } of mistakes.values()) {
      const row = el('div', 'mistake');
      const word = q.kind === 'word';
      const k = el('span', 'mistake-kana', word ? q.word.word : q.item.kana);
      k.lang = 'ja';
      row.appendChild(k);
      row.appendChild(el('span', 'mistake-romaji', word ? `${q.word.emoji} ${q.word.meaning}` : q.item.romaji[0]));
      row.addEventListener('click', () => (word ? speak(q.word.word) : openSheet(q.item.kana)));
      list.appendChild(row);
    }
    $('result-mistakes-card').hidden = mistakes.size === 0;
    $('btn-retry-wrong').hidden = mistakes.size === 0 || session.lesson || isWordMode(session.mode || '');
    $('btn-retry').hidden = session.lesson;
    $('btn-back').textContent = session.lesson ? '回首頁 🏠' : '回到設定';
    showView('result');
    if (asked) { confetti(); SFX.done(); }
  }

  $('btn-retry').addEventListener('click', () => startSession(session.pool, session.mode, session.count));
  $('btn-retry-wrong').addEventListener('click', () => {
    const pool = Array.from(session.mistakes.values(), (m) => m.q.item);
    startSession(pool, session.mode, 'round');
  });
  $('btn-back').addEventListener('click', () => {
    if (session.lesson) { renderHome(); showView('home'); } else showView('setup');
  });
  $('btn-start').addEventListener('click', () => startSession(currentPool(), settings.mode, settings.count));

  // ---------- 五十音表 ----------

  let chartScript = 'hira';
  document.querySelectorAll('input[name="chart-script"]').forEach((input) => {
    input.addEventListener('change', () => { chartScript = input.value; renderChart(); });
  });
  $('chart-show-stats').addEventListener('change', renderChart);

  function masteryClass(stat) {
    if (!stat || stat.c + stat.w === 0) return '';
    const rate = stat.c / (stat.c + stat.w);
    if (rate >= 0.9) return 'is-good';
    if (rate >= 0.7) return 'is-mid';
    return 'is-bad';
  }

  function renderChart() {
    const chart = $('chart');
    chart.textContent = '';
    const showStats = $('chart-show-stats').checked;

    for (const group of GROUPS) {
      const section = el('div', 'chart-group');
      section.appendChild(el('h3', null, group.label));
      const rows = ROWS.filter((r) => r.group === group.id);
      const grid = el('div', 'chart-grid chart-grid--' + rows[0].items.length);
      for (const row of rows) {
        for (const cell of row.items) {
          if (!cell) {
            grid.appendChild(el('div', 'chart-cell chart-cell--empty'));
            continue;
          }
          const kana = chartScript === 'kata' ? Kana.toKatakana(cell[0]) : cell[0];
          const romaji = cell[1].split('|')[0];
          const b = el('button', 'chart-cell');
          b.type = 'button';
          const stat = stats[kana];
          if (showStats) {
            const cls = masteryClass(stat);
            if (cls) b.classList.add(cls);
          }
          b.title = stat ? `答對 ${stat.c} 次，答錯 ${stat.w} 次` : '還沒練習過';
          const k = el('span', 'chart-kana', kana);
          k.lang = 'ja';
          b.appendChild(k);
          b.appendChild(el('span', 'chart-romaji', romaji));
          b.addEventListener('click', () => openSheet(kana));
          grid.appendChild(b);
        }
      }
      section.appendChild(grid);
      chart.appendChild(section);
    }
  }

  $('btn-reset-stats').addEventListener('click', () => {
    if (!confirm('確定要清除所有作答紀錄嗎？（文旦樹、貼紙和連續天數也會重新開始）')) return;
    stats = {};
    srs = {};
    daily.days = {};
    save(STATS_KEY, stats);
    save(SRS_KEY, srs);
    save(DAILY_KEY, daily);
    renderChart();
  });

  // ---------- 初始化 ----------

  renderRowPicker();
  updatePoolSize();
  updateCountHint();
  renderHome();
  showView('home');

  // answerKey 給自動化測試讀目前題目的正解用
  window.KanaApp = { speak, canSpeak, answerKey: () => (session && session.current && session.current.kind !== 'intro' ? currentKey() : null) };
})();
