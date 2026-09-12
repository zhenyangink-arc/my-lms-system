import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RuntimeBlockInspection,LessonRuntime,RuntimeClassroom } from '../../src/features/smart-textbook-runtime/components/runtime-root';
import { RuntimeServiceContext,LearningStateProvider,useLearningState } from '../../src/features/smart-textbook-runtime/components/runtime-context';
import type { LessonManifestV1 } from '../../src/lib/smart-textbook-runtime-v1/contracts';
import type { RuntimeServices } from '../../src/features/smart-textbook-runtime/core/services';
import type { TargetCommand } from '../../src/features/smart-textbook-runtime/core/target-registry';
import {recordingTransport} from '../../src/features/smart-textbook-runtime/core/recording-transport';
import {withLearningFlow} from '../../src/features/smart-textbook-runtime/core/learning-flow-transport';
import {withLearningSession} from '../../src/features/smart-textbook-runtime/core/learning-session-transport';
import {learningSessionHttp} from '../../src/features/smart-textbook-runtime/core/learning-session-http';
import {teacherRuntimeHttp} from '../../src/features/smart-textbook-runtime/core/teacher-http';

declare global { interface Window { testCommand:(target:string,command:TargetCommand)=>Promise<void>;testMounted:()=>string[];testUnmount:()=>void;testServerState:()=>RuntimeServices['initialState']; } }
function Probe(){const {targets,server}=useLearningState();window.testCommand=(id,command)=>targets.command(id,command);window.testMounted=()=>targets.mountedTargets();window.testServerState=()=>server;return null;}
async function boot(){
  const data=await (await fetch('/data')).json();
  let services:RuntimeServices={context:data.context,initialState:data.state,
    learning:async(ref,signal)=>{signal.throwIfAborted();return data.content[ref];},
    submit:async(ref,response,signal)=>{const r=await fetch('/submit',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({ref,response}),signal});return r.json();},
    teacher:{turn:async()=>{throw Error('No teacher transport in browser harness');},cancel:async()=>{}},
  };
  if(data.sceneImage)services.sceneImage=async(_ref,signal)=>{const r=await fetch('/scene-image',{signal});if(!r.ok)throw Error('Scene test transport');return r.blob();};
  if(data.presentationTools)services.learningTools={load:async(ref,signal)=>{signal.throwIfAborted();return data.presentationTools[ref];},open:async()=>{throw Error('No navigation transport in presentation test');}};
  if(data.authoritativeHistory)services.refresh=async signal=>{const r=await fetch('/history',{signal});if(!r.ok)throw Error('History unavailable');return r.json();};
  if(data.recording){services.recording=recordingTransport(data.context.runtimeSessionId,data.context.snapshotId);const url=new URL(location.href);url.searchParams.set('recordingAudit',data.context.runtimeSessionId);history.replaceState(history.state,'',url);}
  if(data.guidedRepeat){
    const call=async(path:string,input:unknown,signal:AbortSignal)=>{const r=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input),signal});if(!r.ok)throw Error('Repeat transport rejected');return r.json();};
    services.guidedRepeat={load:(capsuleRef,signal)=>call('/repeat/load',{capsuleRef},signal),mark:(capsuleRef,trackId,segmentId,signal)=>call('/repeat/mark',{capsuleRef,trackId,segmentId},signal)};
  }
  if(data.compatibility){
    const call=async(path:string,input:unknown,signal?:AbortSignal)=>{const response=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input),signal});if(!response.ok)throw Error('Transport rejected');return response.json();};
    services.teacher={turn:(ref,generation,intent,answer,signal)=>call('/teacher',{ref,generation,intent,answer},signal),cancel:generation=>call('/cancel',{generation})};
    services.tts={issue:signal=>call('/tts/issue',{},signal),observe:(grantId,signal)=>call('/tts/observe',{grantId},signal)};
    services.activities={load:(ref,signal)=>call('/activities',{ref},signal),submit:(ref,response,signal)=>call('/composite-submit',{ref,response},signal)};
    services.patterns={load:(ref,signal)=>call('/patterns',{ref},signal),check:(capsuleRef,activityRef,response,signal)=>call('/pattern-check',{capsuleRef,activityRef,response},signal)};
    if(data.patternAudio)services.patterns.audio=async(capsuleRef,turnId,signal)=>{const r=await fetch('/pattern-audio',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({capsuleRef,turnId}),signal});if(!r.ok)throw Error('Audio unavailable');return r.status===204?null:r.blob();};
    services.pages={load:(ref,signal)=>call('/pages',{ref},signal),check:(capsuleRef,pageId,response,signal)=>call('/page-check',{capsuleRef,pageId,response},signal),audio:async(capsuleRef,pageId,signal)=>{const response=await fetch('/listening',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({capsuleRef,pageId,kind:'audio'}),signal});if(!response.ok)throw Error('Media unavailable');return response.blob();},transcript:async(capsuleRef,pageId,signal)=>(await call('/listening',{capsuleRef,pageId,kind:'transcript'},signal)).transcript};
  }
  if(data.learningFlow){
    const call=async(path:string,input:unknown,signal?:AbortSignal)=>{const r=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input),signal});if(!r.ok)throw Error('Learning service rejected');return r.json();};
    services.learningTools={load:(capsuleRef,s)=>call('/tools',{capsuleRef},s),open:(capsuleRef,target,s)=>call('/open',{capsuleRef,target},s)};
    services=withLearningFlow(services,(input,signal)=>call('/flow',input,signal));
  }
  const manifest=data.manifest as LessonManifestV1,root=createRoot(document.getElementById('root')!);
  let resumedStep:string|undefined;
  if(data.learningSession){
    const signal=new AbortController().signal,catalog=await learningSessionHttp('catalog',{sessionRef:data.learningSession},signal),continuation=await learningSessionHttp('resume',{sessionRef:data.learningSession},signal);
    resumedStep=continuation.activeStepId;
    services=withLearningSession(services,manifest,data.learningSession,catalog,
      (input,s,blob)=>learningSessionHttp('dispatch',input,s,blob),async(input,s)=>learningSessionHttp('enter',input,s),continuation);
  }
  if(data.teacherBoundary){
    const port=teacherRuntimeHttp(data.learningSession);
    port.witness=(source,target,command,ownerCount)=>{void fetch('/teacher-witness',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({source,target,command,ownerCount})});};
    services={...services,teacherRuntime:port,tts:port.tts,teacher:{turn:async()=>{throw Error('USE_TEACHER_RUNTIME_BOUNDARY');},cancel:()=>port.close()}};
  }
  window.testUnmount=()=>root.unmount();
  // Inspection harness deliberately exposes targets to tests only. No production hooks.
  const mode=new URLSearchParams(location.search).get('mode');
  root.render(<StrictMode>{mode==='strict'||mode==='learning-strict'?<LessonRuntime manifest={manifest} services={services} resume={resumedStep} validationMode={mode==='learning-strict'?'learning':'complete'}/>:mode==='inspect'?<RuntimeBlockInspection manifest={manifest} services={services}/>:<RuntimeServiceContext services={services}><LearningStateProvider manifest={manifest} resume={resumedStep}><Probe/><RuntimeClassroom manifest={manifest}/></LearningStateProvider></RuntimeServiceContext>}</StrictMode>);
}
void boot();
