(() => {
  const $ = (id) => document.getElementById(id);
  const money = (n) => 'NT$' + Number(n).toLocaleString('zh-Hant-TW');
  const STATUS_LABEL = { pending: '待匯款', paid: '已收款', shipped: '已出貨', cancelled: '已取消' };
  const KEY = 'hp_admin_token';
  let token = sessionStorage.getItem(KEY) || '';
  let currentOrders = [];

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function showMsg(el, text, kind) { el.textContent = text || ''; el.className = 'msg' + (text ? ' ' + kind : ''); }
  function fmtTime(iso) {
    const d = new Date(iso.replace(' ', 'T') + 'Z');
    return isNaN(d) ? iso : d.toLocaleString('zh-Hant-TW', { timeZone: 'Asia/Taipei', hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  async function api(path, opts = {}) {
    const res = await fetch(path, {
      ...opts,
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token, ...(opts.headers || {}) },
    });
    const data = await res.json().catch(() => ({ ok: false, error: '伺服器回應異常' }));
    if (res.status === 401) {
      if (opts.loginAttempt) throw new Error('密碼錯誤');
      logout(); throw new Error('登入已失效，請重新登入');
    }
    if (!res.ok || !data.ok) throw new Error(data.error || '發生錯誤');
    return data;
  }

  function logout() {
    token = '';
    sessionStorage.removeItem(KEY);
    $('panel').classList.add('hidden');
    $('login-card').classList.remove('hidden');
  }

  async function login(pw) {
    token = pw;
    await api('/api/admin/login', { method: 'POST', loginAttempt: true });
    sessionStorage.setItem(KEY, token);
    $('login-card').classList.add('hidden');
    $('panel').classList.remove('hidden');
    await Promise.all([loadSettings(), loadOrders()]);
  }

  $('login-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    showMsg($('login-msg'), '', '');
    try { await login($('password').value); }
    catch (e) { showMsg($('login-msg'), e.message, 'err'); }
  });
  $('logout').addEventListener('click', logout);

  // 設定
  const FIELDS = {
    stock: 's-stock', max_boxes_per_order: 's-max', unit_price: 's-price', shipping_fee: 's-ship',
    shipping_mode: 's-mode', notice: 's-notice', bank_name: 's-bank-name', bank_branch: 's-bank-branch',
    bank_account: 's-bank-account', bank_holder: 's-bank-holder',
  };
  async function loadSettings() {
    const { settings } = await api('/api/admin/settings');
    for (const [k, id] of Object.entries(FIELDS)) $(id).value = settings[k];
    $('s-open').value = settings.order_open ? '1' : '0';
  }
  $('settings-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const body = {};
    for (const [k, id] of Object.entries(FIELDS)) body[k] = $(id).value;
    body.order_open = $('s-open').value;
    try {
      await api('/api/admin/settings', { method: 'PUT', body: JSON.stringify(body) });
      showMsg($('settings-msg'), '已儲存', 'ok');
      setTimeout(() => showMsg($('settings-msg'), '', ''), 2000);
    } catch (e) { showMsg($('settings-msg'), e.message, 'err'); }
  });

  // 訂單
  async function loadOrders() {
    const status = $('f-status').value;
    const q = $('f-q').value.trim();
    const qs = new URLSearchParams();
    if (status) qs.set('status', status);
    if (q) qs.set('q', q);
    try {
      const data = await api('/api/admin/orders?' + qs.toString());
      currentOrders = data.orders;
      renderStats(data.summary);
      renderOrders(data.orders);
      showMsg($('orders-msg'), '', '');
    } catch (e) { showMsg($('orders-msg'), e.message, 'err'); }
  }

  function renderStats(summary) {
    const by = Object.fromEntries(summary.map((r) => [r.status, r]));
    const active = ['pending', 'paid', 'shipped'].reduce((a, s) => a + (by[s]?.boxes || 0), 0);
    const html = [
      ['有效訂購箱數', active],
      ['待匯款', `${by.pending?.count || 0} 筆 / ${by.pending?.boxes || 0} 箱`],
      ['已收款', `${by.paid?.count || 0} 筆 / ${by.paid?.boxes || 0} 箱`],
      ['已出貨', `${by.shipped?.count || 0} 筆 / ${by.shipped?.boxes || 0} 箱`],
      ['已取消', `${by.cancelled?.count || 0} 筆`],
    ].map(([l, n]) => `<div class="stat"><div class="n">${esc(n)}</div><div class="l">${l}</div></div>`).join('');
    $('stats').innerHTML = html;
  }

  function renderOrders(orders) {
    if (!orders.length) { $('orders-body').innerHTML = '<tr><td colspan="10" class="muted">沒有訂單</td></tr>'; return; }
    $('orders-body').innerHTML = orders.map((o) => `<tr data-code="${esc(o.code)}">
      <td><code>${esc(o.code)}</code></td>
      <td>${esc(fmtTime(o.created_at))}</td>
      <td>${esc(o.name)}</td>
      <td><a href="tel:${esc(o.phone)}">${esc(o.phone)}</a></td>
      <td>${esc(o.address)}</td>
      <td>${o.boxes}</td>
      <td>${money(o.total)}</td>
      <td>${esc(o.note)}</td>
      <td><select class="status">
        ${Object.entries(STATUS_LABEL).map(([v, l]) => `<option value="${v}" ${v === o.status ? 'selected' : ''}>${l}</option>`).join('')}
      </select></td>
      <td><button type="button" class="ghost del" title="刪除訂單">刪除</button></td>
    </tr>`).join('');
  }

  $('orders-body').addEventListener('change', async (ev) => {
    if (!ev.target.classList.contains('status')) return;
    const code = ev.target.closest('tr').dataset.code;
    try {
      await api('/api/admin/orders/' + encodeURIComponent(code), { method: 'PATCH', body: JSON.stringify({ status: ev.target.value }) });
      await Promise.all([loadOrders(), loadSettings()]);
    } catch (e) { showMsg($('orders-msg'), e.message, 'err'); }
  });
  $('orders-body').addEventListener('click', async (ev) => {
    if (!ev.target.classList.contains('del')) return;
    const code = ev.target.closest('tr').dataset.code;
    if (!confirm(`確定要刪除訂單 ${code}？未取消的訂單其箱數會退回庫存。`)) return;
    try {
      await api('/api/admin/orders/' + encodeURIComponent(code), { method: 'DELETE' });
      await Promise.all([loadOrders(), loadSettings()]);
    } catch (e) { showMsg($('orders-msg'), e.message, 'err'); }
  });

  $('reload').addEventListener('click', loadOrders);
  $('f-status').addEventListener('change', loadOrders);
  let t; $('f-q').addEventListener('input', () => { clearTimeout(t); t = setTimeout(loadOrders, 300); });

  $('export').addEventListener('click', () => {
    const head = ['代碼', '下單時間', '收件人', '電話', '地址', '箱數', '單價', '運費', '合計', '備註', '狀態'];
    const rows = currentOrders.map((o) => [
      o.code, fmtTime(o.created_at), o.name, o.phone, o.address, o.boxes, o.unit_price, o.shipping_fee, o.total, o.note, STATUS_LABEL[o.status] || o.status,
    ]);
    const csv = [head, ...rows].map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  if (token) login(token).catch(logout);
})();
