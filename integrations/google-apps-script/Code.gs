/* 謝家紅文旦訂單確認信。部署為網頁應用程式，以「我」執行。 */
function doGet() {
  return reply_({ok: true, service: 'Hsieh Pomelo order confirmation'});
}
function reply_(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}
function doPost(e) {
  var lock;
  try {
    var raw = e && e.postData && e.postData.contents;
    if (!raw || raw.length > 50000) return reply_({ok: false, error: 'invalid_request'});
    var envelope = JSON.parse(raw);
    var secret = PropertiesService.getScriptProperties().getProperty('POMELO_MAIL_SECRET');
    if (!secret || secret.length < 32) return reply_({ok: false, error: 'not_configured'});
    if (typeof envelope.payload !== 'string' || typeof envelope.signature !== 'string') return reply_({ok: false, error: 'unauthorized'});
    var expected = Utilities.computeHmacSha256Signature(envelope.payload, secret, Utilities.Charset.UTF_8).map(function(b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
    var diff = expected.length ^ envelope.signature.length;
    for (var i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ (envelope.signature.charCodeAt(i) || 0);
    if (diff) return reply_({ok: false, error: 'unauthorized'});
    var mail = JSON.parse(envelope.payload);
    if (!Number.isFinite(mail.timestamp) || Math.abs(Date.now() - mail.timestamp) > 300000) return reply_({ok: false, error: 'expired_request'});
    if (!/^HP-[A-Z0-9]{6}$/.test(mail.code) || typeof mail.to !== 'string' || mail.to.length > 254 || !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(mail.to)) return reply_({ok: false, error: 'invalid_recipient'});
    if (typeof mail.subject !== 'string' || /[\r\n]/.test(mail.subject) || typeof mail.html !== 'string' || typeof mail.text !== 'string') return reply_({ok: false, error: 'invalid_message'});
    lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) return reply_({ok: false, error: 'busy'});
    var props = PropertiesService.getScriptProperties();
    var key = 'order_' + mail.code;
    var existing = props.getProperty(key);
    if (existing) return reply_({ok: existing.indexOf('accepted:') === 0, status: existing.indexOf('accepted:') === 0 ? 'accepted' : 'unknown'});
    if (MailApp.getRemainingDailyQuota() < 1) return reply_({ok: false, error: 'quota_exceeded'});
    // 僅記錄代碼、時間和狀態；不記錄收件人或信件內容。
    // 先記錄寄送中，避免 Google 在回應中斷時重複寄送。
    props.setProperty(key, 'sending:' + Date.now());
    MailApp.sendEmail({to: mail.to, subject: mail.subject, body: mail.text, htmlBody: mail.html, name: '謝家老欉紅文旦', replyTo: 'someoneelse1957@outlook.com'});
    props.setProperty(key, 'accepted:' + Date.now());
    // 保留 30 天防重複紀錄，控制 Script Properties 儲存量。
    var all = props.getProperties();
    Object.keys(all).forEach(function(k) {
      if (k.indexOf('order_') === 0 && Number(all[k].split(':')[1]) < Date.now() - 30 * 86400000) props.deleteProperty(k);
    });
    return reply_({ok: true, status: 'accepted'});
  } catch (_) {
    return reply_({ok: false, error: 'send_failed'});
  } finally {
    if (lock && lock.hasLock()) lock.releaseLock();
  }
}

// 在編輯器執行一次，以取得寄信授權；此函式不寄任何郵件。
function authorizeMail() {
  Logger.log('今日剩餘收件人額度：' + MailApp.getRemainingDailyQuota());
}
