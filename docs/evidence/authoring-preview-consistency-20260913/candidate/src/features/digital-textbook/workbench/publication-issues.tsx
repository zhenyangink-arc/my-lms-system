'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import type { PublicationDiagnostic } from '@/lib/smart-textbook-publishing/diagnostics';

export function PublicationIssues({diagnostics,contentHref,scriptsHref,onLocate,autoFocus=false}:{
  diagnostics:PublicationDiagnostic[];contentHref:string;scriptsHref:string;
  onLocate?:(stepId:string)=>void;autoFocus?:boolean;
}){
  const ref=useRef<HTMLElement>(null);
  useEffect(()=>{if(autoFocus)ref.current?.focus();},[diagnostics,autoFocus]);
  if(!diagnostics.length)return null;
  return <section ref={ref} tabIndex={-1} role="alert" aria-label="需要处理的内容"
    className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm focus-visible:outline-2 focus-visible:outline-ring">
    <h2 className="font-semibold">需要处理的内容</h2>
    <ul className="space-y-4">{diagnostics.map((d,i)=><li key={`${d.code}:${d.stepId}:${i}`} className="space-y-2">
      <p className="font-medium">{d.stepTitle} · {d.area}</p>
      <p className="leading-6">{d.message}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {d.stepId&&onLocate&&<button type="button" className="min-h-11 text-primary underline underline-offset-4" onClick={()=>onLocate(d.stepId!)}>定位学习步骤</button>}
        <Link className="inline-flex min-h-11 items-center text-primary underline underline-offset-4" href={d.action==='teaching'?scriptsHref:contentHref}>{d.action==='teaching'?'查看教学脚本':d.action==='refresh'?'返回内容工作台核对':'查看教材内容'}</Link>
      </div>
    </li>)}</ul>
  </section>;
}
