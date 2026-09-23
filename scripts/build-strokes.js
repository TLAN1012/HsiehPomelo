#!/usr/bin/env node
/*
 * 從 KanjiVG（https://kanjivg.tagaini.net，CC BY-SA 3.0）產生 js/strokes.js。
 *
 *   node scripts/build-strokes.js [SVG 快取目錄]
 *
 * 快取目錄中缺少的 SVG 會用 curl 從 jsDelivr 下載。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Kana = require('../js/kana.js');

const cacheDir = process.argv[2] || path.join(require('os').tmpdir(), 'kanjivg-cache');
const outFile = path.join(__dirname, '..', 'js', 'strokes.js');
const BASE_URL = 'https://cdn.jsdelivr.net/gh/KanjiVG/kanjivg@master/kanji/';

// 習字帖只練單一字母（拗音由兩個字母組成，不另外收錄）
const chars = [...new Set(Kana.ALL_ITEMS.filter((it) => it.group !== 'yoon').map((it) => it.kana))];

fs.mkdirSync(cacheDir, { recursive: true });

const round = (s) => s.replace(/-?\d+\.\d+/g, (n) => String(Math.round(parseFloat(n) * 10) / 10));

const data = {};
for (const ch of chars) {
  const code = ch.codePointAt(0).toString(16).padStart(5, '0');
  const file = path.join(cacheDir, code + '.svg');
  if (!fs.existsSync(file)) {
    execFileSync('curl', ['-sSf', '-o', file, BASE_URL + code + '.svg']);
  }
  const svg = fs.readFileSync(file, 'utf8');

  const strokes = [...svg.matchAll(/<path id="kvg:[0-9a-f]+-s(\d+)"[^>]*\sd="([^"]+)"/g)]
    .sort((a, b) => Number(a[1]) - Number(b[1]))
    .map((m) => round(m[2]));
  const numbers = [...svg.matchAll(/<text transform="matrix\(1 0 0 1 ([\d.]+) ([\d.]+)\)">(\d+)<\/text>/g)]
    .sort((a, b) => Number(a[3]) - Number(b[3]))
    .map((m) => [Number(m[1]), Number(m[2])]);

  if (strokes.length === 0 || strokes.length !== numbers.length) {
    throw new Error(`${ch} (${code})：筆畫 ${strokes.length}、編號 ${numbers.length} 不一致`);
  }
  data[ch] = { d: strokes, n: numbers };
}

const header = `/*
 * 假名筆順資料，由 scripts/build-strokes.js 自動產生，請勿手動修改。
 *
 * 資料來源：KanjiVG（https://kanjivg.tagaini.net）
 * Copyright (C) 2009-2011 Ulrich Apel
 * 依 Creative Commons 姓名標示-相同方式分享 3.0 授權（CC BY-SA 3.0）
 * https://creativecommons.org/licenses/by-sa/3.0/
 *
 * 座標系統為 109×109。d：各筆畫的 SVG path；n：各筆畫編號的位置。
 */
`;
const body = Object.entries(data)
  .map(([ch, v]) => `  ${JSON.stringify(ch)}: ${JSON.stringify(v)},`)
  .join('\n');
const js = `${header}(function (root) {
  'use strict';
  const STROKES = {
${body}
  };
  root.KanaStrokes = STROKES;
  if (typeof module !== 'undefined' && module.exports) module.exports = STROKES;
})(typeof window !== 'undefined' ? window : globalThis);
`;
fs.writeFileSync(outFile, js);
console.log(`已寫入 ${path.relative(process.cwd(), outFile)}：${chars.length} 個字，${(js.length / 1024).toFixed(1)} KB`);
