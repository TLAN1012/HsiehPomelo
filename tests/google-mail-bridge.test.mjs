import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import { createHmac } from 'node:crypto';
const source=fs.readFileSync(new URL('../integrations/google-apps-script/Code.gs',import.meta.url),'utf8');
function setup(quota=100){
 const secret='x'.repeat(64), props={POMELO_MAIL_SECRET:secret},sent=[];
 const context=vm.createContext({
  ContentService:{MimeType:{JSON:'json'},createTextOutput:s=>({value:JSON.parse(s),setMimeType(){return this;}})},
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k],setProperty:(k,v)=>{props[k]=v},getProperties:()=>({...props}),deleteProperty:k=>{delete props[k]}})},
  Utilities:{Charset:{UTF_8:'utf8'},computeHmacSha256Signature:(v,k)=>Array.from(createHmac('sha256',k).update(v).digest())},
  LockService:{getScriptLock:()=>({tryLock:()=>true,hasLock:()=>true,releaseLock(){}})},
  MailApp:{getRemainingDailyQuota:()=>quota,sendEmail:m=>sent.push(m)},
 });vm.runInContext(source,context);
 function request(overrides={}){
  const payload=JSON.stringify({code:'HP-TESTAA',timestamp:Date.now(),to:'test@example.com',subject:'確認',text:'text',html:'<p>test</p>',...overrides});
  return {postData:{contents:JSON.stringify({payload,signature:createHmac('sha256',secret).update(payload).digest('hex')})}};
 }
 return {context,request,sent};
}
test('rejects unsigned, expired and multiple-recipient requests',()=>{
 const {context,request,sent}=setup();
 assert.equal(context.doPost({postData:{contents:'{}'}}).value.ok,false);
 assert.equal(context.doPost(request({timestamp:Date.now()-600000})).value.error,'expired_request');
 assert.equal(context.doPost(request({to:'a@example.com,b@example.com'})).value.error,'invalid_recipient');
 assert.equal(sent.length,0);
});
test('a signed order sends once and routes replies to Outlook',()=>{
 const {context,request,sent}=setup();
 assert.equal(context.doPost(request()).value.status,'accepted');
 assert.equal(context.doPost(request()).value.status,'accepted');
 assert.equal(sent.length,1);assert.equal(sent[0].replyTo,'someoneelse1957@outlook.com');
});
test('quota exhausted does not send',()=>{
 const {context,request,sent}=setup(0);
 assert.equal(context.doPost(request()).value.error,'quota_exceeded');assert.equal(sent.length,0);
});
