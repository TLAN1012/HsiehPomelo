import { buildOrderEmail } from './order-email.js';

// 寄信失敗不影響已成立的訂單，也不自動重送不確定是否已接受的郵件。
export async function sendOrderEmail(env, order, settings, fetcher = fetch) {
  if (!env.GOOGLE_MAIL_URL || !env.POMELO_MAIL_SECRET) return 'not_configured';
  try {
    const url = new URL(env.GOOGLE_MAIL_URL);
    if (url.protocol !== 'https:' || url.hostname !== 'script.google.com' || !/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname)) return 'failed';
    const mail = buildOrderEmail(order, settings);
    const payload = JSON.stringify({ ...mail, code: order.code, timestamp: Date.now() });
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(env.POMELO_MAIL_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(payload))), b => b.toString(16).padStart(2, '0')).join('');
    const response = await fetcher(url.href, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ payload, signature }),
      signal: AbortSignal.timeout(20000),
      redirect: 'follow',
    });
    if (!response.ok) return 'failed';
    const result = await response.json();
    return result.ok === true && result.status === 'accepted' ? 'accepted' : 'failed';
  } catch {
    return 'failed';
  }
}
