'use client';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { LessonManifestV1 } from '../../../lib/smart-textbook-runtime-v1/contracts';
import { StepController } from '../core/step-controller';
import { RuntimeTargetRegistry } from '../core/target-registry';
import { acceptServerState, type RuntimeServices, type ServerLearningState } from '../core/services';
import type { TtsPlaybackOwner } from '../core/playback';

const ServiceContext=createContext<RuntimeServices|null>(null);
const LearningContext=createContext<{
  steps:StepController; targets:RuntimeTargetRegistry; server:ServerLearningState;
  drafts:Map<string,string>; activePart:string|null; setActivePart:(id:string|null)=>void;
  refresh:()=>Promise<void>;
  playbackOwner:TtsPlaybackOwner|null;setPlaybackOwner:(owner:TtsPlaybackOwner|null)=>void;
}|null>(null);
export function RuntimeServiceContext({services,children}:{services:RuntimeServices;children:ReactNode}) {
  return <ServiceContext.Provider value={services}>{children}</ServiceContext.Provider>;
}
export function useRuntimeServices(){const value=useContext(ServiceContext);if(!value)throw Error('Missing RuntimeServiceContext');return value;}
export function LearningStateProvider({manifest,resume,children}:{manifest:LessonManifestV1;resume?:string;children:ReactNode}) {
  const services=useRuntimeServices();
  const [server,setServer]=useState(()=>acceptServerState(services.context,services.initialState));
  const [steps]=useState(()=>new StepController(manifest,server.completedStepIds,resume));
  const [targets]=useState(()=>new RuntimeTargetRegistry(manifest.runtimeTargets,steps));
  const [drafts]=useState(()=>new Map<string,string>());
  const [activePart,setActivePart]=useState<string|null>(null);
  const [playbackOwner,setPlaybackOwner]=useState<TtsPlaybackOwner|null>(null);
  const lifetime=useRef(0);
  useEffect(()=>{
    const token=++lifetime.current;
    // React StrictMode replays effects synchronously. Revoke only a genuine root
    // unmount; Step transitions still dispose synchronously in StepController.
    return()=>{queueMicrotask(()=>{if(lifetime.current===token){void services.teacher.cancel(steps.generation).catch(()=>{});steps.dispose();}});};
  },[steps,services]);
  const refresh=async()=>{
    if(!services.refresh)return;
    const lease=steps.lease(),response=await services.refresh(lease.signal);
    if(!steps.isCurrent(lease))return;
    const next=acceptServerState(services.context,response);
    if(next.completedStepIds.some(id=>!manifest.navigation.items.includes(id)))throw Error('UNKNOWN_COMPLETION_STEP');
    setServer(next);steps.serverCompletion(next.completedStepIds);
  };
  useEffect(()=>{if(services.refresh)void refresh().catch(()=>{/* Keep last verified state; never fabricate completion. */});},[services,steps]);
  return <LearningContext.Provider value={{steps,targets,server,drafts,activePart,setActivePart,refresh,playbackOwner,setPlaybackOwner}}>{children}</LearningContext.Provider>;
}
export function useLearningState(){const value=useContext(LearningContext);if(!value)throw Error('Missing LearningStateProvider');return value;}
