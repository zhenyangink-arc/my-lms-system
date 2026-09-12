import 'server-only';
import { adaptChapterOne, type AdapterResult } from './adapter.server.ts';
import { legacySourceSchema } from './source.server.ts';
import { serviceEvidenceSchema, serviceIdentitySchema, type ReadinessBindings } from './readiness-contracts.server.ts';
import { canonical, digest, identity } from './identity.server.ts';
import { profile } from './profile.server.ts';
import { nodeContentSchemas, activityConfigSchemas, teacherConfigurationSchema } from './chapter-one-shapes.server.ts';
import { makeRuntimeTarget } from '../smart-textbook-runtime-v1/targets.ts';
import { validateLessonManifestV1 } from '../smart-textbook-runtime-v1/validator.ts';
import { validatePrivateBindings } from './bindings.server.ts';
import { verifySpeechSlot } from './speech-proof.server.ts';
import type { ConversionEntry } from './report.server.ts';
import { projectLearningTargetCapabilities } from './target-semantics.server.ts';

export const READINESS_REVISION='chapter-one-readiness.1';
export type ReadinessResult=AdapterResult & {services:ReadinessBindings|null;nonUiRuntimeReady:boolean;resolved:ConversionEntry[];originalUnsupported:number};
/** Sidecar refinement: original Phase 3B adapter stays reproducible; never activates Runtime. */
export function adaptChapterOneReadiness(input:unknown,identities:unknown,historicalMap:unknown,serviceEvidence:unknown):ReadinessResult {
  const base=adaptChapterOne(input,identities);
  const out:ReadinessResult={...base,services:null,nonUiRuntimeReady:false,resolved:[],originalUnsupported:base.report.unsupported.length};
  const issue=(path:string,reason:string)=>out.report.unsupported.push({source:{path},result:'unsupported',reason});
  const resolved=new Set<string>();
  const resolve=(entry:ConversionEntry,reason:string)=>{resolved.add(canonical(entry.source));out.resolved.push({...entry,result:'converted',reason});};
  if(!out.manifest)return out;
  const checked=legacySourceSchema.safeParse(input),map=serviceIdentitySchema.safeParse(historicalMap),proof=serviceEvidenceSchema.safeParse(serviceEvidence);
  if(!checked.success||!map.success||!proof.success){issue('readiness.input','Invalid/missing closed service evidence or frozen historical mapping');return out;}
  const s=checked.data,h=map.data,e=proof.data,m=out.manifest,b=out.bindings;
  const r:ReadinessBindings={schemaVersion:'legacy-readiness/1',sourceRevision:out.report.sourceRevision,historicalSourceRevision:h.sourceRevision,versionId:s.version.id,listeningAliases:[],activityPages:[],guidedRepeat:[],navigation:[],playback:[],speech:[],speechRejected:[]};out.services=r;
  const original=[...out.report.unsupported];
  // History is an explicit frozen capture. Never derive service indices from today's array order.
  if(h.sourceRevision!=='0feb9264ff035a1139cde70e9b1a4611608883d4832f06be87c4a5327f279fc0'||h.versionId!==s.version.id||digest(h)!=='a6fb74b165aa19cb0be225b709f7650703dc9540d947c754a82626e5123ee413'){issue('readiness.history','Historical source revision/mapping digest mismatch; explicit re-certification required');return out;}
  const node=s.nodes.find(n=>n.id===profile.listen_speak.nodeId);
  const repeat=nodeContentSchemas.listen_speak.safeParse(node?.content);
  for(const entry of original.filter(x=>x.source.path==='alt_text')){
    const asset=s.media.find(a=>a.id===entry.source.mediaId);
    const lines=repeat.success?repeat.data.repeatLines.filter(l=>l.audioAssetKey===asset?.asset_key):[];
    const media=asset?m.mediaRefs.find(a=>a.id===identity('media',asset.id)):undefined;
    if(!asset||asset.node_id!==node?.id||asset.media_type!=='audio'||lines.length!==1||!lines[0].ko.trim()||!media)continue;
    media.alt={'zh-CN':`韩语跟读示范：${lines[0].ko}`,'ko-KR':`따라 말하기 예시: ${lines[0].ko}`};
    resolve(entry,'Exact repeatLines.audioAssetKey → public Korean learning text; deterministic accessible description. Pending remains pending; no database edit.');
  }
  // Frozen item membership validates both original service slots and current reordered identities.
  const addPart=(nodeId:string,partId:string)=>{
    const block=m.blocks.find(x=>x.id===identity('block',nodeId,'learning'));
    if(!block||block.type!=='compat.learning.v1')throw new Error('Missing compatibility block');
    if(!block.props.parts.some(p=>p.id===partId))block.props.parts.push({id:partId,title:block.title??{'zh-CN':'学习任务'}});
    const id=makeRuntimeTarget(block.stepId,block.id,partId);
    if(!m.runtimeTargets.some(t=>t.id===id))m.runtimeTargets.push({id,stepId:block.stepId,blockId:block.id,partId,capabilities:[],acceptedEvents:[],verification:'ui-only'});
    return id;
  };
  let pagesValid=true;
  const pageActivities=s.activities.filter(a=>['grammar-choice','grammar-judgment','grammar-fill','listening-identity'].includes(a.activity_key));
  for(const a of pageActivities){
    const parsedConfig=activityConfigSchemas[a.activity_key as keyof typeof activityConfigSchemas].safeParse(a.public_config);
    if(!parsedConfig.success){pagesValid=false;continue;}
    const config=parsedConfig.data;
    if(!('items' in config)){pagesValid=false;continue;}
    const items=config.items;
    const history=h.pages.filter(p=>p.activityId===a.id);
    if(history.flatMap(p=>p.items).length!==items.length){pagesValid=false;continue;}
    const seen=new Set<string>();
    items.forEach((value,i)=>{
      const part=b.identities.find(x=>x.owner===a.id&&x.legacyPath===`public_config.items[${i}]`);
      const mapping=history.flatMap(p=>p.items).filter(x=>x.partId===part?.partId&&x.fingerprint===digest(value));
      if(mapping.length!==1||seen.has(mapping[0].partId))pagesValid=false;else seen.add(mapping[0].partId);
    });
    for(const p of history){if(p.nodeId!==a.node_id||p.items.length>4)pagesValid=false;}
  }
  if(pagesValid&&h.pages.length===8&&new Set(h.pages.flatMap(p=>p.items.map(i=>i.partId))).size===26){
    r.activityPages=structuredClone(h.pages);
    for(const p of r.activityPages){addPart(p.nodeId,p.pageId);p.items.forEach(i=>addPart(p.nodeId,i.partId));}
    for(const p of b.progress.filter(p=>p.kind==='activity-page'))p.partIds=r.activityPages.filter(x=>x.nodeId===p.sourceId).flatMap(x=>[x.pageId,...x.items.map(i=>i.partId)]);
    for(const entry of original.filter(x=>x.source.path==='progress.activity-page'))resolve(entry,'Frozen activity group/items map to real page Action arguments; server attempt remains formal authority. Non-persisted module panels are not activity-page records.');
  }else issue('readiness.activity-page','Activity item identity/fingerprint/coverage differs from frozen service mapping');
  let repeatValid=repeat.success;
  const currentSegments=repeat.success?repeat.data.repeatTracks.flatMap((t,ti)=>t.lines.map((line,si)=>({line,track:b.identities.find(x=>x.owner===node!.id&&x.legacyPath===`content.repeatTracks[${ti}]`)?.partId,segment:b.identities.find(x=>x.owner===node!.id&&x.legacyPath===`content.repeatTracks[${ti}].lines[${si}]`)?.partId}))):[];
  if(currentSegments.length!==14||h.repeat.length!==14||new Set(h.repeat.map(p=>p.segmentId)).size!==14)repeatValid=false;
  for(const p of currentSegments)if(h.repeat.filter(x=>x.nodeId===node!.id&&x.trackId===p.track&&x.segmentId===p.segment&&x.fingerprint===digest(p.line)&&b.recordings.some(a=>a.activityId===x.activityId&&a.practice==='speaking')).length!==1)repeatValid=false;
  if(repeatValid){r.guidedRepeat=structuredClone(h.repeat);for(const entry of original.filter(x=>x.source.path==='progress.guided-repeat'))resolve(entry,'Frozen speaking activity/practice/track/segment slots round-trip to persistent identities; existing unique upsert key reused, no new completion/attempt.');}
  else issue('readiness.guided-repeat','Repeat identity/fingerprint/coverage differs from frozen service mapping');
  const listening=s.activities.find(a=>a.activity_key==='listening-identity');
  const listeningConfig=activityConfigSchemas['listening-identity'].safeParse(listening?.public_config);
  if(listening&&listeningConfig.success){
    const config=listeningConfig.data;
    // Exact captured compatibility aliases, not name similarity. Root alias belongs to the
    // pre-split activity's default page; migration 202608240006 defines its page-0 successor.
    const expectations=[{alias:'chapter-01-listening-identity',page:0,actual:config.audioId},
      {alias:'chapter-01-listening-identity-normal',page:0,actual:config.tracks[0]?.audioId},
      {alias:'chapter-01-listening-dialogue-normal',page:1,actual:config.tracks[1]?.audioId}];
    for(const x of expectations){
      const t=b.listening.find(t=>t.activityId===listening.id&&t.legacyPage===x.page),media=m.mediaRefs.find(a=>a.id===t?.audioRef);
      if(x.actual!==x.alias||!t||!media||media.readiness!=='ready'||!r.activityPages.some(p=>p.activityId===listening.id&&p.legacyPage===x.page)){issue('readiness.listening','Unknown alias or missing ready listening domain track');continue;}
      r.listeningAliases.push({alias:x.alias,activityId:listening.id,legacyPage:x.page,trackId:t.ref,mediaRef:t.audioRef,revision:media.revision});
    }
    if(r.listeningAliases.length===3)for(const entry of original.filter(x=>x.source.activityId===listening.id&&['public_config.audioId','public_config.tracks[1].audioId'].includes(x.source.path)))resolve(entry,'Explicit activity/page association from production audio Route and split-listening migration; frozen listening track identity, no private location in Manifest.');
    for(const p of r.activityPages.filter(p=>p.activityId===listening.id)){
      const a=r.listeningAliases.find(a=>a.legacyPage===p.legacyPage);if(a)r.playback.push({target:addPart(p.nodeId,p.pageId),mediaRef:a.mediaRef,revision:a.revision,source:'authorized-listening',allowedCommand:'play',acceptedEvent:'media-ended',evidence:'playback-observation-only'});
    }
  }
  const review=s.nodes.find(n=>n.id===profile.review.nodeId),reviewContent=nodeContentSchemas.review.safeParse(review?.content);
  if(reviewContent.success&&reviewContent.data.nextNode==='chapter-test:korean-level-one-01'&&e.chapter.id===s.chapter.id&&e.chapter.version_id===s.version.id&&e.chapter.chapter_test_id===e.chapter.chapter_tests.id){
    r.navigation.push({kind:'chapter-test',chapterId:s.chapter.id,testId:e.chapter.chapter_test_id,slug:e.chapter.chapter_tests.slug,legacyKey:'chapter-test:korean-level-one-01',requires:'server-chapter-completed'});
    for(const entry of original.filter(x=>x.source.nodeId===review!.id&&x.source.path==='content.nextNode'))resolve(entry,'Actual chapter_test_id → chapter_tests.id/slug relation; closed internal navigation, existing chapter-completed guard retained, never nextStep or arbitrary URL.');
  }
  const alias=b.aliases.find(a=>a.legacyKey==='dialogue:greeting:0');
  if(alias)r.playback.push({target:alias.target,mediaRef:null,revision:r.sourceRevision,source:'browser-tts',allowedCommand:'reveal',acceptedEvent:'none',evidence:'unavailable'});
  // TTS is not an authorized media resource. Intentionally do NOT resolve studentTask.
  let speechValid=e.speech.length===s.speech.length;
  for(const asset of e.speech){
    const n=s.teachingNodes.find(n=>n.id===asset.script_node_id),old=s.speech.find(a=>a.id===asset.id);
    if(!n||!old||old.content_hash!==asset.content_hash||old.locale!==asset.locale||old.segment_index!==asset.segment_index||old.script_node_id!==asset.script_node_id||old.duration_ms!==asset.duration_ms){speechValid=false;continue;}
    const parsedConfig=teacherConfigurationSchema.safeParse(n.configuration);
    if(!parsedConfig.success){speechValid=false;continue;}
    const config=parsedConfig.data;
    const locale=asset.locale;
    const cues=asset.cue_timeline;
    if(!verifySpeechSlot(n,asset)){speechValid=false;r.speechRejected.push({assetId:asset.id,nodeId:n.id,segment:asset.segment_index,reason:'text-hash-or-timeline-mismatch'});continue;}
    r.speech.push({assetId:asset.id,scriptVersionId:n.script_version_id,nodeId:n.id,locale,segment:asset.segment_index,contentHash:asset.content_hash,timelineHash:digest(cues),durationMs:asset.duration_ms,selectedByCurrentScript:asset.segment_index!==199||!!config.bufferLine?.[locale],authorization:'active-user-published-or-platform-owner'});
  }
  r.speech.sort((a,b)=>a.assetId.localeCompare(b.assetId));
  r.speechRejected.sort((a,b)=>a.assetId.localeCompare(b.assetId));
  if(speechValid)for(const entry of original.filter(x=>x.source.path==='speech.voiceTimeline'))resolve(entry,'All fixed v23 speech asset metadata/hash/timeline slots verified; existing active-user/published-or-owner Route reauthorizes every asset. No object location copied.');
  out.report.unsupported=out.report.unsupported.filter(x=>!resolved.has(canonical(x.source)));
  for(const entry of out.report.unsupported){
    if(entry.source.path==='configuration.studentTask')entry.reason='Stable dialogue target resolves to browser speechSynthesis, not authorized media. Bridge accepts observations only; no server audio_completed evidence or Agent advancement can be certified.';
    if(entry.source.path==='speech.voiceTimeline')entry.reason=`Fixed v23 speech capture: ${r.speech.length} verified slots; ${r.speechRejected.length} rejected text/hash/timeline slots (see private speechRejected). Segment 199/preset selection remains uncertified; never substitute a mismatched asset.`;
  }
  out.report.converted.push(...out.resolved);out.report.adapterRevision=READINESS_REVISION;
  m.compatibility.adapterRevision=READINESS_REVISION;
  m.snapshot.compilerVersion=READINESS_REVISION;
  m.snapshot.id=identity('snapshot',r.sourceRevision,digest(h),digest({...e,speech:[...e.speech].sort((a,b)=>a.id.localeCompare(b.id))}),READINESS_REVISION);
  projectLearningTargetCapabilities(m,b);
  const {snapshot:_,...semantic}=m;m.snapshot.contentDigest=`sha256:${digest(semantic)}`;
  // An offline contract correction must not reuse the previous snapshot address.
  // Content and frozen Step/Block/part identities are unchanged.
  m.snapshot.id=identity('snapshot',m.snapshot.id,m.snapshot.contentDigest);
  const validated=validateLessonManifestV1(m);
  if(!validated.success)for(const error of validated.issues)issue(`readiness.manifest.${error.path}`,error.message);
  for(const error of validatePrivateBindings(m,b,{services:r,source:s,history:h,evidence:e,sourceRevision:r.sourceRevision}))issue('readiness.bindings',error);
  out.report.unsupported.sort((a,b)=>canonical(a).localeCompare(canonical(b)));
  out.nonUiRuntimeReady=out.report.unsupported.every(x=>x.source.path==='runtime.capabilities');
  out.report.runtimeReady=false;
  return out;
}
