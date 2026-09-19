import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOrderEmail } from '../src/order-email.js';
const order = { code:'HP-TESTAA', email:'customer@example.com', boxes:2, unit_price:800, shipping_fee:200, total:1800, address:'private address', note:'private note' };
test('confirmation has order values and a production lookup link without claiming payment', () => {
 const mail = buildOrderEmail(order);
 assert.equal(mail.to, order.email);
 assert.match(mail.text,/NT\$1,800/);
 assert.match(mail.text,/https:\/\/hsieh-pomelo.pages.dev\/\?q=HP-TESTAA/);
 assert.match(mail.text,/不代表已收款或已出貨/);
 assert.ok(!mail.text.includes(order.address));
 assert.ok(!mail.html.includes(order.note));
});
test('unset or placeholder bank details are omitted', () => {
 const mail = buildOrderEmail(order,{bank_name:'（請在管理頁填寫銀行名稱）',bank_account:'placeholder',bank_holder:'test'});
 assert.ok(!mail.html.includes('placeholder'));
 assert.ok(!mail.text.includes('請在管理頁'));
});
test('configured bank details are included and HTML escaped', () => {
 const mail = buildOrderEmail(order,{bank_name:'A & B',bank_account:'123456',bank_holder:'<script>alert(1)</script>'});
 assert.match(mail.text,/帳號：123456/);
 assert.match(mail.html,/A &amp; B/);
 assert.ok(!mail.html.includes('<script>'));
});
