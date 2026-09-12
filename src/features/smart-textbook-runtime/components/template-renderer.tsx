'use client';
import { useCallback, useState, useRef, type ReactNode } from 'react';
import type { LayoutV1 } from '../../../lib/smart-textbook-runtime-v1/contracts';
import { RevealBoundary } from './reveal-boundary';
import {RuntimeToolbar} from './runtime-toolbar';

export function TemplateRenderer({layout,teaching,interaction,navigation,activeStepId,chapter}:{layout:LayoutV1;teaching:ReactNode;interaction:ReactNode;navigation:ReactNode;activeStepId?:string;chapter?:{title:string;position:number;total:number;locale:'zh-CN'|'ko-KR';backHref?:string}}){
  const [collapsed,setCollapsed]=useState(false);
  const container=useRef<HTMLDivElement>(null);
  const reveal=useCallback(()=>setCollapsed(false),[]);
  const collapse=layout.teachingCollapsible&&<button type="button" aria-expanded={!collapsed} onClick={()=>setCollapsed(v=>!v)}>{collapsed?'展开教学区':'收起教学区'}</button>;
  return <div ref={container} className="lesson-runtime" data-layout={layout.preset} data-ratio={layout.desktopRatio} data-collapsed={collapsed}>
    {chapter?<RuntimeToolbar container={container} {...chapter}>{collapse}</RuntimeToolbar>:<div className="runtime-toolbar">{collapse}</div>}
    <div className="runtime-classroom">
      <section className="runtime-teaching" aria-label="教学区" hidden={collapsed}>
        <RevealBoundary reveal={reveal}><div hidden={collapsed}>{teaching}</div></RevealBoundary>
      </section>
      <section key={activeStepId} className="runtime-interaction" aria-label="交互学习区">{interaction}</section>
    </div>
    <footer className="runtime-navigation">{navigation}</footer>
  </div>;
}
