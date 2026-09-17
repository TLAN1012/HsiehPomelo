import { json, error, readJson, requireAdmin, getSettings, toInt } from '../../../src/lib.js';

const EDITABLE = {
  stock: (v) => { const n = toInt(v, NaN); return n >= 0 && n <= 100000 ? String(n) : null; },
  unit_price: (v) => { const n = toInt(v, NaN); return n >= 0 ? String(n) : null; },
  shipping_fee: (v) => { const n = toInt(v, NaN); return n >= 0 ? String(n) : null; },
  shipping_mode: (v) => (v === 'per_box' || v === 'per_order' ? v : null),
  order_open: (v) => (v === true || v === '1' || v === 1 ? '1' : '0'),
  max_boxes_per_order: (v) => { const n = toInt(v, NaN); return n >= 1 && n <= 1000 ? String(n) : null; },
  notice: (v) => String(v ?? '').slice(0, 1000),
  bank_name: (v) => String(v ?? '').slice(0, 100),
  bank_branch: (v) => String(v ?? '').slice(0, 100),
  bank_account: (v) => String(v ?? '').slice(0, 100),
  bank_holder: (v) => String(v ?? '').slice(0, 100),
};

export async function onRequestGet({ request, env }) {
  const denied = requireAdmin(request, env);
  if (denied) return denied;
  const s = await getSettings(env.DB);
  return json({ ok: true, settings: s });
}

export async function onRequestPut({ request, env }) {
  const denied = requireAdmin(request, env);
  if (denied) return denied;
  const body = await readJson(request);
  if (!body || typeof body !== 'object') return error('請求格式錯誤');

  const stmts = [];
  for (const [key, validate] of Object.entries(EDITABLE)) {
    if (!(key in body)) continue;
    const value = validate(body[key]);
    if (value === null) return error(`欄位 ${key} 的值不合法`);
    stmts.push(
      env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
        .bind(key, value)
    );
  }
  if (stmts.length) await env.DB.batch(stmts);
  const s = await getSettings(env.DB);
  return json({ ok: true, settings: s });
}
