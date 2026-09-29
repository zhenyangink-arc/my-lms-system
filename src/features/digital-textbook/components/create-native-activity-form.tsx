'use client';
import { useRef, useState, useSyncExternalStore, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { CardTitleWithHint } from '@/components/ui/card-title-with-hint';
import { createNativeActivityAction } from '../api/create-native-activity';

const attemptKey='uply:canonical-authoring:hangul-vowel:v1';
const subscribe=()=>()=>{};
const priorAttempt=()=>{try{return sessionStorage.getItem(attemptKey)!==null;}catch{return true;}};
export function CreateNativeActivityForm({binding}:{binding:'EMPTY'|'EXISTING'|'BLOCKED'}) {
  const previous=useSyncExternalStore(subscribe,priorAttempt,()=>true);
  const [started,setStarted]=useState(false),[message,setMessage]=useState('');
  const [pending,startTransition]=useTransition();
  const inFlight=useRef(false);
  const disabled=binding!=='EMPTY'||previous||started||pending;
  function create(){
    if(disabled||inFlight.current)return;
    inFlight.current=true;
    try{sessionStorage.setItem(attemptKey,'VERIFY_REQUIRED');}catch{setMessage('无法保护本次操作，请停止创建并核查。');return;}
    setStarted(true);
    startTransition(async()=>{
      try{
        const result=await createNativeActivityAction();
        setMessage(result.status==='CONFIRMED'?'创建请求已确认，请完成独立数据核查。':'结果待核查，请勿重复创建。');
      }catch{setMessage('连接结果不明确，请勿重复创建，先核查实际数据。');}
    });
  }
  return <section className="space-y-4 rounded-md border p-4" aria-busy={pending}>
    <CardTitleWithHint headingLevel={2} title="创建元音辨认练习" description="为课前导航创建一个练习绑定，保持草稿。冻结教学脚本不变；本页不提交作答或运行课程。" />
    <p>哪个是元音？</p><ul className="list-inside list-disc"><li>ㄱ</li><li>ㅏ</li><li>ㄴ</li></ul>
    {binding!=='EMPTY'&&<p role="status">{binding==='EXISTING'?'已有练习绑定，请核查现有对象。':'目标状态不符，已停止创建。'}</p>}
    {previous&&!message&&binding==='EMPTY'&&<p role="status">已有操作记录，请先独立核查，不要重复提交。</p>}
    <Button className="min-h-11" type="button" disabled={disabled} onClick={create}>{pending?'正在创建…':'创建草稿练习绑定'}</Button>
    {message&&<p role="status" aria-live="polite">{message}</p>}
  </section>;
}
