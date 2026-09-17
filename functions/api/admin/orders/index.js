import { json, error, requireAdmin, orderView, STATUSES } from '../../../../src/lib.js';

export async function onRequestGet({ request, env }) {
  const denied = requireAdmin(request, env);
  if (denied) return denied;
  const url = new URL(request.url);
  const status = url.searchParams.get('status') || '';
  const q = (url.searchParams.get('q') || '').trim();

  let sql = 'SELECT * FROM orders';
  const where = [];
  const binds = [];
  if (status) {
    if (!STATUSES.includes(status)) return error('狀態不合法');
    where.push('status = ?');
    binds.push(status);
  }
  if (q) {
    where.push('(code LIKE ? OR phone LIKE ? OR name LIKE ? OR email LIKE ?)');
    binds.push(`%${q.toUpperCase()}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY created_at DESC LIMIT 500';

  const { results } = await env.DB.prepare(sql).bind(...binds).all();
  const summary = await env.DB.prepare(
    `SELECT status, COUNT(*) AS count, SUM(boxes) AS boxes, SUM(total) AS total
     FROM orders GROUP BY status`
  ).all();
  return json({ ok: true, orders: results.map(orderView), summary: summary.results });
}
