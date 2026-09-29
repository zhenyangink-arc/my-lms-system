'use client';
import { useState,useRef,useMemo } from 'react';
import { LessonRuntime } from '@/features/smart-textbook-runtime/components/runtime-root';
import type { RuntimeServices } from '@/features/smart-textbook-runtime/core/services';
import { activateB3Execution,recoverB3ReadOnly,b3ExecutionRequest } from '../server/execution.actions';
import { Button } from '@/components/ui/button';
const unavailable=async()=>{throw Error('B3_NON_NATIVE_PATH_FORBIDDEN');};
export function ExecutionConsole({allowed}:{allowed:boolean}){
 const [dispatched,setDispatched]=useState(false);
 const [data,setData]=useState<Awaited<ReturnType<typeof activateB3Execution>>|null>(null),[message,setMessage]=useState(''),[key,setKey]=useState(0);const started=useRef(false);
 const services=useMemo<RuntimeServices|null>(()=>data?{context:data.context,initialState:data.state,learning:unavailable,submit:unavailable,teacher:{turn:unavailable,cancel:async()=>{}},nativeExecution:{
 mediaSource:()=>'/platform/dashboard/admin/development-execution/runtime/media',
 restore:r=>b3ExecutionRequest({operation:'restore',request:r,pending:sessionStorage.getItem('b3-cue-waiting')==='1'}),checkpoint:r=>{sessionStorage.setItem('b3-cue-waiting','1');return b3ExecutionRequest({operation:'checkpoint',request:r});},readback:r=>b3ExecutionRequest({operation:'readback',request:r}),
 submit:async(r,o)=>await b3ExecutionRequest({operation:'submit',request:r,optionId:o}) as Awaited<ReturnType<NonNullable<RuntimeServices['nativeExecution']>['submit']>>,
 }}:null,[data]);
 async function activate(){if(started.current)return;started.current=true;setDispatched(true);try{setData(await activateB3Execution());}catch{setMessage('已停止，请独立核查，不要重复激活。');}}
 async function restart(){try{await b3ExecutionRequest({operation:'restart'});setKey(k=>k+1);}catch{setMessage('重启结果未知，请停止并独立核查。');}}
 return <section className="space-y-4"><p role="status">{message||(!allowed?'当前未获执行批准，范围关闭。':'场景预算：3 INSERT / 1 UPDATE / 0 DELETE。')}</p>
 {!data&&<Button onClick={async()=>{try{setData(await recoverB3ReadOnly());setDispatched(true);}catch{setMessage('暂无可恢复的合法场景，请停止并独立核查。');}}}>恢复已有场景（仅只读）</Button>}
 {!data&&<Button disabled={!allowed||dispatched} onClick={activate}>激活批准的执行范围</Button>}
 {data&&services&&<><LessonRuntime key={key} manifest={data.manifest} services={services}/><Button onClick={restart}>重启受控进程并只读恢复</Button><Button onClick={async()=>{try{await b3ExecutionRequest({operation:'disable'});setMessage('执行范围已关闭。');}catch{setMessage('请独立核查范围状态。');}}}>关闭执行范围</Button></>}
 </section>;
}
