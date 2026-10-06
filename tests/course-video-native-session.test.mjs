import test from 'node:test';
import assert from 'node:assert/strict';
import { serverModule, nativeCapture, uid } from './fixtures/teaching-agent-r7d-production/published-fixture.mjs';
// Synthetic only. This helper has no database/env/container/provider factory.
const compiler=await serverModule('src/lib/smart-textbook-publishing/native-video-publication.server.ts');
export function testNativeBundle(){const f=nativeCapture(),t=f.c.learning_agent_script_nodes[0];t.configuration={videoPilotPublication:{contract:'video-pilot-publication-source/1',mode:'video',state:'promoted',origin:{teachingNodeId:uid(),scriptVersionId:uid(),draftDigest:'a'.repeat(64)},approvedBy:uid(),approvedAt:'2026-10-05T00:00:00.000Z',media:{adapter:'fixed-selected-host/1',assetId:'course-video-sample01',sha256:'68f72af1fecee3ce6ad9e2218df1d72ca9773b569bbf8f20847eb6fe0a39cabe',sizeBytes:5487747,mime:'video/mp4',videoDurationSeconds:30,containerDurationSeconds:30.016,revision:'media-sample01-68f72af1fecee3ce6ad9e2218df1d72ca9773b569bbf8f20847eb6fe0a39cabe'},cue:{id:'pause-1',atSeconds:12.5,activityId:t.reference_activity_id},captions:null}};return compiler.packageNativeVideoPublication(compiler.projectNativeVideoPublicationCapture(f.c,f.scope),f.scope);}
let mock;
const sessionModule=await serverModule('src/features/smart-textbook-runtime/server/native-learning-session.server.ts',{
 '../../../lib/auth':`export async function requireActiveUser(){return globalThis.__nativeSessionMock.auth();}`,
 '../../../lib/supabase/admin':`export function createAdminClient(){return globalThis.__nativeSessionMock.admin;}`,
 '../../../lib/smart-textbook-publishing/loader.server.ts':`export async function authorizePublishedCourse(scope){return globalThis.__nativeSessionMock.authorize(scope);}`,
 '../../../lib/smart-textbook-publishing/repository.server.ts':`export function publicationRepository(){return globalThis.__nativeSessionMock.repo;}`,
 '../../../lib/smart-textbook-publishing/domain-guard.server.ts':`export async function assertPublishedDomainDependencies(){return globalThis.__nativeSessionMock.fence();}`,
 './native-published-activity.server.ts':`export async function bootstrapNativeLearningSession(ref){return {testOnly:true,sessionRef:ref};}`,
});
function setup(){const b=testNativeBundle(),sessionRef='learning-session-'+uid(),actor=uid(),tenant=uid(),calls=[];
 const user={user:{id:actor},tenant:{id:tenant},supabase:{from(){return {select(){return this;},eq(){return this;},async maybeSingle(){return {data:{interface_locale:'zh-CN'},error:null};}};}}};
 mock={calls,b,sessionRef,user,saved:{sessionRef,expiresAt:Date.now()+60000,locale:'zh-CN',bundle:b},auth:async()=>{calls.push('auth');return user;},authorize:async()=>{calls.push('rls');return {auth:user,tenantId:tenant,admin:mock.admin};},fence:async()=>calls.push('fence'),admin:{async rpc(_name,args){calls.push(args.p_operation);return {data:{ok:true},error:null};}},repo:{async current(){return {bundle:b,pointer:{snapshotId:b.snapshotId,generation:1}};},async session(op,a,t){calls.push(op);assert.equal(a,actor);assert.equal(t,tenant);return op==='revoke'?null:mock.saved;}}};globalThis.__nativeSessionMock=mock;return mock;
}
test('native session authenticates and fences again under unique active lease',async()=>{const m=setup();let captured;await sessionModule.withNativeLearningSession(m.sessionRef,new AbortController().signal,async a=>{captured=a;sessionModule.assertActiveNativeSessionAuthority(a);assert.equal(a.actorId,m.user.user.id);assert.equal(a.nativeBindings[0].native.actorRef.startsWith('native-actor-'),true);return 7;});assert.deepEqual(m.calls,['auth','resolve','rls','fence','enter','auth','resolve','rls','fence','leave']);assert.throws(()=>sessionModule.assertActiveNativeSessionAuthority(captured));assert.throws(()=>sessionModule.assertActiveNativeSessionAuthority({...captured}));});
test('Response lease stays active through full consumption and releases once',async()=>{const m=setup();let authority;const response=await sessionModule.withNativeLearningSession(m.sessionRef,new AbortController().signal,async a=>{authority=a;return new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array([1,2]));c.close();}}));});sessionModule.assertActiveNativeSessionAuthority(authority);assert.equal(m.calls.includes('leave'),false);assert.deepEqual([...new Uint8Array(await response.arrayBuffer())],[1,2]);assert.equal(m.calls.filter(x=>x==='leave').length,1);assert.throws(()=>sessionModule.assertActiveNativeSessionAuthority(authority));});
test('Response cancellation waits for upstream cancel before releasing authority',async()=>{const m=setup();let authority,finish;const response=await sessionModule.withNativeLearningSession(m.sessionRef,new AbortController().signal,async a=>{authority=a;return new Response(new ReadableStream({cancel(){return new Promise(r=>{finish=r;});}}));});const cancelling=response.body.cancel();await Promise.resolve();sessionModule.assertActiveNativeSessionAuthority(authority);assert.equal(m.calls.includes('leave'),false);finish();await cancelling;assert.equal(m.calls.filter(x=>x==='leave').length,1);});
for(const mode of ['consumer-cancel','signal-abort','overlapping-cancel-abort'])test('pending Response read holds authority through delayed '+mode+' cleanup',async t=>{
 const m=setup(),abort=new AbortController(),events=[];
 const event=name=>events.push({name,atMs:performance.now()});
 const rpc=m.admin.rpc;m.admin.rpc=async(...args)=>{event('lease-'+args[1].p_operation);return rpc(...args);};
 let authority,finishCleanup,readStarted,cleanupDone=false,cancelCount=0;
 const upstreamReading=new Promise(resolve=>{readStarted=resolve;});
 const response=await sessionModule.withNativeLearningSession(m.sessionRef,abort.signal,async a=>{
  authority=a;
  return new Response(new ReadableStream({
   pull(){event('upstream-read-pending');readStarted();},
   cancel(){cancelCount++;event('upstream-cancel-start');return new Promise(resolve=>{finishCleanup=()=>{cleanupDone=true;event('upstream-cancel-finished');resolve();};});},
  },{highWaterMark:0}));
 });
 assert.equal(events.some(e=>e.name==='upstream-read-pending'),false,'wrapper must not read ahead');
 const reader=response.body.getReader(),pendingRead=reader.read();
 await upstreamReading;
 let cancelling;
 if(mode!=='signal-abort')cancelling=reader.cancel('synthetic consumer cancellation');
 if(mode!=='consumer-cancel')abort.abort('synthetic request abort');
 try{
  await new Promise(resolve=>setTimeout(resolve,0));
  event('observe-cleanup-pending');
  assert.equal(cancelCount,1,'overlapping termination must cancel upstream once');
  assert.equal(cleanupDone,false);
  assert.equal(m.calls.filter(x=>x==='leave').length,0);
  sessionModule.assertActiveNativeSessionAuthority(authority);
 }finally{
  finishCleanup?.();
  await Promise.allSettled([pendingRead,cancelling]);
  await new Promise(resolve=>setTimeout(resolve,0));
  t.diagnostic(JSON.stringify({mode,events}));
 }
 assert.equal(cleanupDone,true);
 assert.equal(m.calls.filter(x=>x==='leave').length,1);
 assert.throws(()=>sessionModule.assertActiveNativeSessionAuthority(authority),/NATIVE_AUTHORITY_INACTIVE/);
 assert(events.findIndex(e=>e.name==='upstream-cancel-finished')<events.findIndex(e=>e.name==='lease-leave'));
});
test('Response upstream failure and abort each stop I/O before lease cleanup',async()=>{for(const mode of ['error','abort']){const m=setup(),abort=new AbortController();let authority,cancelled=false;const response=await sessionModule.withNativeLearningSession(m.sessionRef,abort.signal,async a=>{authority=a;return new Response(new ReadableStream({pull(c){if(mode==='error')c.error(Error('synthetic'));},cancel(){cancelled=true;}}));});if(mode==='error')await assert.rejects(response.arrayBuffer());else{abort.abort();await new Promise(r=>setTimeout(r,0));assert.equal(cancelled,true);}assert.throws(()=>sessionModule.assertActiveNativeSessionAuthority(authority));assert.equal(m.calls.filter(x=>x==='leave').length,1);}});
test('session admission rejects wrong actor, tenant, expiry, fence and post-enter drift',async()=>{for(const kind of ['actor','tenant','expiry','fence','drift']){const m=setup();if(kind==='actor')m.authorize=async()=>({auth:{user:{id:uid()}},tenantId:m.user.tenant.id});if(kind==='tenant')m.authorize=async()=>({auth:m.user,tenantId:uid()});if(kind==='expiry')m.saved.expiresAt=0;if(kind==='fence')m.fence=async()=>{throw Error('fence');};if(kind==='drift'){let n=0;m.repo.session=async()=>{n++;return n===1?m.saved:{...m.saved,bundle:testNativeBundle()};};}let called=false;await assert.rejects(sessionModule.withNativeLearningSession(m.sessionRef,new AbortController().signal,async()=>{called=true;}));assert.equal(called,false);assert.equal(m.calls.filter(x=>x==='leave').length,kind==='drift'?1:0);}});
test('issue exact current /3 with preference and revoke only authenticated saved locator',async()=>{const m=setup();const result=await sessionModule.issueNativeLearningSession(m.b.scope);assert.equal(result.sessionRef,m.sessionRef);await sessionModule.revokeNativeLearningSession(m.sessionRef);assert.equal(m.calls.at(-1),'revoke');m.saved.locale='ko-KR';await assert.rejects(sessionModule.issueNativeLearningSession(m.b.scope),/MISMATCH/);});
