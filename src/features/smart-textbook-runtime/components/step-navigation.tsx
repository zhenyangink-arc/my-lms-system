'use client';
import type { LessonManifestV1 } from '../../../lib/smart-textbook-runtime-v1/contracts';
import { useLearningState, useRuntimeServices } from './runtime-context';

export function StepNavigation({manifest}:{manifest:LessonManifestV1}){
  const {steps}=useLearningState(),{context}=useRuntimeServices();
  return <nav aria-label="学习步骤"><ol className="runtime-steps">
    {manifest.navigation.items.map(id=>{const step=manifest.steps.find(s=>s.id===id)!;return <li key={id}><button type="button" disabled={!steps.canEnter(id)} aria-current={steps.activeStepId===id?'step':undefined} onClick={()=>steps.go(id)}>{step.title[context.locale]??step.title['zh-CN']}</button></li>;})}
  </ol><div className="runtime-step-actions"><button type="button" disabled={steps.activeStepId===manifest.navigation.entryStep} onClick={()=>steps.previous()}>上一步</button><button type="button" disabled={!manifest.steps.find(s=>s.id===steps.activeStepId)?.nextStep||!steps.canEnter(manifest.steps.find(s=>s.id===steps.activeStepId)!.nextStep!)} onClick={()=>steps.next()}>下一步</button></div></nav>;
}
