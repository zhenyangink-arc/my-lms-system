'use client';
import {useMemo,useEffect,useState} from 'react';
import type {LessonManifestV1,RuntimeContextV1} from '../../../lib/smart-textbook-runtime-v1/contracts';
import type {RuntimeServices,ServerLearningState} from '../core/services';
import {teacherRuntimeHttp} from '../core/teacher-http';
import {LessonRuntime} from './runtime-root';
import {withLearningSession} from '../core/learning-session-transport';
import {learningSessionHttp} from '../core/learning-session-http';
import {z} from 'zod';
const catalogSchema=z.array(z.strictObject({runtimeRef:z.string(),serviceRef:z.string().regex(/^activity-ref-[0-9a-f]{32}$/)}));
const continuationSchema=z.strictObject({generation:z.number().int().nonnegative(),activeStepId:z.string()});
export function AuditRuntimeClient({manifest,context,state}:{manifest:LessonManifestV1;context:RuntimeContextV1;state:ServerLearningState}){
  const [catalog,setCatalog]=useState<{rows:z.infer<typeof catalogSchema>;continuation:z.infer<typeof continuationSchema>}|null>(null),[error,setError]=useState('');
  const sessionRef=`learning-session-${context.runtimeSessionId}`;
  useEffect(()=>{
    const url=new URL(window.location.href);url.searchParams.set('recordingAudit',context.runtimeSessionId);window.history.replaceState(window.history.state,'',url);
    const c=new AbortController();setCatalog(null);setError('');
    Promise.all([learningSessionHttp('catalog',{sessionRef},c.signal),learningSessionHttp('resume',{sessionRef},c.signal)]).then(([value,resume])=>{if(!c.signal.aborted)setCatalog({rows:catalogSchema.parse(value),continuation:continuationSchema.parse(resume)});}).catch(()=>{if(!c.signal.aborted)setError('学习会话初始化失败，请重新打开预览。');});
    return()=>c.abort();
  },[context.runtimeSessionId,sessionRef]);
  const base=useMemo<RuntimeServices>(()=>{const teacherRuntime=teacherRuntimeHttp(sessionRef);return {context,initialState:state,teacherRuntime,
    learning:async()=>{throw Error('SESSION_NOT_INSTALLED');},submit:async()=>{throw Error('SESSION_NOT_INSTALLED');},
    tts:teacherRuntime.tts,
    teacher:{
      turn:async()=>{throw Error('USE_TEACHER_RUNTIME_BOUNDARY');},
      cancel:()=>teacherRuntime.close(),
    },
  };},[context,state,sessionRef]);
  const services=useMemo(()=>catalog?withLearningSession(base,manifest,sessionRef,catalog.rows,
    (input,signal,blob)=>learningSessionHttp('dispatch',input,signal,blob),
    async(input,signal)=>z.strictObject({generation:z.number().int().nonnegative()}).parse(await learningSessionHttp('enter',input,signal)),catalog.continuation):null,[base,manifest,sessionRef,catalog]);
  if(error)return <p role="alert">{error}</p>;
  if(!services)return <p role="status">正在初始化学习会话…</p>;
  return <LessonRuntime manifest={manifest} services={services} resume={catalog?.continuation.activeStepId} validationMode="complete"/>;
}
