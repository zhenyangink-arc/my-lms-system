'use client';
import {useEffect,useState,type ReactNode} from 'react';
import type {LearningPanel,LearningContent} from '../core/services';
import {useLearningState,useRuntimeServices} from './runtime-context';
import {RuntimeTarget} from './target';
export function LearningPanelOwner({panel,children}:{panel:LearningPanel;children:ReactNode}){
  const {steps}=useLearningState(),target=steps.manifest.runtimeTargets.find(t=>t.stepId===steps.activeStepId&&t.partId===panel.partId);
  if(!target)throw Error('PANEL_TARGET_UNBOUND');
  return <RuntimeTarget declaration={target}><section aria-label={panel.title}>{children}</section></RuntimeTarget>;
}
/** Native orientation activities retain their Block renderers; the legacy
 * diagnosis panel wraps the real group, never a second copy or hidden owner. */
export function NativeLearningPanel({capsuleRef,children}:{capsuleRef:string;children:ReactNode}){
  const services=useRuntimeServices(),{steps}=useLearningState(),[content,setContent]=useState<LearningContent|null>(null),[error,setError]=useState(false);
  useEffect(()=>{const c=new AbortController();services.learning(capsuleRef,c.signal).then(r=>{if(!c.signal.aborted)setContent(r);}).catch(()=>{if(!c.signal.aborted)setError(true);});return()=>c.abort();},[services,capsuleRef,steps]);
  // Do not initially mount forms outside the panel and then reparent them:
  // that would discard in-flight input/feedback when the owner arrives.
  if(!content)return <p role={error?'alert':'status'}>{error?'学习面板暂不可用。':'正在加载学习面板…'}</p>;
  const panel=content?.panels?.find(p=>p.nativeChoices);
  return panel?<LearningPanelOwner panel={panel}>{children}</LearningPanelOwner>:children;
}
