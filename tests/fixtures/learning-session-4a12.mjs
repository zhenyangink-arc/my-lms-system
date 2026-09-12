import {manifest,compiled,content,context,state,source} from './runtime-4a.mjs';
import {flowFixture,capsules,scope} from './runtime-4a9.mjs';
import {serverModule} from './runtime-4a2.server.mjs';
const {createLearningBoundary}=await import('../../src/features/smart-textbook-runtime/server/learning-boundary.server.ts');
const {sceneImageBytes}=await import('../../src/features/smart-textbook-runtime/server/scene-image.server.ts');
const {activityExecutions}=await import('../../src/features/smart-textbook-runtime/server/activity-binding.server.ts');
const {activityPages}=await import('../../src/features/smart-textbook-runtime/server/activity-pages.server.ts');
const {patternExecutions}=await import('../../src/features/smart-textbook-runtime/server/pattern-binding.server.ts');
const {learningTools,openLearningDestination}=await import('../../src/features/smart-textbook-runtime/server/learning-tools.server.ts');

/** Isolated normal-auth transport + real domain adapters. Synthetic secrets are
 * server-only in flowFixture. This never creates formal completion. */
export async function learningSessionFixture(){
  const sessionRef='learning-session-00000000-0000-4000-8000-000000000412',expiresAt=Date.now()+600000;
  const {flow}=await flowFixture(),recordings=await serverModule('src/features/smart-textbook-runtime/server/preview-recording.server.ts'),binder=await serverModule('src/features/smart-textbook-runtime/server/recording-binding.server.ts');
  const store=recordings.createPreviewRecordingStore(),plans=capsules.flatMap(c=>binder.recordingPlans(manifest,compiled.bindings,c.id,'zh-CN'));
  const recording=store.services(async()=>({ownerId:'isolated-audit-owner',sessionId:sessionRef,snapshotId:manifest.snapshot.id,revision:compiled.report.sourceRevision,expiresAt,plans}));
  const repeat=await serverModule('src/features/smart-textbook-runtime/server/guided-repeat.server.ts'),repeatStore=repeat.createPreviewRepeatStore();
  const find=ref=>{const c=capsules.find(c=>c.activities.some(a=>a.activityId===ref));if(!c)throw Error('ISOLATED_ACTIVITY');return c.id;};
  const boundary=createLearningBoundary({resolve:async({sessionRef:input})=>{
    if(input!==sessionRef)throw Error('ISOLATED_SESSION');return {sessionId:sessionRef,snapshotId:manifest.snapshot.id,expiresAt,manifest,bindings:compiled.bindings,services:compiled.services,nodes:source.nodes,scope,locale:'zh-CN'};
  }},async()=>({
    learning:async c=>content[c],refresh:async()=>state,
    // Real frozen binding resolver with isolated PNG transport, never remote media.
    sceneImage:(c,s)=>sceneImageBytes(manifest,compiled.bindings,source,c,s,async()=>new Response(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6pN8AAAAASUVORK5CYII=','base64'),{headers:{'content-type':'image/png'}})),
    submit:(a,response)=>flow.submitNative(find(a),a,response),
    activities:{load:async c=>activityExecutions(manifest,compiled.bindings,c,'zh-CN'),submit:(a,r)=>flow.submit(find(a),a,r)},
    pages:{load:async c=>activityPages(compiled.bindings,compiled.services,c,'zh-CN'),check:(c,p,r)=>flow.pageCheck(c,p,r),audio:async(c,p)=>{
      if(!activityPages(compiled.bindings,compiled.services,c,'zh-CN').some(x=>x.pageId===p&&x.listening))throw Error('ISOLATED_MEDIA_SCOPE');
      const b=Buffer.alloc(16044);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(8000,24);b.writeUInt32LE(16000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(16000,40);return new Blob([b],{type:'audio/wav'});
    },transcript:async(c,p)=>{if(!(await flow.restore(c)).pages.some(x=>x.pageId===p&&x.checked))throw Error('CHECK_REQUIRED');return '隔离学习母稿';}},
    patterns:{load:async c=>patternExecutions(manifest,compiled.bindings,c,'zh-CN'),check:(c,a,r)=>flow.patternCheck(c,a,r),audio:async()=>null},
    learningFlow:{restore:c=>flow.restore(c),revealPage:(c,p)=>flow.revealPage(c,p),finishPages:(c,a)=>flow.finishPages(c,a),finishPattern:(c,a,r)=>flow.finishPattern(c,a,r)},
    guidedRepeat:{load:async c=>{const lesson=repeat.repeatLesson(manifest,compiled.bindings,compiled.services,c,'zh-CN');return lesson?{lesson,state:repeatStore.read(sessionRef,lesson)}:null;},mark:async(c,t,s)=>repeatStore.mark(sessionRef,repeat.repeatLesson(manifest,compiled.bindings,compiled.services,c,'zh-CN'),t,s)},
    learningTools:{load:async c=>learningTools(manifest,compiled.bindings,compiled.services,c,source.nodes),open:async(c,t)=>openLearningDestination(manifest,compiled.bindings,compiled.services,scope,c,t,state,false,source.nodes)},recording,
  }));
  return {boundary,sessionRef,plans,flow,state,context:{...context,runtimeSessionId:sessionRef},dispose:()=>store.dispose()};
}
