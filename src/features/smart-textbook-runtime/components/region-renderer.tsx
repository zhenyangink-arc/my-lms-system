'use client';
import { useCallback, useState, type ReactNode } from 'react';
import type { LessonManifestV1, RegionV1, StepV1 } from '../../../lib/smart-textbook-runtime-v1/contracts';
import { BlockRenderer } from './block-renderer';
import { RevealBoundary } from './reveal-boundary';
import {NativeLearningPanel} from './learning-panel';

function SupportDrawer({children}:{children:ReactNode}){
  const [open,setOpen]=useState(false),reveal=useCallback(()=>setOpen(true),[]);
  return <RevealBoundary reveal={reveal}><details open={open} onToggle={event=>setOpen(event.currentTarget.open)}><summary>辅助内容</summary>{children}</details></RevealBoundary>;
}

export function RegionRenderer({manifest,step,regionId,omitLegacyTeacher=false}:{manifest:LessonManifestV1;step:StepV1;regionId:RegionV1['id'];omitLegacyTeacher?:boolean}){
  const region=manifest.regions.find(r=>r.id===regionId);if(!region)return null;
  if(regionId==='navigation')throw Error('NAVIGATION_IS_RUNTIME_OWNED');
  if(regionId==='interaction'){
    if(region.content!=='regions'||region.parent!==null)throw Error('REGION_HIERARCHY');
    return <div>{(['interaction.main','interaction.support','interaction.feedback'] as const).map(id=><RegionRenderer key={id} manifest={manifest} step={step} regionId={id} omitLegacyTeacher={omitLegacyTeacher}/>)}</div>;
  }
  if(region.content!=='blocks'||(regionId!=='teaching'&&region.parent!=='interaction'))throw Error('REGION_NOT_LEAF');
  const placement=step.regions.find(p=>p.region===regionId);
  const blocks=(placement?.blockIds??[]).map(id=>{const b=manifest.blocks.find(b=>b.id===id);if(!b||b.stepId!==step.id||b.region!==regionId)throw Error('BLOCK_PLACEMENT_MISMATCH');return b;});
  const native=blocks.filter(b=>b.type==='multiple_choice'),compat=manifest.blocks.find(b=>b.stepId===step.id&&b.type==='compat.learning.v1');
  const body=<div data-region={regionId}>{blocks.map(b=>b.type==='multiple_choice'&&compat?.type==='compat.learning.v1'?(b.id===native[0].id?<NativeLearningPanel key={b.id} capsuleRef={compat.props.capsuleRef}>{native.map(n=><BlockRenderer key={n.id} block={n} manifest={manifest}/>)}</NativeLearningPanel>:null):omitLegacyTeacher&&b.type==='compat.teacher.v1'?<p key={b.id} role="note">学习侧验收：教师执行器未启用。</p>:<BlockRenderer key={b.id} block={b} manifest={manifest}/>)}</div>;
  return regionId==='interaction.support'&&manifest.layout.supportPresentation==='drawer'?<SupportDrawer>{body}</SupportDrawer>:body;
}
