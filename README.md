# HsiehPomelo — 假名練習

日文平假名、片假名字母練習程式。純 HTML／CSS／JavaScript，不需要安裝任何套件。

## 使用方式

直接用瀏覽器開啟 `index.html` 即可。或者啟動本機伺服器：

```sh
npm start   # 等同 python3 -m http.server 8000，再開啟 http://localhost:8000
```

線上版（GitHub Pages）：https://tlan1012.github.io/HsiehPomelo/

每次推送到 `main`，`.github/workflows/pages.yml` 會先跑測試，再自動部署到 GitHub Pages。
第一次使用前需要到 repo 的 **Settings → Pages**，把 **Source** 設為 **GitHub Actions**。

## 功能

- **文字**：平假名、片假名，或兩者混合
- **練習範圍**：依「行」勾選，包含清音、濁音・半濁音、拗音
- **三種題型**
  - 看假名，輸入羅馬拼音（接受 shi/si、tsu/tu、fu/hu、ji/zi、n/nn 等常見寫法）
  - 看假名，選羅馬拼音
  - 看羅馬拼音，選假名（會優先放入字形相似的干擾項，例如 シ／ツ、ソ／ン、ぬ／め）
- **題數**：10／20／50 題、每字一輪（答錯的字會再出現直到答對），或不限
- **加權出題**：常答錯或還沒練過的字會比較常出現
- **發音**：使用瀏覽器內建的語音合成唸出讀音（需系統有日文語音）
- **習字帖**
  - 播放筆順動畫，並逐筆顯示筆順（紅色為目前這一筆，圓點為起筆處）
  - 用手指、觸控筆或滑鼠在十字格上描寫，可切換描紅範本與筆畫編號，支援復原與清除
  - 列印 A4 習字帖：每個字一行，含筆順範本、描紅格與空白練習格
- **五十音表**：點字母聽讀音，並用顏色標示你每個字的答對率
- 作答紀錄與設定存在瀏覽器的 localStorage

鍵盤操作：輸入題按 Enter 送出、再按 Enter 下一題；選擇題可按 1–4 作答。

## 開發

```sh
npm test    # 以 Node 內建測試執行 test/*.test.js
```

- `js/kana.js`：假名資料與出題邏輯（不依賴 DOM）
- `js/app.js`：畫面與互動
- `js/write.js`：習字帖（手寫板、筆順動畫、列印）
- `js/strokes.js`：筆順資料，由 `node scripts/build-strokes.js` 從 KanjiVG 產生
- `css/style.css`：樣式（支援深色模式）

## 授權與資料來源

筆順資料取自 [KanjiVG](https://kanjivg.tagaini.net)（Copyright © 2009–2011 Ulrich Apel），
依 [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) 授權使用；`js/strokes.js` 亦以相同授權釋出。
