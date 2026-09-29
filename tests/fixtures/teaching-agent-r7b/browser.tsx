import React from 'react';
import {createRoot} from 'react-dom/client';
import {LessonRuntime} from '../../../src/features/smart-textbook-runtime/components/runtime-root';
import type {RuntimeServices} from '../../../src/features/smart-textbook-runtime/core/services';
import type {CompletionRequest} from '../../../src/features/smart-textbook-runtime/core/execution-contracts';
import type {LessonManifestV1} from '../../../src/lib/smart-textbook-runtime-v1/contracts';
// Only minimal DTOs cross HTTP. No imports of fixture.server, grader or frozen report.
const data=await fetch('/data').then(r=>r.json());
async function post(path:string,request:CompletionRequest,signal:AbortSignal,optionId?:string){const r=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({request,...(optionId?{optionId}:{})}),signal});if(!r.ok)throw Error('FIXTURE_TRANSPORT_UNAVAILABLE');return r.json();}
const unavailable=async()=>{throw Error('NON_NATIVE_PATH_FORBIDDEN');};
const services:RuntimeServices={context:data.context,initialState:data.state,learning:unavailable,submit:unavailable,teacher:{turn:unavailable,cancel:async()=>{}},nativeExecution:{
 onFactsPort:port=>Object.assign(window,{r7bFacts:port?.read}),
 mediaSource:(ref,revision)=>{if(!data.manifest.mediaRefs.some((m:{id:string;revision:string})=>m.id===ref&&m.revision===revision))throw Error('MEDIA_BINDING');return '/media';},
 restore:(r,s)=>post('/restore',r,s),checkpoint:(r,s)=>post('/checkpoint',r,s),submit:(r,o,s)=>post('/submit',r,s,o),readback:(r,s)=>post('/readback',r,s),
}};
const root=createRoot(document.getElementById('root')!);
root.render(<><p role="note">开发执行测试，不计入正式学习进度。</p><LessonRuntime manifest={data.manifest as LessonManifestV1} services={services}/></>);
Object.assign(window,{r7bUnmount:()=>root.unmount()});
