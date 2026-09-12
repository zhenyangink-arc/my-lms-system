import test from 'node:test';
import assert from 'node:assert/strict';
import {isolatedSessionFixture,manifest,capsules,compiled} from './fixtures/runtime-4a10.mjs';
const {createLearningBoundary}=await import('../src/features/smart-textbook-runtime/server/learning-boundary.server.ts');
const {identity}=await import('../src/lib/smart-textbook-legacy-adapter/identity.server.ts');
const root=key=>manifest.blocks.find(b=>b.type==='compat.learning.v1'&&b.stepId===manifest.steps.find(s=>s.key===key).id).runtimeTarget;
const signal=()=>new AbortController().signal;
async function setup(){
  const f=await isolatedSessionFixture(),calls=[];
  const called=(name)=>(...args)=>{calls.push({name,args});return Promise.resolve(name);};
  const boundary=createLearningBoundary(f.resolver,async()=>({sceneImage:called('scene-image'),learning:called('content'),refresh:async()=>f.history.authority.recording? (await f.reader(signal())).server:null,
    activities:{load:called('activities'),submit:called('submit')},pages:{load:called('pages'),check:called('page-check'),audio:called('audio'),transcript:called('transcript')},
    learningFlow:{restore:called('restore'),revealPage:called('page-reveal'),finishPages:called('pages-finish'),finishPattern:called('pattern-finish')},
    patterns:{load:called('patterns'),check:called('pattern-check'),audio:called('pattern-audio')},guidedRepeat:{load:called('repeat'),mark:called('repeat-mark')},
    learningTools:{load:called('tools'),open:called('open')},recording:{load:called('recording-load'),restore:called('recording-restore'),upload:called('recording-upload'),remove:called('recording-delete'),audio:called('recording-audio'),complete:called('complete')},
  }));
  return {...f,boundary,calls,request:(request,target=root('orientation'),generation=0)=>({sessionRef:f.ref.sessionRef,target,generation,request})};
}
test('4A11 concrete normal-auth resolver at boundary rejects DB UUID, identity injection, wrong activity and cross-Step',async()=>{
  const f=await setup(),request={op:'submit',activity:manifest.activityRefs[0].id,response:{kind:'single',optionId:'option'}};
  await assert.rejects(()=>f.boundary.dispatch(f.request(request),signal()));
  for(const field of ['tenantId','studentId','versionId','sourceRevision','score','snapshotId'])await assert.rejects(()=>f.boundary.dispatch({...f.request({op:'content'}),[field]:'injected'},signal()));
  const foreign=capsules.find(c=>c.stepId===manifest.steps.find(s=>s.key==='grammar').id).activities[0];
  await assert.rejects(()=>f.boundary.dispatch(f.request({...request,activity:identity('activity-ref',foreign.activityId)}),signal()),/ACTIVITY/);
  await assert.rejects(()=>f.boundary.dispatch(f.request({op:'content'},root('grammar')),signal()),/STEP/);assert.equal(f.calls.length,0);
  const catalog=await f.boundary.catalog(f.ref);assert.equal(catalog.length,19);assert(catalog.every(x=>/^activity-ref-/.test(x.serviceRef)));
});
test('scene image requests use the opaque session target only; client object locations and cross-Step access reject',async()=>{
  const f=await setup();
  for(const field of ['objectKey','url','mediaRef','nodeId','studentId'])await assert.rejects(()=>f.boundary.dispatch(f.request({op:'scene-image',[field]:'injected'}),signal()));
  await assert.rejects(()=>f.boundary.dispatch(f.request({op:'scene-image'},root('dialogue')),signal()),/STEP/);
  assert.equal(f.calls.length,0);
  assert.equal(await f.boundary.dispatch(f.request({op:'scene-image'}),signal()),'scene-image');
  assert.equal(f.calls[0].args[0],capsules.find(c=>c.stepId===manifest.steps.find(s=>s.key==='orientation').id).id);
});
test('4A11 session boundary routes every domain family through server-resolved capsule/activity; no client database identities',async()=>{
  const f=await setup();await f.boundary.enter({sessionRef:f.ref.sessionRef,target:root('listen_speak'),generation:0});
  const c=capsules.find(c=>c.stepId===manifest.steps.find(s=>s.key==='listen_speak').id),a=c.activities.find(a=>a.activityKey==='speaking-introduction'),activity=identity('activity-ref',a.activityId);
  const requests=[...['content','activities','pages','patterns','repeat','tools','restore','refresh','recording-load'].map(op=>({op})),
    {op:'recording-restore',activity},{op:'recording-delete',activity,recordingId:'opaque-recording'},
    {op:'recording-audio',activity,recordingId:'opaque-recording'},{op:'speaking-complete',activity,recordingId:'opaque-recording',criteriaIds:[]},
    {op:'repeat-mark',trackId:'frozen-track',segmentId:'frozen-segment'},{op:'audio',pageId:'frozen-page'},{op:'transcript',pageId:'frozen-page'},
    {op:'page-reveal',pageId:'frozen-page'},{op:'pages-finish',activity},{op:'pattern-audio',turnId:'frozen-turn'}];
  for(const request of requests)await f.boundary.dispatch(f.request(request,root('listen_speak'),1),signal());
  assert(f.calls.some(x=>x.name==='recording-restore'&&x.args[1]===a.activityId));
  assert(f.calls.filter(x=>x.name!=='complete'&&!x.name.startsWith('recording-audio')&&!x.name.startsWith('recording-delete')).every(x=>x.args[0]===c.id));
  assert(!JSON.stringify(requests).includes(a.activityId));
  // Domain adapters, not this routing test, own turn/page/content verification.
});
test('4A11 wrong user/tenant/digest/source/expired session reject before dispatch',async()=>{
  for(const kind of ['user','tenant','digest','source','expired']){
    const f=await setup();await f.boundary.catalog(f.ref);
    if(kind==='user')globalThis.__session10auth={...globalThis.__session10auth,user:{id:'not-owner'}};
    if(kind==='tenant')globalThis.__session10auth={...globalThis.__session10auth,tenant:{id:'not-tenant'}};
    if(kind==='digest'||kind==='source'){
      const result=structuredClone(compiled);if(kind==='digest')result.manifest.snapshot.contentDigest='sha256:'+'0'.repeat(64);else result.report.sourceRevision='other-source';
      globalThis.__session10source={...globalThis.__session10source,result};
    }
    if(kind==='expired')f.expire();
    await assert.rejects(()=>f.boundary.dispatch(f.request({op:'content'}),signal()),/SESSION/);assert.equal(f.calls.length,0);
  }
});
test('4A11 server generation cancels delayed old-Step result; old or forged generation cannot dispatch',async()=>{
  const f=await isolatedSessionFixture();let release,started;
  const pending=new Promise(r=>{started=r;}),boundary=createLearningBoundary(f.resolver,async()=>({learning:async()=>{started();return new Promise(r=>{release=r;});}}));
  const r={sessionRef:f.ref.sessionRef,target:root('orientation'),generation:0};
  const result=boundary.dispatch({...r,request:{op:'content'}},signal());await pending;
  assert.deepEqual(await boundary.enter({...r,target:root('vocabulary')}),{generation:1});release('late');await assert.rejects(()=>result);
  await assert.rejects(()=>boundary.dispatch({...r,request:{op:'content'}},signal()),/GENERATION/);
  await assert.rejects(()=>boundary.enter({...r,generation:99}),/GENERATION/);
});
