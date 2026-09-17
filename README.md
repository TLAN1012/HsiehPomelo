# 謝家老欉紅文旦 訂購網站

公開的紅文旦訂購網站，架在 Cloudflare Pages（靜態頁 + Pages Functions）與 D1 資料庫上。

正式網站：https://hsieh-pomelo.pages.dev/

管理後台：https://hsieh-pomelo.pages.dev/admin

正式資料庫已建立並綁定。日後更新只需在專案目錄執行 `npm ci`、`npm run deploy`；不必重新建立資料庫。管理密碼保存在 Cloudflare secret，不在 GitHub 程式碼中。

- 訂購頁 `/`：顯示目前可訂購箱數、單價與運費，填寫姓名／電話／Email／地址下單，完成後取得訂單代碼與匯款資訊。
- 查詢：在訂購頁下方輸入訂單代碼（`HP-XXXXXX`）或電話即可查詢訂單狀態。
- 管理後台 `/admin`：密碼登入後可調整庫存、單價、運費、接單狀態、公告、匯款資訊，並查看所有訂單、變更狀態（待匯款／已收款／已出貨／已取消）、匯出 CSV。

預設值：一箱十斤 800 元、運費每箱 100 元、初始庫存 10 箱。這些都可在管理後台修改。

## 專案結構

```
public/            靜態前端（index.html 訂購頁、admin.html 管理頁）
functions/api/     Pages Functions（API）
src/lib.js         API 共用工具
migrations/        D1 資料庫 schema
wrangler.toml      Cloudflare 設定
```

## 部署到 Cloudflare（第一次）

需要一個 Cloudflare 帳號與 Node.js 22 以上。

目前網站程式碼在 `claude/pomelo-sales-website-1mvnf4` 分支；若從 GitHub 下載，請先選擇這個分支。`main` 尚未包含網站程式碼。

```bash
npm install
npx wrangler login

# 1. 建立 D1 資料庫，並把輸出的 database_id 填進 wrangler.toml
npx wrangler d1 create hsieh-pomelo

# 2. 建立資料表與初始設定
npm run db:migrate:remote

# 3. 建立 Pages 專案
npx wrangler pages project create hsieh-pomelo --production-branch main

# 4. 設定管理後台密碼（只需一次，輸入時不會顯示）
npx wrangler pages secret put ADMIN_PASSWORD --project-name hsieh-pomelo

# 5. 發布正式網站
npm run deploy
```

部署完成後 wrangler 會印出網址（`https://hsieh-pomelo.pages.dev`）。之後每次改完程式再跑 `npm run deploy` 即可。

`npm run deploy` 已指定正式環境分支 `main`，因此從目前的開發分支執行也會發布正式網站。這不會自動合併 GitHub 分支。

也可以改用 Cloudflare Dashboard 連結這個 GitHub repo 自動部署：Workers & Pages → Create → Pages → Connect to Git，
Build output directory 填 `public`，然後在專案 Settings 裡綁定 D1（變數名稱 `DB`）並新增 secret `ADMIN_PASSWORD`。

## 本機開發

```bash
npm install
cp .dev.vars.example .dev.vars     # 改成你的管理密碼
npm run db:migrate:local           # 建立本機資料庫
npm run dev                        # http://localhost:8788
```

## 上線前記得

1. 到 `/admin` 填寫匯款資訊（銀行、帳號、戶名）。
2. 確認庫存箱數、運費計算方式（每箱或每單）。
3. 若要暫停接單，把「接單狀態」改為暫停即可，不需要下架網站。

## API 摘要

| 方法 | 路徑 | 說明 |
|---|---|---|
| GET | `/api/status` | 庫存、價格、運費、公告 |
| POST | `/api/orders` | 建立訂單（交易內扣庫存，庫存不足會拒絕） |
| GET | `/api/orders/lookup?q=` | 以代碼或電話查詢 |
| POST | `/api/admin/login` | 驗證密碼（`Authorization: Bearer <密碼>`） |
| GET / PUT | `/api/admin/settings` | 讀取／更新設定 |
| GET | `/api/admin/orders?status=&q=` | 訂單列表與統計 |
| PATCH / DELETE | `/api/admin/orders/:code` | 變更狀態（取消會退回庫存）／刪除 |

## Email 欄位更新

新訂單必填 Email，前後端均檢查格式，後台可查看、搜尋及匯出 Email。既有訂單保留，未填寫者顯示「未提供」。此欄位用於聯絡資料登記，目前不會自動寄信。

更新已有資料庫時，先執行 `npm run db:migrate:remote` 套用新增欄位，再執行 `npm run deploy`。
