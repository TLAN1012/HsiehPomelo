import {
  json, error, readJson, getSettings, bankInfo, calcShipping,
  generateCode, normalizePhone, toInt, orderView,
} from '../../../src/lib.js';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  if (!body) return error('請求格式錯誤');

  const name = String(body.name || '').trim();
  const phone = normalizePhone(body.phone);
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return error('請填寫正確的 Email');
  }
  const address = String(body.address || '').trim();
  const note = String(body.note || '').trim().slice(0, 500);
  const boxes = toInt(body.boxes, 0);

  if (name.length < 1 || name.length > 50) return error('請填寫收件人姓名');
  if (!/^09\d{8}$/.test(phone) && !/^\+?\d{8,15}$/.test(phone)) return error('請填寫正確的聯絡電話');
  if (address.length < 6 || address.length > 200) return error('請填寫完整的收件地址');

  const s = await getSettings(env.DB);
  if (!s.order_open) return error('目前暫停接單，請稍後再試');
  if (boxes < 1) return error('至少需訂購 1 箱');
  if (boxes > s.max_boxes_per_order) return error(`每筆訂單最多 ${s.max_boxes_per_order} 箱`);
  if (boxes > s.stock) return error(`目前僅剩 ${s.stock} 箱可訂購`);

  const shipping = calcShipping(s, boxes);
  const total = s.unit_price * boxes + shipping;

  // 以 batch（單一交易）確保：庫存足夠才寫入訂單，並同步扣庫存
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const results = await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO orders (code, name, phone, email, address, boxes, unit_price, shipping_fee, total, note)
         SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
         WHERE (SELECT CAST(value AS INTEGER) FROM settings WHERE key = 'stock') >= ?
           AND (SELECT value FROM settings WHERE key = 'order_open') <> '0'`
      ).bind(code, name, phone, email, address, boxes, s.unit_price, shipping, total, note, boxes),
      env.DB.prepare(
        `UPDATE settings SET value = CAST(value AS INTEGER) - ?
         WHERE key = 'stock' AND EXISTS (SELECT 1 FROM orders WHERE code = ?)`
      ).bind(boxes, code),
    ]).catch((e) => {
      // 代碼碰撞（UNIQUE）時重試，其他錯誤往外丟
      if (String(e?.message || e).includes('UNIQUE')) return null;
      throw e;
    });

    if (results === null) continue; // 碰撞，換一組代碼

    if (results[0].meta.changes !== 1) {
      const fresh = await getSettings(env.DB);
      return error(fresh.stock > 0 ? `目前僅剩 ${fresh.stock} 箱可訂購` : '很抱歉，已經完售');
    }

    const row = await env.DB.prepare('SELECT * FROM orders WHERE code = ?').bind(code).first();
    return json({ ok: true, order: orderView(row), bank: bankInfo(s) }, 201);
  }

  return error('系統忙碌，請再試一次', 503);
}
