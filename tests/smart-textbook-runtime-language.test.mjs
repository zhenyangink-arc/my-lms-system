import './fixtures/smart-textbook-legacy-adapter/register-server-only.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
const {changeRuntimeLanguage}=await import('../src/features/smart-textbook-runtime/server/runtime-language.server.ts');
const input={sessionRef:'learning-session-00000000-0000-4000-8000-000000000001',locale:'ko-KR'};
function fixture(){const calls=[];return {calls,ports:{resolve:async()=>{calls.push('resolve');return {manifest:{textbook:{id:'trusted-textbook'}}};},admit:async()=>{calls.push('admit');return {eligible:true};},save:async x=>{calls.push(x);return {ok:true};},revoke:async()=>{calls.push('revoke');}}};}
test('language change uses authorized textbook, original preference port, then revokes session',async()=>{
 const {calls,ports}=fixture();assert.deepEqual(await changeRuntimeLanguage(input,ports),{reloadRequired:true});
 assert.deepEqual(calls,['resolve','admit',{textbookId:'trusted-textbook',locale:'ko-KR',supportMode:'bilingual'},'revoke']);
});
test('reject injected identities, invalid language, revoked authority and closed admission before save',async()=>{
 for(const extra of [{studentId:'x'},{textbookId:'x'},{locale:'en-US'}]){const f=fixture();await assert.rejects(changeRuntimeLanguage({...input,...extra},f.ports));assert.equal(f.calls.length,0);}
 for(const stage of ['resolve','admit']){const f=fixture();f.ports[stage]=async()=>{throw Error('denied');};await assert.rejects(changeRuntimeLanguage(input,f.ports));assert(!f.calls.some(x=>typeof x==='object'));}
 const f=fixture();f.ports.admit=async()=>({eligible:false});await assert.rejects(changeRuntimeLanguage(input,f.ports),/CLOSED/);assert.deepEqual(f.calls,['resolve']);
});
test('save failure does not revoke; revoke failure never reports successful reload',async()=>{
 const f=fixture();f.ports.save=async()=>({ok:false});await assert.rejects(changeRuntimeLanguage(input,f.ports),/SAVE/);assert(!f.calls.includes('revoke'));
 const g=fixture();g.ports.revoke=async()=>{throw Error('revoke unavailable');};await assert.rejects(changeRuntimeLanguage(input,g.ports),/revoke/);
});
