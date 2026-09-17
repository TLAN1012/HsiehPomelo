-- 舊訂單保留，新訂單由 API 強制要求 Email。
ALTER TABLE orders ADD COLUMN email TEXT NOT NULL DEFAULT '';
