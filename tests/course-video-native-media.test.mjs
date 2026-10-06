import test from 'node:test';
import assert from 'node:assert/strict';
import {open,realpath} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash} from 'node:crypto';
import {serverModule,nativeCapture,uid} from './fixtures/teaching-agent-r7d-production/published-fixture.mjs';
const compiler=await serverModule('src/lib/smart-textbook-publishing/native-video-publication.server.ts');
const source='/home/yangzhen/projects/media-studio/spikes/p0-3a-remux/input/sample01.mp4';
// TEST ONLY lower-I/O instrumentation: positives read the one authorized file
// read-only; negatives alter in-memory read buffers/results, NEVER the file.
let m;
globalThis.__mediaIO={async realpath(path){assert.equal(path,source);if(m.missing)throw Error('TEST_ONLY_MISSING');return realpath(path);},async open(path,flags){assert.equal(path,source);assert.equal(flags,constants.O_RDONLY|constants.O_NOFOLLOW);m.calls.push('open');const f=await open(path,flags);return {
 stat:()=>f.stat(),async read(buffer,offset,length,position){m.calls.push('read');const result=await f.read(buffer,offset,length,position);m.readBytes+=result.bytesRead;if(m.altered&&position===0&&result.bytesRead)buffer[0]^=1;if(m.abortRead)m.abort.abort();return result;},async close(){m.calls.push('close-start');if(m.closeGate)await m.closeGate;await f.close();m.calls.push('close-done');},};}};
const media=await serverModule('src/features/smart-textbook-runtime/server/native-published-media.server.ts',{
 'node:fs/promises':`export const open=(...a)=>globalThis.__mediaIO.open(...a);export const realpath=(...a)=>globalThis.__mediaIO.realpath(...a);`,
 '../../../lib/auth':`export async function requireActiveUser(){if(globalThis.__media.authLost)throw Error('denied');return globalThis.__media.auth;}`,
 '../../../lib/supabase/admin':`export const createAdminClient=()=>globalThis.__media.admin;`,
 '../../../lib/smart-textbook-publishing/loader.server.ts':`export async function authorizePublishedCourse(){const m=globalThis.__media;return {auth:m.auth,tenantId:m.foreignTenant?'foreign':m.auth.tenant.id};}`,
 '../../../lib/smart-textbook-publishing/repository.server.ts':`export const publicationRepository=()=>globalThis.__media.repo;`,
 '../../../lib/smart-textbook-publishing/domain-guard.server.ts':`export async function assertPublishedDomainDependencies(){if(globalThis.__media.fenceLost)throw Error('fence');}`,
 './native-published-activity.server.ts':`export async function bootstrapNativeLearningSession(){throw Error('unused');}`,
});
function setup(){const f=nativeCapture(),node=f.c.learning_agent_script_nodes[0],proof={adapter:'fixed-selected-host/1',assetId:'course-video-sample01',sha256:'68f72af1fecee3ce6ad9e2218df1d72ca9773b569bbf8f20847eb6fe0a39cabe',sizeBytes:5487747,mime:'video/mp4',videoDurationSeconds:30,containerDurationSeconds:30.016,revision:'media-sample01-68f72af1fecee3ce6ad9e2218df1d72ca9773b569bbf8f20847eb6fe0a39cabe'};
 node.configuration={videoPilotPublication:{contract:'video-pilot-publication-source/1',mode:'video',state:'promoted',origin:{teachingNodeId:uid(),scriptVersionId:uid(),draftDigest:'b'.repeat(64)},approvedBy:uid(),approvedAt:'2026-10-05T00:00:00.000Z',media:proof,cue:{id:'pause-1',atSeconds:7,activityId:node.reference_activity_id},captions:null}};
 const bundle=compiler.packageNativeVideoPublication(compiler.projectNativeVideoPublicationCapture(f.c,f.scope),f.scope),sessionRef='learning-session-'+uid();
 m={bundle,proof,sessionRef,readBytes:0,calls:[],abort:new AbortController(),auth:{user:{id:uid()},tenant:{id:uid()}},admin:{async rpc(name,args){assert.equal(name,'runtime_publication_request_v1');m.calls.push(args.p_operation);return {data:{ok:true},error:null};}},repo:{async session(_op,actor,tenant,{ref}){if(ref!==sessionRef.slice(17))throw Error('wrong session');return {sessionRef,bundle,expiresAt:Date.now()+60000,locale:'zh-CN'};}}};
 // Stable expiry is part of B's double-check identity.
 const expiresAt=Date.now()+60000;m.repo.session=async(_op,_actor,_tenant,{ref})=>{if(ref!==sessionRef.slice(17))throw Error('wrong session');return {sessionRef,bundle,expiresAt,locale:'zh-CN'};};globalThis.__media=m;return m;}
