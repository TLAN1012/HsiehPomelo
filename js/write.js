(function () {
  'use strict';

  const { ROWS, GROUPS, toKatakana, rowLabel } = Kana;
  const STROKES = window.KanaStrokes;
  const STATE_KEY = 'kana-drill:write';
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const SIZE = 109; // KanjiVG 座標系統

  const $ = (id) => document.getElementById(id);

  // 習字帖只收錄單一字母（不含拗音）
  const WRITE_ROWS = ROWS.filter((r) => r.group !== 'yoon');
  const SEQUENCE = [];
  for (const row of WRITE_ROWS) {
    for (const cell of row.items) {
      if (cell) SEQUENCE.push({ base: cell[0], romaji: cell[1].split('|')[0], row });
    }
  }

  const state = { script: 'hira', base: 'あ', guide: true, numbers: false, autoPlay: undefined, showOrigin: true };
  try {
    Object.assign(state, JSON.parse(localStorage.getItem(STATE_KEY) || '{}'));
  } catch (e) { /* 使用預設值 */ }
  // 舊版的「換字時自動唸出讀音」設定沿用為「自動播放」
  if (state.autoPlay === undefined) state.autoPlay = state.autoSpeak !== false;
  delete state.autoSpeak;
  if (!SEQUENCE.some((s) => s.base === state.base)) state.base = 'あ';

  function saveState() {
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch (e) { /* 無法儲存時忽略 */ }
  }

  const display = (base, script = state.script) => (script === 'kata' ? toKatakana(base) : base);
  const currentIndex = () => SEQUENCE.findIndex((s) => s.base === state.base);
  const current = () => SEQUENCE[currentIndex()];

  // ---------- SVG ----------

  function svgEl(tag, attrs, parent) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) node.setAttribute(k, v);
    if (parent) parent.appendChild(node);
    return node;
  }

  function drawGrid(svg, cls) {
    svgEl('line', { x1: SIZE / 2, y1: 0, x2: SIZE / 2, y2: SIZE, class: cls }, svg);
    svgEl('line', { x1: 0, y1: SIZE / 2, x2: SIZE, y2: SIZE / 2, class: cls }, svg);
  }

  function drawNumbers(svg, ch, cls) {
    STROKES[ch].n.forEach(([x, y], i) => {
      const t = svgEl('text', { x, y, class: cls }, svg);
      t.textContent = String(i + 1);
    });
  }

  function startPoint(d) {
    const m = /M\s*(-?[\d.]+)[ ,]+(-?[\d.]+)/.exec(d);
    return m ? [Number(m[1]), Number(m[2])] : null;
  }

  // ---------- 字母選擇 ----------

  function renderRowSelect() {
    const select = $('write-row');
    select.textContent = '';
    for (const group of GROUPS) {
      const rows = WRITE_ROWS.filter((r) => r.group === group.id);
      if (!rows.length) continue;
      const og = document.createElement('optgroup');
      og.label = group.label;
      for (const row of rows) {
        const opt = document.createElement('option');
        opt.value = row.id;
        opt.textContent = rowLabel(row, state.script);
        og.appendChild(opt);
      }
      select.appendChild(og);
    }
    select.value = current().row.id;
  }

  function renderCharButtons() {
    const wrap = $('write-chars');
    wrap.textContent = '';
    for (const item of SEQUENCE.filter((s) => s.row === current().row)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'write-char' + (item.base === state.base ? ' is-active' : '');
      b.lang = 'ja';
      b.textContent = display(item.base);
      b.addEventListener('click', () => select(item.base));
      wrap.appendChild(b);
    }
  }

  function select(base) {
    setBase(base);
    autoPlay();
  }

  function setBase(base) {
    state.base = base;
    saveState();
    render();
  }

  function step(delta) {
    const i = (currentIndex() + delta + SEQUENCE.length) % SEQUENCE.length;
    select(SEQUENCE[i].base);
  }

  // 換字時若開啟「自動播放」，就示範這個字（由使用者操作觸發，瀏覽器才允許發聲）
  function autoPlay() {
    if (state.autoPlay && !$('view-write').hidden) demonstrate();
  }

  // 示範：唸讀音、播放筆順、播完再唸一次，然後清掉示範讓你開始寫
  async function demonstrate() {
    const speak = () => window.KanaApp.speak(display(state.base));
    speak();
    const finished = await playStrokes({ autoClear: false });
    if (!finished) return;
    const token = animToken;
    speak();
    await new Promise((r) => setTimeout(r, 900));
    if (token !== animToken) return;
    $('pad-anim').textContent = '';
    clearInk();
  }

  // ---------- 範本與筆順 ----------

  function renderInfo() {
    const item = current();
    const ch = display(item.base);
    const origin = Kana.originOf(ch);
    $('write-kana').textContent = ch;
    $('write-origin-kanji').textContent = origin ? origin.kanji : '';
    $('write-origin').hidden = !origin || !state.showOrigin;
    $('write-origin').title = origin ? `${ch} 源自漢字「${origin.kanji}」${origin.note ? `（${origin.note}）` : ''}` : '';
    const note = origin && origin.note && state.showOrigin ? ` · ${origin.note}` : '';
    $('write-meta').textContent = `${item.romaji} · ${STROKES[ch].d.length} 畫${note}`;
  }

  // 例詞：漢字上方標注假名，詞裡的目標假名特別標色；按了才唸
  function renderWord() {
    const ch = display(state.base);
    const e = window.KanaExamples.exampleOf(ch);
    const text = $('write-word-text');
    text.textContent = '';
    $('write-word-meaning').textContent = '';
    const hasWord = Boolean(e && e.w);
    text.hidden = !hasWord;
    $('write-word-meaning').hidden = !hasWord;
    $('write-word-speak').hidden = !hasWord || !window.KanaApp.canSpeak;
    $('write-word').hidden = !e;
    $('write-word-note').textContent = (e && e.note) || '';
    $('write-word-note').hidden = !(e && e.note);
    if (!hasWord) return;

    const highlight = (str, parent) => {
      str.split(ch).forEach((part, i) => {
        if (i > 0) {
          const mark = document.createElement('mark');
          mark.className = 'word-hit';
          mark.textContent = ch;
          parent.appendChild(mark);
        }
        if (part) parent.appendChild(document.createTextNode(part));
      });
    };
    for (const [part, ruby] of e.w) {
      if (ruby) {
        const r = document.createElement('ruby');
        r.appendChild(document.createTextNode(part));
        const rt = document.createElement('rt');
        highlight(ruby, rt);
        r.appendChild(rt);
        text.appendChild(r);
      } else {
        highlight(part, text);
      }
    }
    const surface = e.w.map(([part]) => part).join('');
    const reading = window.KanaExamples.readingOf(e);
    const label = surface === reading ? surface : `${surface}（${reading}）`;
    text.setAttribute('aria-label', `例詞 ${label}，${e.m}。點一下聽讀音`);
    $('write-word-meaning').textContent = e.m;
  }

  function speakWord() {
    const e = window.KanaExamples.exampleOf(display(state.base));
    const reading = window.KanaExamples.readingOf(e);
    if (reading) window.KanaApp.speak(reading);
  }

  function renderSteps() {
    const ch = display(state.base);
    const wrap = $('stroke-steps');
    wrap.textContent = '';
    const strokes = STROKES[ch].d;
    strokes.forEach((_, i) => {
      const cell = document.createElement('div');
      cell.className = 'stroke-step';
      const svg = svgEl('svg', { viewBox: `0 0 ${SIZE} ${SIZE}`, 'aria-hidden': 'true' });
      drawGrid(svg, 'g-line');
      for (let j = 0; j <= i; j++) {
        svgEl('path', { d: strokes[j], class: j === i ? 's-current' : 's-done' }, svg);
      }
      const start = startPoint(strokes[i]);
      if (start) svgEl('circle', { cx: start[0], cy: start[1], r: 4.5, class: 's-start' }, svg);
      cell.appendChild(svg);
      const label = document.createElement('span');
      label.textContent = String(i + 1);
      cell.appendChild(label);
      wrap.appendChild(cell);
    });
  }

  let animToken = 0;

  function renderGuide() {
    animToken++;
    const ch = display(state.base);
    const svg = $('pad-guide');
    svg.textContent = '';
    drawGrid(svg, 'g-line');
    if (state.guide) {
      for (const d of STROKES[ch].d) svgEl('path', { d, class: 'g-stroke' }, svg);
    }
    if (state.numbers) drawNumbers(svg, ch, 'g-num');
    svgEl('g', { id: 'pad-anim' }, svg);
  }

  // 播放完畢回傳 true；中途被換字、重播或開始書寫打斷則回傳 false
  async function playStrokes({ autoClear = true } = {}) {
    const token = ++animToken;
    const ch = display(state.base);
    const layer = $('pad-anim');
    layer.textContent = '';
    for (const d of STROKES[ch].d) {
      if (token !== animToken) return false;
      const path = svgEl('path', { d, class: 'g-anim' }, layer);
      const len = path.getTotalLength();
      path.style.strokeDasharray = `${len}`;
      path.style.strokeDashoffset = `${len}`;
      const anim = path.animate(
        [{ strokeDashoffset: len }, { strokeDashoffset: 0 }],
        { duration: 250 + len * 9, easing: 'ease-in-out', fill: 'forwards' }
      );
      try {
        await anim.finished;
      } catch (e) {
        return false;
      }
      await new Promise((r) => setTimeout(r, 180));
    }
    if (token !== animToken) return false;
    if (autoClear) setTimeout(() => { if (token === animToken) layer.textContent = ''; }, 1200);
    return true;
  }

  // 開始書寫時停止筆順示範，避免示範結束時清掉剛寫的字
  function stopDemo() {
    animToken++;
    const layer = $('pad-anim');
    if (layer) layer.textContent = '';
  }

  // ---------- 手寫板 ----------

  const canvas = $('pad-canvas');
  const ctx = canvas.getContext('2d');
  let ink = []; // 每一筆是 [x, y] 陣列，座標為 0–1
  let drawing = null;
  let padSize = 0;

  function setupCanvas() {
    const size = $('pad').clientWidth;
    if (!size) return;
    const dpr = window.devicePixelRatio || 1;
    padSize = size;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    redraw();
  }

  function redraw() {
    ctx.clearRect(0, 0, padSize, padSize);
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#222';
    ctx.lineWidth = Math.max(4, padSize * 0.042);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const stroke of ink) {
      const pts = stroke.map(([x, y]) => [x * padSize, y * padSize]);
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      if (pts.length === 1) {
        ctx.lineTo(pts[0][0] + 0.01, pts[0][1]);
      } else {
        // 以中點做二次曲線，讓筆跡平滑
        for (let i = 1; i < pts.length - 1; i++) {
          const mx = (pts[i][0] + pts[i + 1][0]) / 2;
          const my = (pts[i][1] + pts[i + 1][1]) / 2;
          ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
        }
        const last = pts[pts.length - 1];
        ctx.lineTo(last[0], last[1]);
      }
      ctx.stroke();
    }
  }

  function pointFrom(e) {
    const rect = canvas.getBoundingClientRect();
    return [(e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height];
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    stopDemo();
    canvas.setPointerCapture(e.pointerId);
    drawing = { id: e.pointerId, points: [pointFrom(e)] };
    ink.push(drawing.points);
    redraw();
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!drawing || e.pointerId !== drawing.id) return;
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of events.length ? events : [e]) drawing.points.push(pointFrom(ev));
    redraw();
  });

  const endStroke = (e) => {
    if (drawing && e.pointerId === drawing.id) drawing = null;
  };
  canvas.addEventListener('pointerup', endStroke);
  canvas.addEventListener('pointercancel', endStroke);

  function clearInk() {
    ink = [];
    drawing = null;
    redraw();
  }

  if (window.ResizeObserver) new ResizeObserver(setupCanvas).observe($('pad'));
  window.addEventListener('resize', setupCanvas);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', redraw);

  // ---------- 列印 ----------

  function printChars(scope) {
    const item = current();
    let list;
    if (scope === 'char') list = [item];
    else if (scope === 'row') list = SEQUENCE.filter((s) => s.row === item.row);
    else list = SEQUENCE.filter((s) => s.row.group === scope);
    return list.map((s) => display(s.base));
  }

  function scopeTitle(scope) {
    const script = state.script === 'kata' ? '片假名' : '平假名';
    const item = current();
    const titles = {
      char: display(item.base),
      row: rowLabel(item.row, state.script),
      seion: '清音',
      dakuon: '濁音・半濁音',
    };
    return `${script}習字帖・${titles[scope]}`;
  }

  const PRINT_BOXES = 10;
  const TRACE_BOXES = 3;

  function buildPrintSheet(scope) {
    const sheet = $('print-sheet');
    sheet.textContent = '';
    const head = document.createElement('div');
    head.className = 'ps-head';
    const h = document.createElement('h1');
    h.textContent = scopeTitle(scope);
    head.appendChild(h);
    const fields = document.createElement('div');
    fields.className = 'ps-fields';
    fields.textContent = '姓名＿＿＿＿＿＿＿＿　日期＿＿＿＿＿＿';
    head.appendChild(fields);
    sheet.appendChild(head);

    for (const ch of printChars(scope)) {
      const row = document.createElement('div');
      row.className = 'ps-row';
      for (let i = 0; i < PRINT_BOXES; i++) {
        const svg = svgEl('svg', { viewBox: `0 0 ${SIZE} ${SIZE}`, class: 'ps-box' });
        drawGrid(svg, 'ps-line');
        if (i === 0) {
          for (const d of STROKES[ch].d) svgEl('path', { d, class: 'ps-model' }, svg);
          drawNumbers(svg, ch, 'ps-num');
          const origin = Kana.originOf(ch);
          if (origin) svgEl('text', { x: SIZE - 4, y: SIZE - 5, class: 'ps-origin' }, svg).textContent = origin.kanji;
        } else if (i <= TRACE_BOXES) {
          for (const d of STROKES[ch].d) svgEl('path', { d, class: 'ps-trace' }, svg);
        }
        row.appendChild(svg);
      }
      sheet.appendChild(row);
    }
    const credit = document.createElement('p');
    credit.className = 'ps-credit';
    credit.textContent = '筆順資料：KanjiVG（kanjivg.tagaini.net，CC BY-SA 3.0）';
    sheet.appendChild(credit);
  }

  // ---------- 事件 ----------

  document.querySelectorAll('input[name="write-script"]').forEach((input) => {
    input.checked = input.value === state.script;
    input.addEventListener('change', () => {
      state.script = input.value;
      saveState();
      renderRowSelect();
      render();
      autoPlay();
    });
  });

  $('write-row').addEventListener('change', (e) => {
    const first = SEQUENCE.find((s) => s.row.id === e.target.value);
    if (first) select(first.base);
  });

  $('write-guide').checked = state.guide;
  $('write-guide').addEventListener('change', (e) => {
    state.guide = e.target.checked;
    saveState();
    renderGuide();
  });
  $('write-show-origin').checked = state.showOrigin;
  $('write-show-origin').addEventListener('change', (e) => {
    state.showOrigin = e.target.checked;
    saveState();
    renderInfo();
  });
  $('write-numbers').checked = state.numbers;
  $('write-autoplay').checked = state.autoPlay;
  $('write-autoplay').addEventListener('change', (e) => {
    state.autoPlay = e.target.checked;
    saveState();
    if (!state.autoPlay) stopDemo();
  });
  $('write-numbers').addEventListener('change', (e) => {
    state.numbers = e.target.checked;
    saveState();
    renderGuide();
  });

  $('write-prev').addEventListener('click', () => step(-1));
  $('write-next').addEventListener('click', () => step(1));
  $('write-play').addEventListener('click', () => playStrokes());
  $('write-clear').addEventListener('click', clearInk);
  $('write-undo').addEventListener('click', () => {
    ink.pop();
    redraw();
  });
  $('write-speak').hidden = !window.KanaApp.canSpeak;
  $('write-speak').addEventListener('click', () => window.KanaApp.speak(display(state.base)));
  $('write-word-text').addEventListener('click', speakWord);
  $('write-word-speak').addEventListener('click', speakWord);

  $('btn-print').addEventListener('click', () => {
    buildPrintSheet($('print-scope').value);
    window.print();
  });

  document.addEventListener('keydown', (e) => {
    if ($('view-write').hidden || e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'ArrowRight') step(1);
    else return;
    e.preventDefault();
  });

  function render() {
    $('write-row').value = current().row.id;
    renderCharButtons();
    renderInfo();
    renderWord();
    renderSteps();
    renderGuide();
    clearInk();
  }

  renderRowSelect();
  render();

  window.KanaWrite = {
    show() {
      setupCanvas();
      autoPlay();
    },
  };
})();
