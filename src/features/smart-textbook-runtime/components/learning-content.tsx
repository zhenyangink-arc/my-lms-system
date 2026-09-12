'use client';
import { useEffect, useState } from 'react';
import type { BlockV1, LessonManifestV1 } from '../../../lib/smart-textbook-runtime-v1/contracts';
import type { ContentCard, LearningContent } from '../core/services';
import { useLearningState, useRuntimeServices } from './runtime-context';
import { RuntimeTarget } from './target';
import { TtsPlaybackOwner } from './tts-playback-owner';
import { ActivityExecutor } from './activity-executor';
import { GuidedRepeatExecutor } from './guided-repeat-executor';
import {RecordingExecutor,FullRecallTrackRecording} from './recording-executor';
import {recordingSlots,type RecordingPlan} from '../core/recording';
import { repeatLessonSchema,acceptRepeatState,type RepeatLesson,type RepeatState } from '../core/guided-repeat';
import {learningToolsSchema,type LearningTools} from '../core/learning-tools';
import {GrammarPlayback,LearningNavigation} from './learning-tools';
import {LearningPanelOwner} from './learning-panel';
import {DialogueGroups} from './dialogue-groups';
import {SceneImage} from './scene-image';

function Card({card,manifest,blockId,recordingOwned,tools,depth=0}:{card:ContentCard;manifest:LessonManifestV1;blockId:string;recordingOwned:Set<string>;tools:LearningTools|null;depth?:number}){
  const {playbackOwner,steps}=useLearningState();
  const declaration=manifest.runtimeTargets.find(t=>t.blockId===blockId&&t.partId===card.partId);
  const activeTask=playbackOwner?.target===declaration?.id&&playbackOwner?.generation===steps.generation;
  if(card.section==='dialogueGroups'){
    const groups=<DialogueGroups card={card} tools={tools} renderGroup={group=><Card card={group} manifest={manifest} blockId={blockId} recordingOwned={recordingOwned} tools={tools} depth={depth+1}/>}/>;
    return declaration?<RuntimeTarget declaration={declaration}>{groups}</RuntimeTarget>:groups;
  }
  const content=<article className="runtime-card runtime-content-card" data-section={card.section} data-depth={depth}><h3>{card.title}</h3>{card.paragraphs.length>0&&<div className="runtime-card-copy">{card.paragraphs.map((p,i)=><p key={i}>{p}</p>)}</div>}{!activeTask&&tools?.playback.some(p=>p.kind==='browser-tts'&&p.partId===card.partId)&&<GrammarPlayback tools={tools} partId={card.partId}/>} {card.children.length>0&&<div className="runtime-card-children">{card.children.map(c=><Card key={c.partId} card={c} manifest={manifest} blockId={blockId} recordingOwned={recordingOwned} tools={tools} depth={depth+1}/>)}</div>}</article>;
  // Recording executors own these mounted handles when enabled; retain the
  // original projection and target behavior for older service contexts.
  return declaration&&!recordingOwned.has(declaration.id)&&!tools?.navigation.some(n=>n.target===declaration.id)?<RuntimeTarget declaration={declaration}>{content}{playbackOwner?.target===declaration.id&&playbackOwner.generation===steps.generation&&<TtsPlaybackOwner owner={playbackOwner}/>}</RuntimeTarget>:content;
}
/** Real scoped content display; not claimed to execute recording/page/activity workflows. */
export function LearningContentRenderer({block,manifest}:{block:Extract<BlockV1,{type:'compat.learning.v1'}>;manifest:LessonManifestV1}){
  const services=useRuntimeServices(),{steps}=useLearningState();
  const needsRepeat=block.props.progressRefs.some(ref=>manifest.progressRefs.some(p=>p.id===ref&&p.kind==='guided-repeat'));
  const needsRecording=block.props.activityRefs.some(ref=>manifest.activityRefs.some(a=>a.id===ref&&a.type==='speaking'));
  const [content,setContent]=useState<LearningContent|null>(null),[error,setError]=useState('');
  const [repeat,setRepeat]=useState<{lesson:RepeatLesson;state:RepeatState}|null>(null);
  const [recordingOwned,setRecordingOwned]=useState<Set<string>>(()=>new Set());
  const [fullRecall,setFullRecall]=useState<Extract<RecordingPlan,{kind:'full-recall'}>|null>(null);
  const [recordingActivities,setRecordingActivities]=useState<string[]>([]);
  const [tools,setTools]=useState<LearningTools|null>(null);
  useEffect(()=>{if(!services.learningTools)return;const lease=steps.lease();let live=true;services.learningTools.load(block.props.capsuleRef,lease.signal).then(raw=>{if(live&&steps.isCurrent(lease)){const t=learningToolsSchema.parse(raw);if(t.snapshotId!==manifest.snapshot.id||t.capsuleRef!==block.props.capsuleRef)throw Error('TOOLS_SCOPE');setTools(t);}}).catch(()=>{if(live&&steps.isCurrent(lease))setError('学习媒体绑定不可用。');});return()=>{live=false;};},[services,steps,block,manifest]);
  useEffect(()=>{const lease=steps.lease();let mounted=true;
    Promise.all([services.learning(block.props.capsuleRef,lease.signal),needsRepeat?services.guidedRepeat?.load(block.props.capsuleRef,lease.signal)??null:null,needsRecording?services.recording?.load(block.props.capsuleRef,lease.signal)??[]:[]]).then(([c,r,plans])=>{if(mounted&&steps.isCurrent(lease)){
      setRecordingOwned(new Set(plans.filter(p=>p.kind!=='full-recall'||!r).flatMap(p=>recordingSlots(p).map(s=>s.target))));
      const recall=plans.find(p=>p.kind==='full-recall');setFullRecall(recall?.kind==='full-recall'?recall:null);
      setRecordingActivities(plans.filter(p=>p.kind!=='full-recall').map(p=>p.activityRef));
      if(c.stepId!==block.stepId||c.capsuleRef!==block.props.capsuleRef)throw Error('CAPSULE_SCOPE_MISMATCH');
      if(r){const lesson=repeatLessonSchema.parse(r.lesson);if(lesson.stepId!==block.stepId||lesson.blockId!==block.id||lesson.capsuleRef!==block.props.capsuleRef||lesson.snapshotId!==manifest.snapshot.id)throw Error('REPEAT_SCOPE');setRepeat({lesson,state:acceptRepeatState(lesson,r.state)});}else setRepeat(null);
      setContent(c);
    }}).catch(()=>{if(mounted&&steps.isCurrent(lease))setError('无法加载当前步骤内容。');});
    return()=>{mounted=false;};
  },[services,steps,block,manifest,needsRepeat,needsRecording]);
  if(error)return <p role="alert">{error}</p>;
  if(!content)return <p role="status">正在加载学习内容…</p>;
  const renderCard=(card:ContentCard)=>{
    if(repeat?.lesson.sectionPartId===card.partId){
      const declaration=manifest.runtimeTargets.find(t=>t.blockId===block.id&&t.partId===card.partId);if(!declaration)throw Error('REPEAT_SECTION_TARGET');
      return <RuntimeTarget key={card.partId} declaration={declaration}><GuidedRepeatExecutor lesson={repeat.lesson} initialState={repeat.state} manifest={manifest} trackRecording={fullRecall?trackId=><FullRecallTrackRecording plan={fullRecall} trackId={trackId}/>:undefined}/></RuntimeTarget>;
    }
    return <Card key={card.partId} card={card} manifest={manifest} blockId={block.id} recordingOwned={recordingOwned} tools={tools}/>;
  };
  const navigation=tools?<LearningNavigation tools={tools}/>:null,panel=content.panels?.find(p=>p.navigation);
  return <>{content.cards.some(c=>c.section==='dialogueGroups'||c.section==='dialogueScenes')&&<SceneImage capsuleRef={block.props.capsuleRef} title={block.title?.[services.context.locale]??block.title?.['zh-CN']??'当前学习情景'}/>} {content.unsupported.map(message=><p role="status" key={message}>{message}</p>)}{content.cards.map(card=>{const p=content.panels?.find(p=>p.contentPartId===card.partId);return p?<LearningPanelOwner key={p.partId} panel={p}>{renderCard(card)}</LearningPanelOwner>:renderCard(card);})}{panel?<LearningPanelOwner panel={panel}>{navigation}</LearningPanelOwner>:navigation}<ActivityExecutor panels={content.panels} capsuleRef={block.props.capsuleRef} externallyExecutedRefs={recordingActivities} renderExternal={ref=><RecordingExecutor capsuleRef={block.props.capsuleRef} manifest={manifest} activityRef={ref} omitFullRecall/>}/>{services.recording&&!services.learningFlow&&<RecordingExecutor capsuleRef={block.props.capsuleRef} manifest={manifest} omitFullRecall={Boolean(repeat)}/>}</>;
}
