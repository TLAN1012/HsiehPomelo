# Gmail 訂單確認信

必須完成 Google 授權及網站 secrets 設定才能自動寄信。確認信由 `MailApp` 發送，不讀取 Gmail 郵件。

## 一次性設定

1. 用預定的寄件 Gmail 登入 https://script.google.com/home/start，建立新專案「謝家紅文旦訂單確認信」。
2. 將 `Code.gs` 貼入編輯器。
3. 在專案設定 → 指令碼屬性，新增 `POMELO_MAIL_SECRET`，值為至少 32 字元的隨機密鑰。相同密鑰須設定至 Cloudflare Pages secret；不要提交 GitHub。
4. 選取 `authorizeMail` 函式，執行並授權寄信。此步驟不會寄出郵件。
5. 部署 → 新增部署 → 網頁應用程式：執行身分為「我」，存取者為「所有人」。請求必須通過 HMAC 簽章、5 分鐘時效及收件人檢查，公開網址本身無法直接用來寄信。
6. 複製結尾為 `/exec` 的部署網址，在 Cloudflare 設定 `GOOGLE_MAIL_URL` secret。設定 `POMELO_MAIL_SECRET` secret 後重新部署網站。
7. 先用擁有者本人信箱建立測試訂單，確認實際收到信，再清除測試訂單。

回覆地址預設 `someoneelse1957@outlook.com`，可在 `Code.gs` 調整。寄件名稱為「謝家老欉紅文旦」，實際寄件地址為授權部署的 Google 帳號。

網站只在新訂單保存成功後寄信，不補寄歷史訂單。服務未設定或失敗不影響訂單成立。未能確認成功時不自動重試，避免重複寄信；客人可保留代碼查詢。Google 端保留 30 天的訂單代碼防重複紀錄，不存信件內容。

Google 接受寄送不代表對方收件匣一定收到，仍可能被退信或進垃圾郵件。個人 Google 帳號的 Apps Script 額度目前為每日 100 位收件人，和同帳號其他指令碼共用；以 Google 官方文件為準。

官方文件：
- https://developers.google.com/apps-script/guides/web
- https://developers.google.com/apps-script/reference/mail/mail-app
- https://developers.google.com/apps-script/guides/services/quotas
