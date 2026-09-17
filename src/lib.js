// 共用工具：回應格式、設定讀取、訂單代碼、驗證

export const STATUSES = ['pending', 'paid', 'shipped', 'cancelled'];

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extraHeaders,
    },
  });
}

export function error(message, status = 400) {
  return json({ ok: false, error: message }, status);
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function getSettings(db) {
  const { results } = await db.prepare('SELECT key, value FROM settings').all();
  const s = {};
  for (const row of results) s[row.key] = row.value;
  return {
    stock: toInt(s.stock, 0),
    unit_price: toInt(s.unit_price, 800),
    shipping_fee: toInt(s.shipping_fee, 100),
    shipping_mode: s.shipping_mode === 'per_order' ? 'per_order' : 'per_box',
    order_open: s.order_open !== '0',
    max_boxes_per_order: toInt(s.max_boxes_per_order, 10),
    notice: s.notice || '',
    bank_name: s.bank_name || '',
    bank_branch: s.bank_branch || '',
    bank_account: s.bank_account || '',
    bank_holder: s.bank_holder || '',
  };
}

export function publicSettings(s) {
  return {
    stock: s.stock,
    unit_price: s.unit_price,
    shipping_fee: s.shipping_fee,
    shipping_mode: s.shipping_mode,
    order_open: s.order_open,
    max_boxes_per_order: s.max_boxes_per_order,
    notice: s.notice,
  };
}

export function bankInfo(s) {
  return {
    bank_name: s.bank_name,
    bank_branch: s.bank_branch,
    bank_account: s.bank_account,
    bank_holder: s.bank_holder,
  };
}

export function calcShipping(s, boxes) {
  return s.shipping_mode === 'per_order' ? s.shipping_fee : s.shipping_fee * boxes;
}

export function toInt(v, fallback) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

// 產生不易混淆的訂單代碼：HP-XXXXXX（去掉 0/O/1/I）
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function generateCode() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += CODE_CHARS[b % CODE_CHARS.length];
  return `HP-${out}`;
}

export function normalizePhone(phone) {
  return String(phone || '').replace(/[^\d+]/g, '');
}

export function normalizeCode(code) {
  const c = String(code || '').trim().toUpperCase().replace(/\s/g, '');
  return c.startsWith('HP-') ? c : c.startsWith('HP') ? `HP-${c.slice(2)}` : `HP-${c}`;
}

export function looksLikeCode(q) {
  return /^(HP-?)?[A-Z0-9]{6}$/i.test(String(q || '').trim());
}

// 管理端驗證：Authorization: Bearer <ADMIN_PASSWORD>
export function isAdmin(request, env) {
  const expected = env.ADMIN_PASSWORD;
  if (!expected) return false;
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  return safeEqual(token, expected);
}

function safeEqual(a, b) {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

export function requireAdmin(request, env) {
  if (!env.ADMIN_PASSWORD) return error('尚未設定 ADMIN_PASSWORD', 500);
  if (!isAdmin(request, env)) return error('未授權', 401);
  return null;
}

export function orderView(row) {
  return {
    code: row.code,
    name: row.name,
    phone: row.phone,
    address: row.address,
    boxes: row.boxes,
    unit_price: row.unit_price,
    shipping_fee: row.shipping_fee,
    total: row.total,
    note: row.note || '',
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
