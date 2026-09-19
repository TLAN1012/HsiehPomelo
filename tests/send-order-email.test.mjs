import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { sendOrderEmail } from '../src/send-order-email.js';
const env={GOOGLE_MAIL_URL:'https://script.google.com/macros/s/test-deployment/exec',POMELO_MAIL_SECRET:'test-secret-123456789012345678901234'};
const order={code:'HP-TESTAA',email:'customer@example.com',boxes:1,unit_price:800,shipping_fee:100,total:900};
test('without authorization no network call is made',async()=>{
 assert.equal(await sendOrderEmail({},order,{},()=>{throw Error('must not call')}),'not_configured');
});
test('Google receives a signed order confirmation for the submitted recipient',async()=>{
 let calls=0;
 const result=await sendOrderEmail(env,order,{},async(url,opts)=>{
  calls++;
  assert.equal(url,env.GOOGLE_MAIL_URL);
  const envelope=JSON.parse(opts.body);const mail=JSON.parse(envelope.payload);
  assert.equal(envelope.signature,createHmac('sha256',env.POMELO_MAIL_SECRET).update(envelope.payload).digest('hex'));
  assert.equal(mail.to,order.email);assert.equal(mail.code,order.code);
  assert.match(mail.html,/HP-TESTAA/);
  return Response.json({ok:true,status:'accepted'});
 });
 assert.equal(result,'accepted');assert.equal(calls,1);
});
test('service failure and quota limits never throw or claim delivery',async()=>{
 assert.equal(await sendOrderEmail(env,order,{},async()=>new Response(null,{status:401})),'failed');
 assert.equal(await sendOrderEmail(env,order,{},async()=>{throw Error('timeout')}),'failed');
 assert.equal(await sendOrderEmail(env,order,{},async()=>Response.json({ok:false,error:'quota_exceeded'})),'failed');
});
test('reject an unexpected host without sending the signed payload',async()=>{
 assert.equal(await sendOrderEmail({...env,GOOGLE_MAIL_URL:'https://example.com'},order,{},()=>{throw Error('must not call')}),'failed');
});
