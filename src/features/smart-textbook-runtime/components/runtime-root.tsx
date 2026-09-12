'use client';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { runtimeContextSchema, type LessonManifestV1 } from '../../../lib/smart-textbook-runtime-v1/contracts';
import { validateLessonManifestV1 } from '../../../lib/smart-textbook-runtime-v1/validator';
import { validateRuntimeActivation } from '../core/block-registry';
import { validateLearningActivation } from '../core/learning-readiness';
import type { RuntimeServices } from '../core/services';
import { RuntimeServiceContext, LearningStateProvider, useLearningState, useRuntimeServices } from './runtime-context';
import { TemplateRenderer } from './template-renderer';
import { RegionRenderer } from './region-renderer';
import { StepNavigation } from './step-navigation';
import './runtime.css';

export function RuntimeRoot({manifest:input,services,resume,validationMode='complete',backHref}:{manifest:unknown;services:RuntimeServices;resume?:string;validationMode?:'complete'|'learning';backHref?:string}){
  const checked=validationMode==='learning'?validateLearningActivation(input):validateRuntimeActivation(input);
  const context=runtimeContextSchema.safeParse(services.context);
  if(!checked.success||!context.success||context.data.snapshotId!==(checked.success?checked.data.snapshot.id:null))return <p role="alert">教材暂不能激活：必需的 Runtime 能力或上下文未通过验证。</p>;
  return <RuntimeServiceContext key={`${context.data.runtimeSessionId}:${context.data.snapshotId}`} services={services}><LearningStateProvider manifest={checked.data} resume={resume}><RuntimeClassroom manifest={checked.data} omitTeacher={validationMode==='learning'} backHref={backHref}/></LearningStateProvider></RuntimeServiceContext>;
}
export const LessonRuntime=RuntimeRoot;

export function RuntimeClassroom({manifest,omitTeacher=false,backHref}:{manifest:LessonManifestV1;omitTeacher?:boolean;backHref?:string}){
  const {steps,setActivePart}=useLearningState(),{context}=useRuntimeServices();
  useSyncExternalStore(steps.subscribe,steps.snapshot,steps.snapshot);
  const step=manifest.steps.find(s=>s.id===steps.activeStepId)!;
  const restored=useRef(false);
  useEffect(()=>{if(restored.current)return;restored.current=true;try{const saved=sessionStorage.getItem(`uply-runtime:${context.snapshotId}:step`);if(saved&&steps.canEnter(saved))steps.go(saved);}catch{/* Invalid or inaccessible persisted IDs cannot override navigation policy. */}},[steps,context.snapshotId]);
  useEffect(()=>{setActivePart(null);if(step.id!==steps.activeStepId)return;try{sessionStorage.setItem(`uply-runtime:${context.snapshotId}:step`,step.id);}catch{/* Resume is optional UI state. */}},[step.id,steps,context.snapshotId,setActivePart]);
  return <TemplateRenderer layout={manifest.layout} activeStepId={step.id}
    chapter={{title:manifest.chapter.title[context.locale]??manifest.chapter.title['zh-CN']??'',position:manifest.navigation.items.indexOf(step.id)+1,total:manifest.navigation.items.length,locale:context.locale,backHref}}
    teaching={<RegionRenderer key={`teaching:${step.id}`} manifest={manifest} step={step} regionId="teaching" omitLegacyTeacher={omitTeacher}/>}
    interaction={<div key={`interaction:${step.id}`}><h1>{step.title[context.locale]??step.title['zh-CN']}</h1><RegionRenderer manifest={manifest} step={step} regionId="interaction"/></div>}
    navigation={<StepNavigation manifest={manifest}/>}/>;
}

/** Explicit diagnostic harness, not successful chapter activation. It exercises
 * the same renderers while LessonRuntime still refuses incomplete capabilities. */
export function RuntimeBlockInspection({manifest:input,services}:{manifest:unknown;services:RuntimeServices}){
  const parsed=validateLessonManifestV1(input),context=runtimeContextSchema.safeParse(services.context);
  if(!parsed.success||!context.success||!context.data.trackingDisabled||context.data.snapshotId!==parsed.data.snapshot.id)return <p role="alert">审计上下文无效。</p>;
  return <RuntimeServiceContext key={`${context.data.runtimeSessionId}:${context.data.snapshotId}`} services={services}><LearningStateProvider manifest={parsed.data}><div role="note" className="runtime-alert">组件检查模式：兼容交互尚未齐备，不是可激活的第一章 Runtime，不计入正式进度。</div><RuntimeClassroom manifest={parsed.data}/></LearningStateProvider></RuntimeServiceContext>;
}