function request({method='GET',range,query}={}){return new Request('http://test.invalid/api/smart-textbook-runtime/native-media?'+(query??new URLSearchParams({sessionRef:m.sessionRef,mediaRef:m.bundle.privatePayload.bindings[0].mediaRef,revision:m.proof.revision})),{method,headers:range?{Range:range}:undefined,signal:m.abort.signal});}
test('real full-byte GET hashes exact served bytes and keeps lease until consumption',async()=>{setup();const r=await media.serveNativePublishedMedia(request());assert.equal(r.status,200);assert.equal(m.calls.filter(x=>x==='open').length,1);assert.equal(m.readBytes,5487747);assert(!m.calls.includes('leave'));const bytes=await r.arrayBuffer();assert.equal(createHash('sha256').update(new Uint8Array(bytes)).digest('hex'),m.proof.sha256);assert.equal(m.calls.filter(x=>x==='leave').length,1);assert(m.calls.indexOf('close-done')<m.calls.indexOf('leave'));for(const[k,v]of Object.entries({'cache-control':'private, no-store','vary':'Cookie','cross-origin-resource-policy':'same-origin','x-content-type-options':'nosniff','content-type':'video/mp4'}))assert.equal(r.headers.get(k),v);assert.equal(r.headers.get('access-control-allow-origin'),null);});
test('HEAD fully verifies bytes and authenticates; closed/open/suffix ranges serve same verified bytes',async()=>{
 for(const[range,start,end]of [['bytes=3-9',3,9],['bytes=5487740-',5487740,5487746],['bytes=-5',5487742,5487746],['bytes=5487740-9999999',5487740,5487746]]){setup();const r=await media.serveNativePublishedMedia(request({range}));assert.equal(r.status,206);assert.equal(r.headers.get('content-range'),`bytes ${start}-${end}/5487747`);assert.equal((await r.arrayBuffer()).byteLength,end-start+1);assert.equal(m.readBytes,5487747);assert.equal(m.calls.filter(x=>x==='leave').length,1);}
 setup();const r=await media.serveNativePublishedMedia(request({method:'HEAD'}));assert.equal(r.status,200);assert.equal(r.body,null);assert.equal(m.readBytes,5487747);assert.equal(m.calls.filter(x=>x==='leave').length,1);
});
test('invalid or multipart ranges fail with exact 416 after full authorization',async()=>{for(const range of ['bytes=9-3','bytes=5487747-','bytes=-0','bytes=0-2,4-6','bytes=foo-bar','bytes=9007199254740993-']){setup();const r=await media.serveNativePublishedMedia(request({range}));assert.equal(r.status,416,range);assert.equal(r.headers.get('content-range'),'bytes */5487747');assert.equal(m.calls.filter(x=>x==='leave').length,1);}});
test('strict query, foreign session/tenant/revision, lost auth and fence fail before any file I/O',async()=>{
 for(const mode of ['extra','duplicate','wrongSession','revision','tenant','auth','fence']){setup();const q=new URLSearchParams({sessionRef:m.sessionRef,mediaRef:m.bundle.privatePayload.bindings[0].mediaRef,revision:m.proof.revision});if(mode==='extra')q.set('path',source);if(mode==='duplicate')q.append('revision',m.proof.revision);if(mode==='wrongSession')q.set('sessionRef','learning-session-'+uid());if(mode==='revision')q.set('revision','foreign');if(mode==='tenant')m.foreignTenant=true;if(mode==='auth')m.authLost=true;if(mode==='fence')m.fenceLost=true;const r=await media.serveNativePublishedMedia(request({query:q}));assert([400,403].includes(r.status));assert(!m.calls.includes('open'));assert.equal(await r.text(),'');}
});
test('missing and modified file bytes are TEST ONLY I/O failures, no substitute, private 503',async()=>{for(const flag of ['missing','altered']){setup();m[flag]=true;const r=await media.serveNativePublishedMedia(request());assert.equal(r.status,503);assert.equal(await r.text(),'');assert.equal(m.calls.filter(x=>x==='leave').length,1);}});
test('abort during read waits for descriptor cleanup; cancel after response releases exactly once',async()=>{
 setup();let releaseClose;m.closeGate=new Promise(resolve=>{releaseClose=resolve;});m.abortRead=true;const pending=media.serveNativePublishedMedia(request());try{for(let i=0;i<100&&!m.calls.includes('close-start');i++)await new Promise(r=>setTimeout(r,5));assert(m.calls.includes('close-start'));assert(!m.calls.includes('leave'));}finally{releaseClose();}assert.equal((await pending).status,499);assert.equal(m.calls.filter(x=>x==='leave').length,1);
 setup();const r=await media.serveNativePublishedMedia(request());await r.body.cancel();assert.equal(m.calls.filter(x=>x==='leave').length,1);
});
