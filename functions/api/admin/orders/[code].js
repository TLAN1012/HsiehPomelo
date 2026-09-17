import { json, error, readJson, requireAdmin, orderView, STATUSES, normalizeCode } from '../../../../src/lib.js';

export async function onRequestPatch({ request, env, params }) {
  const denied = requireAdmin(request, env);
  if (denied) return denied;
  const code = normalizeCode(params.code);
  const body = await readJson(request);
  const status = body?.status;
  if (!STATUSES.includes(status)) return error('狀態不合法');

  const row = await env.DB.prepare('SELECT * FROM orders WHERE code = ?').bind(code).first();
  if (!row) return error('找不到訂單', 404);
  if (row.status === status) return json({ ok: true, order: orderView(row) });

  const stmts = [
    env.DB.prepare(`UPDATE orders SET status = ?, updated_at = datetime('now') WHERE code = ?`).bind(status, code),
  ];
  // 取消 → 退回庫存；從取消恢復 → 再扣庫存
  if (status === 'cancelled') {
    stmts.push(env.DB.prepare(`UPDATE settings SET value = CAST(value AS INTEGER) + ? WHERE key = 'stock'`).bind(row.boxes));
  } else if (row.status === 'cancelled') {
    stmts.push(env.DB.prepare(`UPDATE settings SET value = MAX(0, CAST(value AS INTEGER) - ?) WHERE key = 'stock'`).bind(row.boxes));
  }
  await env.DB.batch(stmts);

  const updated = await env.DB.prepare('SELECT * FROM orders WHERE code = ?').bind(code).first();
  return json({ ok: true, order: orderView(updated) });
}

export async function onRequestDelete({ request, env, params }) {
  const denied = requireAdmin(request, env);
  if (denied) return denied;
  const code = normalizeCode(params.code);
  const row = await env.DB.prepare('SELECT * FROM orders WHERE code = ?').bind(code).first();
  if (!row) return error('找不到訂單', 404);
  const stmts = [env.DB.prepare('DELETE FROM orders WHERE code = ?').bind(code)];
  if (row.status !== 'cancelled') {
    stmts.push(env.DB.prepare(`UPDATE settings SET value = CAST(value AS INTEGER) + ? WHERE key = 'stock'`).bind(row.boxes));
  }
  await env.DB.batch(stmts);
  return json({ ok: true });
}
