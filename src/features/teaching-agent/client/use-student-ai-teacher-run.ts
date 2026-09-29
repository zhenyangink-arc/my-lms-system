'use client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createStudentAiTeacherClient } from './student-ai-teacher-client.ts';
export function useStudentAiTeacherRun() {
 const [client]=useState(()=>createStudentAiTeacherClient()), lease=useRef({value:0});
 useEffect(()=>{
  const box=lease.current, current=++box.value;
  // StrictMode replays effects in the same turn; defer only disposal, not requests.
  return()=>{queueMicrotask(()=>{if(box.value===current)client.dispose();});};
 },[client]);
 const state=useSyncExternalStore(client.subscribe,client.getSnapshot,client.getServerSnapshot);
 return {state,client};
}
