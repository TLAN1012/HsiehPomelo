(() => {
  const $ = (id) => document.getElementById(id);
  const money = (n) => 'NT$' + Number(n).toLocaleString('zh-Hant-TW');
  const STATUS_LABEL = { pending: '待匯款', paid: '已收款', shipped: '已出貨', cancelled: '已取消' };

  let settings = null;

  async function api(path, opts = {}) {
    const res = await fetch(path, { headers: { 'content-type': 'application/json' }, ...opts });
    const data = await res.json().catch(() => ({ ok: false, error: '伺服器回應異常' }));
    if (!res.ok || !data.ok) throw new Error(data.error || '發生錯誤');
    return data;
  }

  function showMsg(el, text, kind) {
    el.textContent = text || '';
    el.className = 'msg' + (text ? ' ' + kind : '');
  }

  function shippingFor(boxes) {
    if (!settings) return 0;
    return settings.shipping_mode === 'per_order' ? settings.shipping_fee : settings.shipping_fee * boxes;
  }

  function clampBoxes() {
    const input = $('boxes');
    let n = parseInt(input.value, 10);
    if (!Number.isFinite(n) || n < 1) n = 1;
    if (settings) {
      const max = Math.min(settings.max_boxes_per_order, Math.max(settings.stock, 1));
      if (n > max) n = max;
    }
    input.value = n;
    return n;
  }

  function updateSummary() {
    const n = clampBoxes();
    const unit = settings ? settings.unit_price : 800;
    const ship = shippingFor(n);
    $('sum-boxes').textContent = n;
    $('sum-unit').textContent = unit;
    $('sum-goods').textContent = money(unit * n);
    $('sum-ship').textContent = money(ship);
    $('sum-total').textContent = money(unit * n + ship);
  }

  function renderStatus() {
    const s = settings;
    $('stock-num').textContent = s.stock;
    $('stock').classList.toggle('soldout', s.stock <= 0);
    $('unit-price').textContent = money(s.unit_price);
    $('shipping-fee').textContent = money(s.shipping_fee);
    $('shipping-mode').textContent = s.shipping_mode === 'per_order' ? '/ 每筆訂單' : '/ 箱';
    const notice = $('notice');
    notice.textContent = s.notice || '';
    notice.classList.toggle('hidden', !s.notice);

    const closed = !s.order_open || s.stock <= 0;
    $('submit-btn').disabled = closed;
    if (!s.order_open) showMsg($('order-msg'), '目前暫停接單，請稍後再來。', 'err');
    else if (s.stock <= 0) showMsg($('order-msg'), '本季已完售，感謝支持！', 'err');
    else showMsg($('order-msg'), '', '');
    updateSummary();
  }

  async function loadStatus() {
    try {
      settings = await api('/api/status');
      renderStatus();
    } catch (e) {
      $('stock-num').textContent = '—';
      showMsg($('order-msg'), '無法取得目前庫存：' + e.message, 'err');
    }
  }

  function bankDl(bank) {
    const rows = [['銀行', bank.bank_name], ['分行', bank.bank_branch], ['帳號', bank.bank_account], ['戶名', bank.bank_holder]];
    return rows.filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('');
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function orderHtml(o) {
    return `<div class="order">
      <div class="head"><span class="code">${esc(o.code)}</span><span class="badge ${esc(o.status)}">${STATUS_LABEL[o.status] || o.status}</span></div>
      <div class="grid">
        <span>收件人</span><span>${esc(o.name)}</span>
        <span>電話</span><span>${esc(o.phone)}</span>
        <span>Email</span><span>${esc(o.email || "未提供")}</span>
        <span>地址</span><span>${esc(o.address)}</span>
        <span>數量</span><span>${o.boxes} 箱 × ${money(o.unit_price)}</span>
        <span>運費</span><span>${money(o.shipping_fee)}</span>
        <span>合計</span><span><b>${money(o.total)}</b></span>
        ${o.note ? `<span>備註</span><span>${esc(o.note)}</span>` : ''}
        <span>下單時間</span><span>${esc(fmtTime(o.created_at))}</span>
      </div>
    </div>`;
  }

  function fmtTime(iso) {
    // D1 datetime('now') 為 UTC，轉成台灣時間顯示
    const d = new Date(iso.replace(' ', 'T') + 'Z');
    return isNaN(d) ? iso : d.toLocaleString('zh-Hant-TW', { timeZone: 'Asia/Taipei', hour12: false });
  }

  // 訂購表單
  $('qty-minus').addEventListener('click', () => { $('boxes').value = parseInt($('boxes').value || 1, 10) - 1; updateSummary(); });
  $('qty-plus').addEventListener('click', () => { $('boxes').value = parseInt($('boxes').value || 1, 10) + 1; updateSummary(); });
  $('boxes').addEventListener('input', updateSummary);

  $('order-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const btn = $('submit-btn');
    const payload = {
      name: $('name').value.trim(),
      phone: $('phone').value.trim(),
      email: $('email').value.trim(),
      address: $('address').value.trim(),
      boxes: clampBoxes(),
      note: $('note').value.trim(),
    };
    if (!payload.email || payload.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) return showMsg($('order-msg'), '請填寫正確的 Email', 'err');
    if (!payload.name) return showMsg($('order-msg'), '請填寫收件人姓名', 'err');
    if (!/^[\d+\-\s()]{8,}$/.test(payload.phone)) return showMsg($('order-msg'), '請填寫正確的聯絡電話', 'err');
    if (payload.address.length < 6) return showMsg($('order-msg'), '請填寫完整的收件地址', 'err');

    btn.disabled = true; btn.textContent = '送出中…';
    try {
      const data = await api('/api/orders', { method: 'POST', body: JSON.stringify(payload) });
      $('done-code').textContent = data.order.code;
      $('done-detail').innerHTML = orderHtml(data.order);
      $('done-bank').innerHTML = bankDl(data.bank);
      $('order-card').classList.add('hidden');
      $('done-card').classList.remove('hidden');
      $('done-card').scrollIntoView({ behavior: 'smooth' });
      $('order-form').reset();
      $('boxes').value = 1;
      await loadStatus();
    } catch (e) {
      await loadStatus();
      showMsg($('order-msg'), e.message, 'err');
    } finally {
      btn.textContent = '送出訂單';
      btn.disabled = settings ? (!settings.order_open || settings.stock <= 0) : false;
    }
  });

  $('done-again').addEventListener('click', () => {
    $('done-card').classList.add('hidden');
    $('order-card').classList.remove('hidden');
    $('order-card').scrollIntoView({ behavior: 'smooth' });
  });

  // 查詢
  $('lookup-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const q = $('lookup-q').value.trim();
    const box = $('lookup-results');
    box.innerHTML = '';
    if (!q) return showMsg($('lookup-msg'), '請輸入訂單代碼或電話', 'err');
    showMsg($('lookup-msg'), '查詢中…', 'ok');
    try {
      const data = await api('/api/orders/lookup?q=' + encodeURIComponent(q));
      if (!data.orders.length) return showMsg($('lookup-msg'), '找不到符合的訂單，請確認代碼或電話是否正確。', 'err');
      showMsg($('lookup-msg'), `找到 ${data.orders.length} 筆訂單`, 'ok');
      box.innerHTML = data.orders.map(orderHtml).join('');
      const hasPending = data.orders.some((o) => o.status === 'pending');
      if (hasPending) {
        box.innerHTML += `<div class="order"><b>匯款資訊</b><dl class="bank">${bankDl(data.bank)}</dl></div>`;
      }
    } catch (e) {
      showMsg($('lookup-msg'), e.message, 'err');
    }
  });

  // 支援 ?q=HP-XXXXXX 直接查詢
  const params = new URLSearchParams(location.search);
  if (params.get('q')) {
    $('lookup-q').value = params.get('q');
    $('lookup-form').requestSubmit();
  }

  loadStatus();
})();
