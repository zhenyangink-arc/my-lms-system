'use client';
import {useEffect,useRef} from 'react';
import {useLearningState} from './runtime-context';

/** A sub-activity can unmount without changing Step generation. Both lifetimes
 * must still be alive before an async response updates its parent flow. */
export function useOperationLease(){
  const {steps}=useLearningState(),lifetime=useRef<AbortController|null>(null);
  useEffect(()=>{const controller=new AbortController();lifetime.current=controller;return()=>controller.abort();},[]);
  return ()=>{const step=steps.lease();if(!lifetime.current)throw Error('OPERATION_NOT_MOUNTED');return {...step,signal:AbortSignal.any([step.signal,lifetime.current.signal])};};
}
