'use client';
import {useEffect,useState} from 'react';
import {LessonRuntime} from './runtime-root';
import {withLearningSession} from '../core/learning-session-transport';
import {teacherRuntimeHttp} from '../core/teacher-http';
import type {RuntimeServices} from '../core/services';
import type {LessonManifestV1} from '../../../lib/smart-textbook-runtime-v1/contracts';

async function send(kind:'learning'|'teacher',input:unknown,signal:AbortSignal,blob?:Blob):Promise<unknown>{
 let body:BodyInit,headers:HeadersInit|undefined;
 if(blob){const form=new FormData();form.set('request',JSON.stringify(input));form.set('recording',blob,'recording.webm');body=form;}
 else{headers={'Content-Type':'application/json'};body=JSON.stringify(input);}
 const r=await fetch(`/api/smart-textbook-runtime/${kind}`,{method:'POST',headers,body,signal,credentials:'same-origin',cache:'no-store'});
 if(!r.ok)throw Error('RUNTIME_REQUEST_REJECTED');return r.headers.get('content-type')?.startsWith('application/json')?r.json():r.blob();
}
type Bootstrap={manifest:LessonManifestV1;sessionRef:string;catalog:Array<{runtimeRef:string;serviceRef:string}>;continuation:{generation:number;activeStepId:string};context:RuntimeServices['context'];state:RuntimeServices['initialState']};
const storageKey='uply-published-chapter-one-session';
let booting:Promise<Bootstrap>|null=null;
/** Only HTTP wiring/lifecycle here. Same Renderer, same domain ports; browser
 * stores an untrusted opaque locator, never admission policy or private binding. */
export function PublishedRuntimeEntry({backHref}:{backHref?:string}){
 const [state,setState]=useState<{kind:'loading'}|{kind:'error'}|{kind:'ready';data:Bootstrap;services:RuntimeServices}>({kind:'loading'});
 useEffect(()=>{
  let disposed=false;const abort=new AbortController();let installed:RuntimeServices|undefined;
  // A StrictMode replay shares the in-flight issue, avoiding orphan sessions.
  if(!booting){let ref:string|null=null;try{ref=sessionStorage.getItem(storageKey);}catch{}
   booting=send('learning',{operation:'bootstrap',...(ref?{sessionRef:ref}:{})},AbortSignal.timeout(30000)).then(value=>{
    const data=value as Bootstrap;
    try{sessionStorage.setItem(storageKey,data.sessionRef);}catch{}
    return data;
   });
  }
  const pending=booting;
  void pending.then(data=>{
   if(disposed)return;
   const teacher=teacherRuntimeHttp(data.sessionRef,(body,signal)=>send('teacher',body,signal));
   const base:RuntimeServices={context:data.context,initialState:data.state,
    learning:async()=>{throw Error('USE_LEARNING_BOUNDARY');},submit:async()=>{throw Error('USE_LEARNING_BOUNDARY');},
    teacherRuntime:teacher,tts:teacher.tts,teacher:{turn:async()=>{throw Error('USE_TEACHER_BOUNDARY');},cancel:()=>teacher.close()}};
   installed=withLearningSession(base,data.manifest,data.sessionRef,data.catalog,
    (payload,signal,blob)=>send('learning',{operation:'dispatch',payload},signal,blob),
    async(payload,signal)=>await send('learning',{operation:'enter',payload},signal) as {generation:number},data.continuation);
   setState({kind:'ready',data,services:installed});
  }).catch(()=>{if(!disposed)setState({kind:'error'});}).finally(()=>{if(booting===pending)booting=null;});
  return()=>{disposed=true;abort.abort();void installed?.teacherRuntime?.close().catch(()=>{});};
 },[]);
 if(state.kind==='loading')return <p role="status">正在加载已发布教材…</p>;
 if(state.kind==='error')return <div role="alert"><p>教材会话或服务暂不可用。请返回课程；不会自动切换版本或提交方式。</p><button type="button" onClick={()=>{try{sessionStorage.removeItem(storageKey);}catch{}location.reload();}}>重新检查入场条件</button></div>;
 return <LessonRuntime manifest={state.data.manifest} services={state.services} resume={state.data.continuation.activeStepId} validationMode="complete" backHref={backHref} onLocaleChange={async locale=>{
   const current=state;setState({kind:'loading'});
   try{
    await current.services.teacherRuntime?.close();
    await send('learning',{operation:'language',sessionRef:current.data.sessionRef,locale},AbortSignal.timeout(30000));
    try{sessionStorage.removeItem(storageKey);}catch{}
    location.reload();
   }catch{setState({kind:'error'});}
 }}/>;
}
