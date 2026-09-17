import {
  json, error, getSettings, bankInfo, normalizePhone, normalizeCode, looksLikeCode, orderView,
} from '../../../src/lib.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim();
  if (!q) return error('請輸入訂單代碼或電話');

  let rows;
  if (looksLikeCode(q)) {
    const code = normalizeCode(q);
    rows = (await env.DB.prepare('SELECT * FROM orders WHERE code = ?').bind(code).all()).results;
  } else {
    const phone = normalizePhone(q);
    if (phone.length < 8) return error('請輸入正確的訂單代碼或電話');
    rows = (await env.DB.prepare(
      'SELECT * FROM orders WHERE phone = ? ORDER BY created_at DESC LIMIT 20'
    ).bind(phone).all()).results;
  }

  const s = await getSettings(env.DB);
  return json({ ok: true, orders: rows.map(orderView), bank: bankInfo(s) });
}
