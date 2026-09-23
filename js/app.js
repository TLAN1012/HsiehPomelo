(function () {
  'use strict';

  const { GROUPS, ROWS, SCRIPTS } = Kana;
  const SETTINGS_KEY = 'kana-drill:settings';
  const STATS_KEY = 'kana-drill:stats';

  const $ = (id) => document.getElementById(id);
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };

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

  function recordResult(item, correct) {
    const s = stats[item.kana] || { c: 0, w: 0 };
    if (correct) s.c++; else s.w++;
    s.last = correct ? 1 : 0;
    stats[item.kana] = s;
    save(STATS_KEY, stats);
  }

  // ---------- 發音 ----------

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

  // ---------- 畫面切換 ----------

  const VIEWS = ['setup', 'quiz', 'result', 'write', 'chart'];
  const PRACTICE_VIEWS = ['setup', 'quiz', 'result'];
  let practiceView = 'setup';

  function showView(name) {
    for (const v of VIEWS) $('view-' + v).hidden = v !== name;
    if (PRACTICE_VIEWS.includes(name)) practiceView = name;
    const tab = PRACTICE_VIEWS.includes(name) ? 'setup' : name;
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('is-active', t.dataset.view === tab));
    window.scrollTo(0, 0);
  }

  document.querySelectorAll('.tab').forEach((t) => {
    t.addEventListener('click', () => {
      if (t.dataset.view === 'chart') {
        renderChart();
        showView('chart');
      } else if (t.dataset.view === 'write') {
        showView('write');
        window.KanaWrite.show();
      } else {
        showView(practiceView);
      }
    });
  });

  // ---------- 設定畫面 ----------

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
  bindRadios('mode', 'mode');
  bindRadios('count', 'count', updateCountHint);

  $('opt-speak').checked = settings.speak;
  $('opt-speak').addEventListener('change', (e) => {
    settings.speak = e.target.checked;
    save(SETTINGS_KEY, settings);
  });
  if (!canSpeak) $('opt-speak').closest('label').hidden = true;

  function updateCountHint() {
    const hints = {
      round: '範圍內每個字各出一次，答錯的字會在最後再出現，直到全部答對為止。',
      endless: '一直出題，按「結束練習」停止。',
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
    // 維持 ROWS 的順序
    settings.rows = ROWS.map((r) => r.id).filter((id) => selected.has(id));
    save(SETTINGS_KEY, settings);
    renderRowPicker();
    updatePoolSize();
  }

  function currentPool() {
    return Kana.buildPool(settings.script, settings.rows);
  }

  function updatePoolSize() {
    const n = currentPool().length;
    $('pool-size').textContent = n ? `共 ${n} 個字` : '請至少選一行';
    $('btn-start').disabled = n === 0;
  }

  // ---------- 練習 ----------

  let session = null;

  function startSession(pool, mode, count) {
    session = {
      pool,
      mode,
      count,
      queue: count === 'round' ? Kana.shuffle(pool) : null,
      asked: 0,
      correct: 0,
      mistakes: new Map(),
      recent: [],
      current: null,
      choices: null,
      answered: false,
      startTime: Date.now(),
    };
    showView('quiz');
    nextQuestion();
  }

  function sessionTotal() {
    if (session.count === 'endless') return null;
    if (session.count === 'round') {
      // 目前這題已從佇列取出，作答前要算進總數
      const pending = session.current && !session.answered ? 1 : 0;
      return session.asked + session.queue.length + pending;
    }
    return Number(session.count);
  }

  function nextQuestion() {
    const total = sessionTotal();
    if (total !== null && session.asked >= total) {
      finishSession();
      return;
    }

    let item;
    if (session.count === 'round') {
      item = session.queue.shift();
    } else {
      item = Kana.pickWeighted(session.pool, stats, session.recent);
    }
    const memory = Math.min(3, session.pool.length - 1);
    session.recent = memory > 0 ? session.recent.concat(item.kana).slice(-memory) : [];

    session.current = item;
    session.answered = false;
    session.choices = session.mode === 'type' ? null : Kana.makeChoices(item, session.pool, 4);
    renderQuestion();
  }

  function renderQuestion() {
    const { current: item, mode } = session;
    const total = sessionTotal();
    const n = session.asked + 1;

    $('quiz-progress-text').textContent = total === null ? `第 ${n} 題` : `第 ${n} / ${total} 題`;
    $('quiz-score').textContent = `答對 ${session.correct} / ${session.asked}`;
    $('quiz-progress').style.width = total === null ? '0' : `${(session.asked / total) * 100}%`;
    $('quiz-progress').parentElement.hidden = total === null;

    const prompt = $('prompt');
    prompt.className = 'prompt';
    if (mode === 'pick-kana') {
      prompt.textContent = item.romaji[0];
      prompt.lang = 'en';
      prompt.classList.add('prompt--romaji');
      $('prompt-tag').textContent = `選出對應的${SCRIPTS[item.script]}`;
    } else {
      prompt.textContent = item.kana;
      prompt.lang = 'ja';
      $('prompt-tag').textContent = SCRIPTS[item.script];
    }

    $('feedback').textContent = '';
    $('feedback').className = 'feedback';
    $('btn-next').hidden = true;
    $('btn-speak').hidden = true;

    const form = $('type-form');
    const input = $('type-input');
    const choices = $('choices');
    form.hidden = mode !== 'type';
    choices.hidden = mode === 'type';
    choices.textContent = '';

    if (mode === 'type') {
      input.value = '';
      input.disabled = false;
      input.className = '';
      $('btn-check').textContent = '確認';
      input.focus();
    } else {
      session.choices.forEach((choice, i) => {
        const b = el('button', 'choice');
        b.type = 'button';
        b.dataset.kana = choice.kana;
        b.appendChild(el('span', 'choice-key', String(i + 1)));
        const label = el('span', 'choice-label', mode === 'pick-kana' ? choice.kana : choice.romaji[0]);
        label.lang = mode === 'pick-kana' ? 'ja' : 'en';
        if (mode === 'pick-kana') b.classList.add('choice--kana');
        b.appendChild(label);
        b.addEventListener('click', () => answerChoice(choice, b));
        choices.appendChild(b);
      });
      if (document.activeElement) document.activeElement.blur();
    }
  }

  function answerChoice(choice, button) {
    if (session.answered) return;
    const correct = choice.kana === session.current.kana;
    for (const b of $('choices').children) {
      b.disabled = true;
      if (b.dataset.kana === session.current.kana) b.classList.add('is-correct');
    }
    if (!correct) button.classList.add('is-wrong');
    const given = session.mode === 'pick-kana' ? choice.kana : choice.romaji[0];
    settle(correct, given);
    $('btn-next').focus();
  }

  function answerTyped() {
    const input = $('type-input');
    const value = input.value.trim();
    if (!value) return;
    const correct = Kana.checkAnswer(session.current, value);
    input.disabled = true;
    input.className = correct ? 'is-correct' : 'is-wrong';
    settle(correct, value);
    $('btn-check').textContent = '下一題';
    // disabled 的輸入框會失去焦點，改由按鈕接收 Enter
    $('btn-check').focus();
  }

  function settle(correct, given) {
    const item = session.current;
    session.answered = true;
    session.asked++;
    if (correct) {
      session.correct++;
    } else {
      const m = session.mistakes.get(item.kana) || { item, answers: [] };
      m.answers.push(given);
      session.mistakes.set(item.kana, m);
      // 每字一輪：答錯的字排到最後再考一次
      if (session.queue && !session.queue.includes(item)) session.queue.push(item);
    }
    recordResult(item, correct);

    const fb = $('feedback');
    fb.textContent = '';
    fb.className = 'feedback ' + (correct ? 'is-correct' : 'is-wrong');
    fb.appendChild(el('span', 'feedback-mark', correct ? '✓ 正確' : '✗ 答錯了'));
    const pair = el('span', 'feedback-pair');
    const kana = el('span', 'feedback-kana', item.kana);
    kana.lang = 'ja';
    pair.appendChild(kana);
    pair.appendChild(document.createTextNode(' = ' + item.romaji[0]));
    fb.appendChild(pair);
    if (item.romaji.length > 1) {
      fb.appendChild(el('span', 'feedback-note', `也可寫作 ${item.romaji.slice(1).join('、')}`));
    }
    if (!correct && session.mode === 'type') {
      fb.appendChild(el('span', 'feedback-note', `你的答案：${given}`));
    }

    $('quiz-score').textContent = `答對 ${session.correct} / ${session.asked}`;
    const total = sessionTotal();
    if (total !== null) $('quiz-progress').style.width = `${(session.asked / total) * 100}%`;

    $('btn-speak').hidden = !canSpeak;
    $('btn-next').hidden = session.mode === 'type';
    if (settings.speak) speak(item.kana);
  }

  $('type-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (session.answered) nextQuestion();
    else answerTyped();
  });
  $('btn-next').addEventListener('click', nextQuestion);
  $('btn-speak').addEventListener('click', () => speak(session.current.kana));
  $('btn-quit').addEventListener('click', () => {
    if (session.asked === 0) showView('setup');
    else finishSession();
  });

  document.addEventListener('keydown', (e) => {
    if ($('view-quiz').hidden || !session || session.mode === 'type') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
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

  function finishSession() {
    const { asked, correct, mistakes } = session;
    const pct = asked ? Math.round((correct / asked) * 100) : 0;
    $('result-score').textContent = `${pct}%`;
    $('result-detail').textContent = `答對 ${correct} / ${asked} 題 · 用時 ${formatDuration(Date.now() - session.startTime)}`;

    const list = $('result-mistakes');
    list.textContent = '';
    for (const { item, answers } of mistakes.values()) {
      const row = el('div', 'mistake');
      const k = el('span', 'mistake-kana', item.kana);
      k.lang = 'ja';
      row.appendChild(k);
      row.appendChild(el('span', 'mistake-romaji', item.romaji[0]));
      row.appendChild(el('span', 'mistake-given', '你答：' + answers.join('、')));
      row.addEventListener('click', () => speak(item.kana));
      list.appendChild(row);
    }
    $('result-mistakes-card').hidden = mistakes.size === 0;
    $('btn-retry-wrong').hidden = mistakes.size === 0;
    showView('result');
  }

  $('btn-retry').addEventListener('click', () => startSession(session.pool, session.mode, session.count));
  $('btn-retry-wrong').addEventListener('click', () => {
    const pool = Array.from(session.mistakes.values(), (m) => m.item);
    startSession(pool, session.mode, 'round');
  });
  $('btn-back').addEventListener('click', () => showView('setup'));
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
          b.addEventListener('click', () => speak(kana));
          grid.appendChild(b);
        }
      }
      section.appendChild(grid);
      chart.appendChild(section);
    }
  }

  $('btn-reset-stats').addEventListener('click', () => {
    if (!confirm('確定要清除所有作答紀錄嗎？')) return;
    stats = {};
    save(STATS_KEY, stats);
    renderChart();
  });

  // ---------- 初始化 ----------

  renderRowPicker();
  updatePoolSize();
  updateCountHint();

  window.KanaApp = { speak, canSpeak };
})();
