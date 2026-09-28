/*
 * 單字閱讀：小朋友熟悉的單字，用表情符號提示意思。不依賴 DOM。
 * 只出「組成的假名都已經認識」的單字，讓孩子讀得懂、有成就感。
 */
(function (root) {
  'use strict';

  // [單字, 羅馬拼音, 中文, 表情符號]
  const WORDS = [
    // 平假名
    ['いぬ', 'inu', '狗', '🐶'], ['ねこ', 'neko', '貓', '🐱'], ['さかな', 'sakana', '魚', '🐟'],
    ['とり', 'tori', '鳥', '🐦'], ['うし', 'ushi', '牛', '🐮'], ['うま', 'uma', '馬', '🐴'],
    ['くま', 'kuma', '熊', '🐻'], ['さる', 'saru', '猴子', '🐵'], ['かめ', 'kame', '烏龜', '🐢'],
    ['て', 'te', '手', '✋'], ['あし', 'ashi', '腳', '🦶'], ['め', 'me', '眼睛', '👀'],
    ['みみ', 'mimi', '耳朵', '👂'], ['かお', 'kao', '臉', '🙂'], ['くち', 'kuchi', '嘴巴', '👄'],
    ['はな', 'hana', '花', '🌸'], ['き', 'ki', '樹', '🌳'], ['やま', 'yama', '山', '⛰️'],
    ['うみ', 'umi', '海', '🌊'], ['そら', 'sora', '天空', '☁️'], ['ほし', 'hoshi', '星星', '⭐'],
    ['つき', 'tsuki', '月亮', '🌙'], ['あめ', 'ame', '雨', '🌧️'], ['ゆき', 'yuki', '雪', '❄️'],
    ['いえ', 'ie', '家', '🏠'], ['かさ', 'kasa', '雨傘', '☂️'], ['くつ', 'kutsu', '鞋子', '👟'],
    ['すし', 'sushi', '壽司', '🍣'], ['もも', 'momo', '桃子', '🍑'], ['なし', 'nashi', '梨子', '🍐'],
    ['みず', 'mizu', '水', '💧'], ['ほん', 'hon', '書', '📖'], ['りんご', 'ringo', '蘋果', '🍎'],
    ['いちご', 'ichigo', '草莓', '🍓'], ['たまご', 'tamago', '蛋', '🥚'], ['くるま', 'kuruma', '車子', '🚗'],
    ['おにぎり', 'onigiri', '飯糰', '🍙'], ['でんしゃ', 'densha', '電車', '🚃'], ['あか', 'aka', '紅色', '🟥'],
    ['あお', 'ao', '藍色', '🟦'], ['ひ', 'hi', '火', '🔥'], ['は', 'ha', '牙齒', '🦷'],
    // 片假名（外來語）
    ['テレビ', 'terebi', '電視', '📺'], ['アイス', 'aisu', '冰淇淋', '🍦'], ['ケーキ', 'kēki', '蛋糕', '🍰'],
    ['バナナ', 'banana', '香蕉', '🍌'], ['パン', 'pan', '麵包', '🍞'], ['ピアノ', 'piano', '鋼琴', '🎹'],
    ['カメラ', 'kamera', '相機', '📷'], ['ノート', 'nōto', '筆記本', '📓'], ['ペン', 'pen', '筆', '🖊️'],
    ['バス', 'basu', '公車', '🚌'], ['タクシー', 'takushī', '計程車', '🚕'], ['ジュース', 'jūsu', '果汁', '🧃'],
    ['トマト', 'tomato', '番茄', '🍅'], ['メロン', 'meron', '哈密瓜', '🍈'], ['レモン', 'remon', '檸檬', '🍋'],
    ['ミルク', 'miruku', '牛奶', '🥛'], ['ボール', 'bōru', '球', '⚽'], ['ロボット', 'robotto', '機器人', '🤖'],
    ['ゲーム', 'gēmu', '遊戲', '🎮'], ['ライオン', 'raion', '獅子', '🦁'], ['パンダ', 'panda', '貓熊', '🐼'],
    ['コアラ', 'koara', '無尾熊', '🐨'], ['ペンギン', 'pengin', '企鵝', '🐧'], ['ホテル', 'hoteru', '飯店', '🏨'],
    ['ピザ', 'piza', '披薩', '🍕'], ['トイレ', 'toire', '廁所', '🚻'],
  ].map(([word, romaji, meaning, emoji]) => ({ word, romaji, meaning, emoji, key: 'w:' + word }));

  const SMALL = /[ゃゅょャュョ]/;
  const IGNORE = /[ーっッ]/;       // 長音與促音不算獨立的字

  // 拆成假名單位：拗音（き＋ゃ）算一個
  function units(word) {
    const out = [];
    for (const ch of word) {
      if (IGNORE.test(ch)) continue;
      if (SMALL.test(ch) && out.length) out[out.length - 1] += ch;
      else out.push(ch);
    }
    return out;
  }

  const isKata = (w) => /[ァ-ヺ]/.test(w.word);

  // known(kana) → 布林：這個假名是否已經認識
  function readable(known, script = 'both') {
    return WORDS.filter((w) => (script === 'both' || (script === 'kata') === isKata(w))
      && units(w.word).every(known));
  }

  const Words = { WORDS, units, isKata, readable };
  root.Words = Words;
  if (typeof module !== 'undefined' && module.exports) module.exports = Words;
})(typeof window !== 'undefined' ? window : globalThis);
