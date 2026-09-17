-- 設定表：以 key/value 存放價格、運費、庫存、匯款資訊等
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- 訂單表
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,          -- 查詢代碼，例如 HP-7K3M9Q
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  boxes INTEGER NOT NULL,
  unit_price INTEGER NOT NULL,        -- 下單當時的單價
  shipping_fee INTEGER NOT NULL,      -- 下單當時算出的運費總額
  total INTEGER NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending / paid / shipped / cancelled
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(phone);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- 初始設定
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('stock', '10'),
  ('unit_price', '800'),
  ('shipping_fee', '100'),
  ('shipping_mode', 'per_box'),      -- per_box：每箱計 / per_order：每單計
  ('order_open', '1'),               -- 1 開放訂購 / 0 暫停
  ('max_boxes_per_order', '10'),
  ('notice', ''),
  ('bank_name', '（請在管理頁填寫銀行名稱）'),
  ('bank_branch', ''),
  ('bank_account', '（請在管理頁填寫帳號）'),
  ('bank_holder', '（請在管理頁填寫戶名）');
