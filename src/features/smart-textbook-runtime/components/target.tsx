'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import type { RuntimeTargetV1 } from '../../../lib/smart-textbook-runtime-v1/contracts';
import { elementTargetHandle,type TargetHandle } from '../core/target-registry';
import { useLearningState } from './runtime-context';
import { useRevealBoundary } from './reveal-boundary';
import { flushSync } from 'react-dom';

export function RuntimeTarget({declaration,children,commands}:{declaration:RuntimeTargetV1;children:ReactNode;commands?:Pick<TargetHandle,'open'|'play'>}){
  const ref=useRef<HTMLDivElement>(null),{targets}=useLearningState();
  const reveal=useRevealBoundary();
  useEffect(()=>{
    if(!ref.current||!declaration.capabilities.length)return;
    return targets.mount(declaration.id,{...elementTargetHandle(ref.current,declaration.capabilities,()=>flushSync(reveal)),...commands});
  },[targets,declaration,reveal,commands]);
  return <div ref={ref} tabIndex={declaration.capabilities.length?-1:undefined} data-runtime-target={declaration.capabilities.length?declaration.id:undefined} className="runtime-target">{children}</div>;
}
