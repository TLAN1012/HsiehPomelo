/*
 * 數字 1–20 的日文讀法與「數字」分頁。
 * 資料部分不依賴 DOM，可在 Node 中測試。
 */
(function (root) {
  'use strict';

  // [漢字, 主要讀法, 羅馬拼音, 其他讀法, 其他讀法的羅馬拼音]
  const DIGITS = [
    null,
    ['一', 'いち', 'ichi'],
    ['二', 'に', 'ni'],
    ['三', 'さん', 'san'],
    ['四', 'よん', 'yon', 'し', 'shi'],
    ['五', 'ご', 'go'],
    ['六', 'ろく', 'roku'],
    ['七', 'なな', 'nana', 'しち', 'shichi'],
    ['八', 'はち', 'hachi'],
    ['九', 'きゅう', 'kyū', 'く', 'ku'],
  ];

  function build(n) {
    let kanji, kana, romaji, altKana = '', altRomaji = '';
    if (n < 10) {
      [kanji, kana, romaji, altKana = '', altRomaji = ''] = DIGITS[n];
    } else {
      const tens = Math.floor(n / 10);
      const ones = n % 10;
      const t = tens === 1 ? { kanji: '十', kana: 'じゅう', romaji: 'jū' }
        : { kanji: DIGITS[tens][0] + '十', kana: DIGITS[tens][1] + 'じゅう', romaji: DIGITS[tens][2] + 'jū' };
      kanji = t.kanji;
      kana = t.kana;
      romaji = t.romaji;
      if (ones) {
        const [k, r, ro, ak, aro] = DIGITS[ones];
        kanji += k;
        kana += r;
        romaji += ro;
        if (ak) {
          altKana = t.kana + ak;
          altRomaji = t.romaji + aro;
        }
      }
    }
    return { n, kanji, kana, romaji, altKana, altRomaji };
  }

  const NUMBERS = [];
  for (let n = 1; n <= 20; n++) NUMBERS.push(build(n));

  root.KanaNumbers = NUMBERS;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = NUMBERS;
    return;
  }

  // ---------- 畫面 ----------

  const $ = (id) => document.getElementById(id);
  const STATE_KEY = 'kana-drill:numbers';
  let selected = 1;
  try {
    selected = Number(localStorage.getItem(STATE_KEY)) || 1;
  } catch (e) { /* 使用預設值 */ }
  if (selected < 1 || selected > NUMBERS.length) selected = 1;

  let quiz = null; // { answer, tries }

  const speak = (text) => window.KanaApp.speak(text);

  function renderDetail() {
    const it = NUMBERS[selected - 1];
    $('num-digit').textContent = String(it.n);
    $('num-kanji').textContent = it.kanji;
    $('num-kana').textContent = it.kana;
    $('num-romaji').textContent = it.romaji;
    const alt = $('num-alt');
    alt.hidden = !it.altKana;
    if (it.altKana) {
      $('num-alt-kana').textContent = it.altKana;
      $('num-alt-romaji').textContent = it.altRomaji;
    }
  }

  function renderGrid() {
    const grid = $('num-grid');
    grid.textContent = '';
    for (const it of NUMBERS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'num-cell' + (!quiz && it.n === selected ? ' is-active' : '');
      b.dataset.n = String(it.n);
      const digit = document.createElement('span');
      digit.className = 'num-cell-digit';
      digit.textContent = String(it.n);
      const kanji = document.createElement('span');
      kanji.className = 'num-cell-kanji';
      kanji.lang = 'ja';
      kanji.textContent = it.kanji;
      b.append(digit, kanji);
      b.addEventListener('click', () => (quiz ? answerQuiz(it.n, b) : select(it.n)));
      grid.appendChild(b);
    }
  }

  function select(n) {
    selected = n;
    try {
      localStorage.setItem(STATE_KEY, String(n));
    } catch (e) { /* 無法儲存時忽略 */ }
    renderDetail();
    renderGrid();
    speak(NUMBERS[n - 1].kana);
  }

  // ---------- 聽音測驗 ----------

  function setQuizUi(on) {
    $('num-detail').hidden = on;
    $('num-quiz').hidden = !on;
    $('num-quiz-start').textContent = on ? '結束測驗' : '🎧 聽音測驗';
  }

  function nextQuiz() {
    let n;
    do {
      n = 1 + Math.floor(Math.random() * NUMBERS.length);
    } while (quiz && n === quiz.answer);
    quiz = { answer: n, tries: 0, score: quiz ? quiz.score : 0, total: quiz ? quiz.total : 0 };
    $('num-quiz-feedback').textContent = '聽到的是哪個數字？';
    $('num-quiz-feedback').className = 'num-quiz-feedback';
    renderGrid();
    speak(NUMBERS[n - 1].kana);
  }

  function answerQuiz(n, button) {
    if (quiz.done) return;
    const it = NUMBERS[quiz.answer - 1];
    const fb = $('num-quiz-feedback');
    if (n === quiz.answer) {
      if (quiz.tries === 0) quiz.score++;
      quiz.total++;
      quiz.done = true;
      button.classList.add('is-correct');
      fb.textContent = `✓ 正確！${it.n} = ${it.kana}（${it.romaji}）`;
      fb.className = 'num-quiz-feedback is-correct';
      $('num-quiz-score').textContent = `一次答對 ${quiz.score} / ${quiz.total}`;
      setTimeout(() => { if (quiz && quiz.done) nextQuiz(); }, 1300);
    } else {
      quiz.tries++;
      button.classList.add('is-wrong');
      button.disabled = true;
      fb.textContent = '✗ 再聽一次試試看';
      fb.className = 'num-quiz-feedback is-wrong';
      speak(it.kana);
    }
  }

  $('num-speak').addEventListener('click', () => speak(NUMBERS[selected - 1].kana));
  $('num-alt-speak').addEventListener('click', () => speak(NUMBERS[selected - 1].altKana));
  $('num-quiz-replay').addEventListener('click', () => quiz && speak(NUMBERS[quiz.answer - 1].kana));
  $('num-quiz-start').addEventListener('click', () => {
    if (quiz) {
      quiz = null;
      setQuizUi(false);
      renderGrid();
    } else {
      setQuizUi(true);
      $('num-quiz-score').textContent = '一次答對 0 / 0';
      nextQuiz();
    }
  });
  if (!window.KanaApp.canSpeak) {
    $('num-quiz-start').hidden = true;
    $('num-speak').hidden = true;
    $('num-alt-speak').hidden = true;
  }

  renderDetail();
  renderGrid();

  window.KanaNumbersView = {
    show() {
      if (!quiz) speak(NUMBERS[selected - 1].kana);
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
