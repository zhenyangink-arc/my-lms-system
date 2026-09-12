'use client';

import {createContext, useContext, useCallback, useEffect, useRef, useState, type ReactNode} from 'react';
import type {ContentCard} from '../core/services';
import {RevealBoundary, useRevealBoundary} from './reveal-boundary';
import {CardTitleWithHint} from '../../../components/ui/card-title-with-hint';
import {useLearningState,useRuntimeServices} from './runtime-context';
import type {LearningTools} from '../core/learning-tools';

const GroupVisibility=createContext(true);
export const useDialogueGroupVisible=()=>useContext(GroupVisibility);

function DialogueGroup({group,active,select,children}:{group:ContentCard;active:boolean;select:()=>void;children:ReactNode}){
  const revealParent=useRevealBoundary();
  const reveal=useCallback(()=>{revealParent();select();},[revealParent,select]);
  return <GroupVisibility.Provider value={active}><RevealBoundary reveal={reveal}><div role="tabpanel" id={`dialogue-panel-${group.partId}`} aria-labelledby={`dialogue-tab-${group.partId}`} hidden={!active}>{children}</div></RevealBoundary></GroupVisibility.Provider>;
}

/** A visual grouping of existing frozen parts. Hidden groups keep their target
 * owners mounted so Teacher reveal/focus can select the real group. */
export function DialogueGroups({card,renderGroup,tools}:{card:ContentCard;renderGroup:(group:ContentCard)=>ReactNode;tools:LearningTools|null}){
  const {context}=useRuntimeServices();
  const {steps,targets,playbackOwner}=useLearningState();
  const active=useRef<AbortController|null>(null);
  const [playing,setPlaying]=useState(false),[playError,setPlayError]=useState(''),[nextLine,setNextLine]=useState(0);
  const stop=useCallback(()=>{active.current?.abort();active.current=null;setPlaying(false);},[]);
  useEffect(()=>{const off=steps.onDispose(stop);return()=>{off();active.current?.abort();};},[steps,stop]);
  useEffect(()=>{stop();},[playbackOwner,stop]);
  const storageKey=`uply-runtime:${context.runtimeSessionId}:${context.snapshotId}:dialogue:${card.partId}`;
  const [selected,setSelected]=useState(()=>{
    try{const saved=sessionStorage.getItem(storageKey);if(saved&&card.children.some(g=>g.partId===saved))return saved;}catch{/* Optional presentation state. */}
    return card.children[0]?.partId;
  });
  useEffect(()=>{try{sessionStorage.setItem(storageKey,selected??'');}catch{/* Storage unavailable leaves the first group usable. */}},[storageKey,selected]);
  const buttons=useRef(new Map<string,HTMLButtonElement>());
  const selectedRef=useRef(selected);
  const activate=useCallback((id:string)=>{
    if(selectedRef.current!==id){active.current?.abort();active.current=null;}
    selectedRef.current=id;setSelected(id);
  },[]);
  useEffect(()=>{stop();setNextLine(0);setPlayError('');},[selected,stop]);
  const group=card.children.find(g=>g.partId===selected);
  const owners=group?.children.map(line=>tools?.playback.find(p=>p.partId===line.partId&&p.kind==='browser-tts'))??[];
  const playable=owners.length>0&&owners.every(Boolean)&&!playbackOwner;
  const play=async(all:boolean)=>{
    stop();setPlayError('');if(!playable)return;
    const controller=new AbortController();active.current=controller;setPlaying(true);
    const selectedOwners=all?owners:[owners[nextLine%owners.length]];
    try{
      for(const owner of selectedOwners){controller.signal.throwIfAborted();await targets.command(owner!.target,'play',controller.signal);}
      if(!controller.signal.aborted&&!all)setNextLine(i=>(i+1)%owners.length);
    }catch{if(!controller.signal.aborted)setPlayError('播放未完成，可以重新播放或阅读对话。');}
    finally{if(active.current===controller){active.current=null;setPlaying(false);}}
  };
  return <section className="runtime-dialogue-groups">
    <CardTitleWithHint title={card.title} description="选择一组对话，点击句子旁的播放按钮练习。" headingLevel={3}/>
    {tools&&<div className="runtime-dialogue-controls">
      <button type="button" disabled={!playable||playing} onClick={()=>void play(false)}>{nextLine===0?'逐句练习':'下一句'}</button>
      <button type="button" disabled={!playable||playing} onClick={()=>void play(true)}>整组播放</button>
      {playing&&<button type="button" onClick={stop}>停止播放</button>}
      {playbackOwner&&<span role="status">请先完成老师指定的播放任务。</span>}
      {playError&&<p role="alert">{playError}</p>}
    </div>}
    <div className="runtime-dialogue-tabs" role="tablist" aria-label="选择对话组">
      {card.children.map((group,index)=><button key={group.partId} type="button" role="tab" id={`dialogue-tab-${group.partId}`} aria-controls={`dialogue-panel-${group.partId}`} aria-selected={selected===group.partId} tabIndex={selected===group.partId?0:-1}
        ref={element=>{if(element)buttons.current.set(group.partId,element);else buttons.current.delete(group.partId);}}
        onClick={()=>activate(group.partId)} onKeyDown={event=>{
          const next=event.key==='ArrowRight'?(index+1)%card.children.length:event.key==='ArrowLeft'?(index+card.children.length-1)%card.children.length:event.key==='Home'?0:event.key==='End'?card.children.length-1:null;
          if(next===null)return;event.preventDefault();const id=card.children[next].partId;activate(id);buttons.current.get(id)?.focus();
        }}>{group.title}</button>)}
    </div>
    {card.children.map(group=><SelectableGroup key={group.partId} group={group} active={selected===group.partId} activate={activate}>{renderGroup(group)}</SelectableGroup>)}
  </section>;
}

function SelectableGroup({group,active,activate,children}:{group:ContentCard;active:boolean;activate:(id:string)=>void;children:ReactNode}){
  const select=useCallback(()=>activate(group.partId),[activate,group.partId]);
  return <DialogueGroup group={group} active={active} select={select}>{children}</DialogueGroup>;
}
