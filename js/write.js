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

  const state = { script: 'hira', base: 'あ', guide: true, numbers: false, autoSpeak: true };
  try {
    Object.assign(state, JSON.parse(localStorage.getItem(STATE_KEY) || '{}'));
  } catch (e) { /* 使用預設值 */ }
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
    state.base = base;
    saveState();
    render();
    speakCurrent();
  }

  // 換字時自動唸出讀音（由使用者操作觸發，瀏覽器才允許發聲）
  function speakCurrent() {
    if (state.autoSpeak && !$('view-write').hidden) window.KanaApp.speak(display(state.base));
  }

  function step(delta) {
    const i = (currentIndex() + delta + SEQUENCE.length) % SEQUENCE.length;
    select(SEQUENCE[i].base);
  }

  // ---------- 範本與筆順 ----------

  function renderInfo() {
    const item = current();
    const ch = display(item.base);
    $('write-kana').textContent = ch;
    $('write-meta').textContent = `${item.romaji} · ${STROKES[ch].d.length} 畫`;
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

  async function playStrokes() {
    const token = ++animToken;
    const ch = display(state.base);
    const layer = $('pad-anim');
    layer.textContent = '';
    for (const d of STROKES[ch].d) {
      if (token !== animToken) return;
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
        return;
      }
      await new Promise((r) => setTimeout(r, 180));
    }
    if (token === animToken) {
      setTimeout(() => { if (token === animToken) layer.textContent = ''; }, 1200);
    }
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
      speakCurrent();
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
  $('write-numbers').checked = state.numbers;
  $('write-autospeak').checked = state.autoSpeak;
  $('write-autospeak').addEventListener('change', (e) => {
    state.autoSpeak = e.target.checked;
    saveState();
    speakCurrent();
  });
  $('write-numbers').addEventListener('change', (e) => {
    state.numbers = e.target.checked;
    saveState();
    renderGuide();
  });

  $('write-prev').addEventListener('click', () => step(-1));
  $('write-next').addEventListener('click', () => step(1));
  $('write-play').addEventListener('click', playStrokes);
  $('write-clear').addEventListener('click', clearInk);
  $('write-undo').addEventListener('click', () => {
    ink.pop();
    redraw();
  });
  $('write-speak').hidden = !window.KanaApp.canSpeak;
  if (!window.KanaApp.canSpeak) $('write-autospeak').closest('label').hidden = true;
  $('write-speak').addEventListener('click', () => window.KanaApp.speak(display(state.base)));

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
    renderSteps();
    renderGuide();
    clearInk();
  }

  renderRowSelect();
  render();

  window.KanaWrite = {
    show() {
      setupCanvas();
      speakCurrent();
    },
  };
})();
