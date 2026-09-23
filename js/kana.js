/*
 * 假名資料與出題邏輯（不依賴 DOM，可在瀏覽器與 Node 中使用）。
 * 羅馬拼音以 "|" 分隔多種可接受寫法，第一個為標準寫法（平文式）。
 */
(function (root) {
  'use strict';

  const GROUPS = [
    { id: 'seion', label: '清音' },
    { id: 'dakuon', label: '濁音・半濁音' },
    { id: 'yoon', label: '拗音' },
  ];

  // null 代表五十音表中的空格，只用於排版
  const ROWS = [
    { id: 'a', group: 'seion', items: [['あ', 'a'], ['い', 'i'], ['う', 'u'], ['え', 'e'], ['お', 'o']] },
    { id: 'ka', group: 'seion', items: [['か', 'ka'], ['き', 'ki'], ['く', 'ku'], ['け', 'ke'], ['こ', 'ko']] },
    { id: 'sa', group: 'seion', items: [['さ', 'sa'], ['し', 'shi|si'], ['す', 'su'], ['せ', 'se'], ['そ', 'so']] },
    { id: 'ta', group: 'seion', items: [['た', 'ta'], ['ち', 'chi|ti'], ['つ', 'tsu|tu'], ['て', 'te'], ['と', 'to']] },
    { id: 'na', group: 'seion', items: [['な', 'na'], ['に', 'ni'], ['ぬ', 'nu'], ['ね', 'ne'], ['の', 'no']] },
    { id: 'ha', group: 'seion', items: [['は', 'ha'], ['ひ', 'hi'], ['ふ', 'fu|hu'], ['へ', 'he'], ['ほ', 'ho']] },
    { id: 'ma', group: 'seion', items: [['ま', 'ma'], ['み', 'mi'], ['む', 'mu'], ['め', 'me'], ['も', 'mo']] },
    { id: 'ya', group: 'seion', items: [['や', 'ya'], null, ['ゆ', 'yu'], null, ['よ', 'yo']] },
    { id: 'ra', group: 'seion', items: [['ら', 'ra'], ['り', 'ri'], ['る', 'ru'], ['れ', 're'], ['ろ', 'ro']] },
    { id: 'wa', group: 'seion', items: [['わ', 'wa'], null, null, null, ['を', 'wo|o']] },
    { id: 'n', group: 'seion', items: [['ん', "n|nn|n'"], null, null, null, null] },

    { id: 'ga', group: 'dakuon', items: [['が', 'ga'], ['ぎ', 'gi'], ['ぐ', 'gu'], ['げ', 'ge'], ['ご', 'go']] },
    { id: 'za', group: 'dakuon', items: [['ざ', 'za'], ['じ', 'ji|zi'], ['ず', 'zu'], ['ぜ', 'ze'], ['ぞ', 'zo']] },
    { id: 'da', group: 'dakuon', items: [['だ', 'da'], ['ぢ', 'ji|di'], ['づ', 'zu|du'], ['で', 'de'], ['ど', 'do']] },
    { id: 'ba', group: 'dakuon', items: [['ば', 'ba'], ['び', 'bi'], ['ぶ', 'bu'], ['べ', 'be'], ['ぼ', 'bo']] },
    { id: 'pa', group: 'dakuon', items: [['ぱ', 'pa'], ['ぴ', 'pi'], ['ぷ', 'pu'], ['ぺ', 'pe'], ['ぽ', 'po']] },

    { id: 'kya', group: 'yoon', items: [['きゃ', 'kya'], ['きゅ', 'kyu'], ['きょ', 'kyo']] },
    { id: 'sha', group: 'yoon', items: [['しゃ', 'sha|sya'], ['しゅ', 'shu|syu'], ['しょ', 'sho|syo']] },
    { id: 'cha', group: 'yoon', items: [['ちゃ', 'cha|tya|cya'], ['ちゅ', 'chu|tyu|cyu'], ['ちょ', 'cho|tyo|cyo']] },
    { id: 'nya', group: 'yoon', items: [['にゃ', 'nya'], ['にゅ', 'nyu'], ['にょ', 'nyo']] },
    { id: 'hya', group: 'yoon', items: [['ひゃ', 'hya'], ['ひゅ', 'hyu'], ['ひょ', 'hyo']] },
    { id: 'mya', group: 'yoon', items: [['みゃ', 'mya'], ['みゅ', 'myu'], ['みょ', 'myo']] },
    { id: 'rya', group: 'yoon', items: [['りゃ', 'rya'], ['りゅ', 'ryu'], ['りょ', 'ryo']] },
    { id: 'gya', group: 'yoon', items: [['ぎゃ', 'gya'], ['ぎゅ', 'gyu'], ['ぎょ', 'gyo']] },
    { id: 'ja', group: 'yoon', items: [['じゃ', 'ja|zya|jya'], ['じゅ', 'ju|zyu|jyu'], ['じょ', 'jo|zyo|jyo']] },
    { id: 'bya', group: 'yoon', items: [['びゃ', 'bya'], ['びゅ', 'byu'], ['びょ', 'byo']] },
    { id: 'pya', group: 'yoon', items: [['ぴゃ', 'pya'], ['ぴゅ', 'pyu'], ['ぴょ', 'pyo']] },
  ];

  // 字形容易混淆的組合，用來產生較有鑑別度的選項
  const CONFUSABLE_GROUPS = [
    'ぬめ', 'るろ', 'われね', 'はほけ', 'さちき', 'いり', 'こに', 'うらつ', 'しつ', 'あおめ', 'まも', 'すむ',
    'シツ', 'ソン', 'シン', 'ツソ', 'クケタ', 'ウワフラ', 'ノメヌ', 'コユヨ', 'チテ', 'アマ', 'セサ', 'ルレ', 'トヘ', 'ロコ',
  ];

  const SCRIPTS = { hira: '平假名', kata: '片假名' };

  function toKatakana(str) {
    return str.replace(/[ぁ-ゖ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60));
  }

  function rowLabel(row, script) {
    const head = row.items[0][0] + '行';
    return script === 'kata' ? toKatakana(head) : head;
  }

  // 所有字母（依文字種類展開），每個元素：{ kana, romaji[], row, rowLabel, group, script, base }
  const ALL_ITEMS = [];
  for (const script of Object.keys(SCRIPTS)) {
    for (const row of ROWS) {
      for (const cell of row.items) {
        if (!cell) continue;
        ALL_ITEMS.push({
          kana: script === 'kata' ? toKatakana(cell[0]) : cell[0],
          romaji: cell[1].split('|'),
          row: row.id,
          rowLabel: rowLabel(row, script),
          group: row.group,
          script,
          base: cell[0],
        });
      }
    }
  }

  const CONFUSABLES = {};
  for (const group of CONFUSABLE_GROUPS) {
    for (const ch of group) {
      CONFUSABLES[ch] = CONFUSABLES[ch] || new Set();
      for (const other of group) if (other !== ch) CONFUSABLES[ch].add(other);
    }
  }

  function normalizeRomaji(input) {
    return String(input).toLowerCase().replace(/[\s　]/g, '').replace(/[’`]/g, "'");
  }

  function checkAnswer(item, input) {
    return item.romaji.includes(normalizeRomaji(input));
  }

  function shareRomaji(a, b) {
    return a.romaji.some((r) => b.romaji.includes(r));
  }

  // scriptMode: 'hira' | 'kata' | 'both'；rowIds: 要練習的行
  function buildPool(scriptMode, rowIds) {
    const rows = new Set(rowIds);
    return ALL_ITEMS.filter((it) => rows.has(it.row) && (scriptMode === 'both' || it.script === scriptMode));
  }

  function shuffle(arr, rand = Math.random) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // 依作答紀錄計算權重：沒練過或常錯的字比較常出現
  function itemWeight(stat) {
    if (!stat) return 3;
    const errRate = (stat.w + 1) / (stat.c + stat.w + 2);
    return 1 + 4 * errRate + (stat.last === 0 ? 2 : 0);
  }

  // recent: 最近出過的題目（避免連續重複）
  function pickWeighted(pool, stats, recent = [], rand = Math.random) {
    let candidates = pool.filter((it) => !recent.includes(it.kana));
    if (candidates.length === 0) candidates = pool;
    const weights = candidates.map((it) => itemWeight(stats[it.kana]));
    let r = rand() * weights.reduce((s, w) => s + w, 0);
    for (let i = 0; i < candidates.length; i++) {
      r -= weights[i];
      if (r < 0) return candidates[i];
    }
    return candidates[candidates.length - 1];
  }

  // 產生 n 個選項（含正解），選項與正解同為平假名或片假名，且不會有同音的干擾項
  function makeChoices(answer, pool, n = 4, rand = Math.random) {
    const valid = (it) => it.script === answer.script && it.kana !== answer.kana && !shareRomaji(it, answer);
    const seen = new Set();
    const uniq = (list) => list.filter((it) => !seen.has(it.kana) && seen.add(it.kana));

    let candidates = uniq(pool.filter(valid));
    if (candidates.length < n - 1) {
      // 練習範圍太小時，從同一組別（再不夠就從全部）補選項
      candidates = candidates.concat(uniq(shuffle(ALL_ITEMS.filter((it) => valid(it) && it.group === answer.group), rand)));
      candidates = candidates.concat(uniq(shuffle(ALL_ITEMS.filter(valid), rand)));
    }

    const confusable = CONFUSABLES[answer.kana] || new Set();
    const similar = shuffle(candidates.filter((it) => confusable.has(it.kana)), rand).slice(0, 2);
    const rest = shuffle(candidates.filter((it) => !similar.includes(it)), rand);
    const distractors = similar.concat(rest).slice(0, n - 1);
    return shuffle([answer].concat(distractors), rand);
  }

  const Kana = {
    GROUPS, ROWS, SCRIPTS, ALL_ITEMS,
    toKatakana, rowLabel, normalizeRomaji, checkAnswer, shareRomaji,
    buildPool, shuffle, itemWeight, pickWeighted, makeChoices,
  };

  root.Kana = Kana;
  if (typeof module !== 'undefined' && module.exports) module.exports = Kana;
})(typeof window !== 'undefined' ? window : globalThis);
