// 與寄信服務無關的訂單確認信；僅在訂單成功保存後使用。
const SITE_URL = 'https://hsieh-pomelo.pages.dev/';
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));
const money = value => `NT$${Number(value).toLocaleString('zh-TW')}`;

export function buildOrderEmail(order, settings = {}) {
  const lookup = new URL(SITE_URL);
  lookup.searchParams.set('q', order.code);
  const rows = [
    ['訂單代碼', order.code], ['商品', '謝家老欉紅文旦（每箱 10 斤）'],
    ['數量', `${order.boxes} 箱`], ['單價', money(order.unit_price)],
    ['運費', money(order.shipping_fee)], ['合計', money(order.total)],
  ];
  // 不寄出預設的「請在管理頁填寫」提示，也不在確認信重複傳送地址與備註。
  const bankReady = ['bank_name', 'bank_account', 'bank_holder'].every(key =>
    typeof settings[key] === 'string' && settings[key].trim() && !settings[key].includes('請在管理頁'));
  const bankRows = bankReady ? [
    ['銀行', settings.bank_name], ['分行', settings.bank_branch],
    ['帳號', settings.bank_account], ['戶名', settings.bank_holder],
  ].filter(([, value]) => value) : [];
  const paymentNote = bankReady
    ? '如尚未付款，請依下列資訊匯款，並於備註填寫訂單代碼。付款將由我們人工確認。'
    : '付款與出貨資訊請以後續聯絡及訂單查詢頁面為準。';
  const footer = '這封信代表訂購登記已收到，不代表已收款或已出貨。請保留訂單代碼以便查詢。';
  const lines = list => list.map(([label, value]) => `${label}：${value}`).join('\n');
  const table = list => `<table role="presentation" style="width:100%;border-collapse:collapse">${list.map(([label,value]) => `<tr><td style="padding:10px 0;color:#697269;border-bottom:1px solid #dedfd3">${escapeHtml(label)}</td><td style="padding:10px 0;text-align:right;border-bottom:1px solid #dedfd3">${escapeHtml(value)}</td></tr>`).join('')}</table>`;
  return {
    to: order.email,
    subject: `謝家紅文旦｜訂購登記確認 ${order.code}`,
    text: `謝謝您的訂購！您的登記已收到。\n\n${lines(rows)}\n\n${paymentNote}\n${bankReady ? lines(bankRows) + '\n' : ''}\n查詢訂單：${lookup.href}\n\n${footer}\n\n謝家老欉紅文旦`,
    html: `<!doctype html><html lang="zh-Hant-TW"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:24px 12px;background:#f8f7f1;color:#263e32;font-family:Arial,'Microsoft JhengHei',sans-serif;line-height:1.7"><div style="max-width:560px;margin:auto;padding:28px;background:white;border:1px solid #dedfd3;border-radius:16px"><p style="letter-spacing:3px;color:#697269">謝家老欉紅文旦</p><h1 style="font-size:25px">訂購登記已收到</h1><p>謝謝您的訂購！以下是您的訂購明細：</p>${table(rows)}<p>${escapeHtml(paymentNote)}</p>${bankReady ? table(bankRows) : ''}<p style="margin:28px 0"><a href="${escapeHtml(lookup.href)}" style="display:inline-block;background:#335943;color:white;text-decoration:none;padding:12px 24px;border-radius:6px">查看訂單進度</a></p><p style="font-size:13px;color:#697269">${footer}</p></div></body></html>`,
  };
}
