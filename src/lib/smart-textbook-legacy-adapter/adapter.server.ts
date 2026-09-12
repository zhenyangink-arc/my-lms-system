import 'server-only';
import { z } from 'zod';
import { legacySourceSchema } from './source.server.ts';
import { identity, digest, canonical, identityMapSchema, walkIdentities, type IdentityVisit } from './identity.server.ts';
import { profile, CHAPTER_ID, ADAPTER_REVISION } from './profile.server.ts';
import { nodeContentSchemas, activityConfigSchemas, teacherConfigurationSchema, mediaMetadataSchema } from './chapter-one-shapes.server.ts';
import { capsuleSchema, contentSectionSchema, activityCapsuleSchema, teacherSectionSchema, teacherSectionKinds, type CompatibilityCapsule, type PrivateBindings } from './capsules.server.ts';
import { classifyTree, record, type ConversionReport, type ConversionEntry } from './report.server.ts';
import { activityRefSchema, type LessonManifestV1, type BlockV1, type StepV1 } from '../smart-textbook-runtime-v1/contracts.ts';
import { validateLessonManifestV1 } from '../smart-textbook-runtime-v1/validator.ts';
import { makeRuntimeTarget } from '../smart-textbook-runtime-v1/targets.ts';
import { validatePrivateBindings } from './bindings.server.ts';
import { projectLearningTargetCapabilities } from './target-semantics.server.ts';

export interface AdapterResult {
  manifest:LessonManifestV1|null;
  bindings:PrivateBindings;
  report:ConversionReport;
}
const emptyBindings=():PrivateBindings=>({identities:[],sourceMetadata:[],mediaMetadata:[],speech:[],activities:[],progress:[],media:[],teaching:[],aliases:[],capsules:[],recordings:[],listening:[]});
const object=(v:unknown):{[key:string]:unknown}=>v && typeof v==='object' && !Array.isArray(v)?v as {[key:string]:unknown}:{};

/** Offline, deterministic, first-chapter only. Does not read/write databases or allocate IDs.
 * A Manifest is a candidate; unsupported conversion and unimplemented renderers block readiness. */
export function adaptChapterOne(input:unknown, frozenIdentities:unknown):AdapterResult {
  const bindings=emptyBindings();
  const report:ConversionReport={chapter:CHAPTER_ID,sourceRevision:'invalid-source',adapterRevision:ADAPTER_REVISION,modulesScanned:0,nodesScanned:0,activitiesScanned:0,mediaScanned:{assets:0,listeningTracks:0,grammarAudio:0,speech:0,recordingDependencies:0},teachingNodesScanned:0,converted:[],preservedInCompat:[],ignoredSafe:[],unsupported:[],warnings:[],runtimeReady:false};
  const issue=(path:string,reason:string,source:Partial<ConversionEntry['source']>={})=>record(report,{source:{...source,path},result:'unsupported',reason});
  // Accept JSON data only; this also bounds cyclic/deep input before Zod recursion.
  try { const json=JSON.stringify(input); if(!json || json.length>2000000) throw Error(); input=JSON.parse(json); } catch {issue('$','Source must be bounded JSON');return{manifest:null,bindings,report};}
  const checked=legacySourceSchema.safeParse(input), ledgerResult=identityMapSchema.safeParse(frozenIdentities);
  if(!checked.success || !ledgerResult.success){
    if(!checked.success)for(const e of checked.error.issues)issue(e.path.join('.'),`Invalid source shape: ${e.message}`);
    if(!ledgerResult.success)issue('identityMap','Invalid frozen identity mapping');
    return{manifest:null,bindings,report};
  }
  const s=checked.data,ledger=ledgerResult.data!;
  // Row arrays are sets with explicit source order columns. Their retrieval order is not identity.
  for(const key of ['modules','nodes','activities','media','lessons','teachingVersions','teachingNodes','speech'] as const)s[key].sort((a,b)=>a.id.localeCompare(b.id));
  s.tracks.sort((a,b)=>a.activity_id.localeCompare(b.activity_id)||a.page_index-b.page_index);
  report.sourceRevision=digest({source:s,profile,identityMap:ledger});
  report.modulesScanned=s.modules.length;report.nodesScanned=s.nodes.length;report.activitiesScanned=s.activities.length;
  report.mediaScanned.assets=s.media.length;report.mediaScanned.listeningTracks=s.tracks.length;report.mediaScanned.speech=s.speech.length;report.teachingNodesScanned=s.teachingNodes.length;
  const revision=`source-${report.sourceRevision.slice(0,32)}`;
  const ids=new Set<string>();
  for(const entry of ledger.entries){if(ids.has(entry.id))issue('identityMap.entries','Duplicate allocated identity');ids.add(entry.id);}
  for(const key of ['modules','nodes','activities','media','lessons','teachingVersions','teachingNodes','speech'] as const){const values=s[key].map(r=>r.id);if(new Set(values).size!==values.length)issue(key,'Duplicate source row identity');}
  if(s.chapter.id!==CHAPTER_ID||s.chapter.chapter_number!==1||s.version.id!==s.chapter.version_id||s.version.textbook_id!==s.textbook.id)issue('chapter','Unsupported chapter or broken textbook/version/chapter relationship');
  if([s.chapter.status,s.version.status,s.textbook.status].some(x=>x!=='published'))issue('status','Expected published first chapter capture');
  const expected=Object.values(profile);
  for(const p of expected){if(!s.modules.some(m=>m.id===p.moduleId))issue('modules',`Missing expected module ${p.moduleId}`);if(!s.nodes.some(n=>n.id===p.nodeId))issue('nodes',`Missing expected node ${p.nodeId}`);for(const a of p.activities)if(!s.activities.some(row=>row.id===a.id))issue('activities',`Missing expected activity ${a.id}`);}
  if(s.modules.length!==8||s.nodes.length!==8||s.activities.length!==19)issue('inventory','First chapter requires 8 modules / 8 nodes / 19 activities');
  const m:LessonManifestV1={schemaVersion:'1.0.0',runtimeContract:'uply-runtime/1',requiredCapabilities:[],snapshot:{id:identity('snapshot',s.chapter.id,revision,ADAPTER_REVISION),contentDigest:`sha256:${'0'.repeat(64)}`,compiledAt:'2026-09-09T00:00:00Z',compilerVersion:ADAPTER_REVISION,scope:'chapter'},textbook:{id:s.textbook.id,slug:s.textbook.slug,title:s.textbook.title,appId:s.textbook.student_app_id},version:{id:s.version.id,number:s.version.version_number},chapter:{id:s.chapter.id,key:s.chapter.slug,number:s.chapter.chapter_number,title:s.chapter.title,scenario:s.chapter.scenario,goal:s.chapter.goal},localization:{defaultLocale:'zh-CN',locales:['zh-CN','ko-KR']},template:{id:identity('template',s.chapter.id,'legacy-classroom'),key:'legacy-classroom',revision:ADAPTER_REVISION},layout:{preset:'split-classroom',desktopRatio:'30-70',splitBreakpoint:'xl',narrowOrder:['teaching','interaction'],teachingCollapsible:true,focusPolicy:'teaching-phase',supportPresentation:'inline',navigationPlacement:'bottom',density:'comfortable'},regions:[{id:'teaching',role:'teaching',parent:null,content:'blocks',allowedBlockTypes:['compat.teacher.v1']},{id:'interaction',role:'interaction',parent:null,content:'regions',allowedBlockTypes:[]},{id:'interaction.main',role:'main',parent:'interaction',content:'blocks',allowedBlockTypes:['compat.learning.v1','multiple_choice']},{id:'navigation',role:'navigation',parent:null,content:'runtime-navigation',allowedBlockTypes:[]}],steps:[],blocks:[],navigation:{region:'navigation',entryStep:s.modules[0]?.id??'missing',items:[],mode:'linear',access:'free',previous:'allowed',autoAdvance:false,resume:'stable-id'},completion:{authority:'server',chapterPolicyRef:identity('progress',s.chapter.id,'chapter')},runtimeTargets:[],mediaRefs:[],activityRefs:[],progressRefs:[],teachingRefs:[],compatibility:{profile:'legacy-adapted',adapterRevision:ADAPTER_REVISION}};
  const progress=(sourceId:string,kind:PrivateBindings['progress'][number]['kind'],parts:string[]=[])=>{const ref=identity('progress',sourceId,kind);m.progressRefs.push({id:ref,kind});bindings.progress.push({ref,kind,sourceId,partIds:parts});return ref;};
  progress(s.chapter.id,'chapter');
  const addTarget=(b:BlockV1,partId:string|null=null)=>{const id=makeRuntimeTarget(b.stepId,b.id,partId);m.runtimeTargets.push({id,stepId:b.stepId,blockId:b.id,partId,capabilities:b.type==='compat.learning.v1'?[]:['reveal','focus','highlight','open'],acceptedEvents:b.type==='multiple_choice'?['opened','response-submitted']:b.type==='compat.learning.v1'?[]:['opened'],verification:b.type==='multiple_choice'?'server-attempt':'ui-only'});return id;};
  const addBlock=(step:StepV1,b:BlockV1)=>{m.blocks.push(b);let r=step.regions.find(r=>r.region===b.region);if(!r)step.regions.push(r={region:b.region,blockIds:[]});r.blockIds.push(b.id);addTarget(b);};
  const classify=(value:unknown,path:string,result:ConversionEntry['result'],reason:string,source:Partial<ConversionEntry['source']>={},target?:ConversionEntry['target'])=>classifyTree(report,value,{source:{...source,path},result,reason,...(target?{target}:{})});
  for(const key of ['textbook','version','chapter'] as const)classify(s[key],key,'converted','Identity/display and published source dependency projected',{}, {ref:m.chapter.id});
  const partMaps=new Map<string,Map<string,string>>();
  const scannedIdentities=(owner:string,value:unknown,root:string,source:Partial<ConversionEntry['source']>)=>{
    const visits:IdentityVisit[]=[];walkIdentities(owner,value,root,ledger,e=>visits.push(e),(p,r)=>issue(p,r,source));
    for(const v of visits)bindings.identities.push({owner,legacyPath:v.path,partId:v.id});
    const map=partMaps.get(owner)??new Map<string,string>();visits.forEach(v=>map.set(v.path,v.id));partMaps.set(owner,map);return visits;
  };
  const activityConfigs=new Map<string,z.infer<typeof activityCapsuleSchema>>();
  for(const a of s.activities){
    const source={activityId:a.id,nodeId:a.node_id};const expectedActivity=expected.flatMap<{id:string;key:string;type:string}>(p=>[...p.activities]).find(e=>e.id===a.id);
    if(!s.nodes.some(n=>n.id===a.node_id))issue('node_id','Dangling activity node',source);
    if(!expectedActivity||expectedActivity.key!==a.activity_key||expectedActivity.type!==a.activity_type)issue('activity_type','Unsupported activity identity/key/type',source);
    const expectedOwner=expected.find(p=>p.activities.some(e=>e.id===a.id));
    if(expectedOwner&&a.node_id!==expectedOwner.nodeId)issue('node_id','Activity moved outside its first-chapter source scope',source);
    const schema=activityConfigSchemas[a.activity_key as keyof typeof activityConfigSchemas];const config=schema?.safeParse(a.public_config);
    if(!config?.success){classify(a.public_config,'public_config','unsupported','Activity config has unknown/invalid fields',source);}
    else{activityConfigs.set(a.id,activityCapsuleSchema.parse({activityKey:a.activity_key,activityId:a.id,settings:config.data}));classify(config.data,'public_config','preserved-in-compat','Closed activity-specific settings; no grading changes',source,{ref:a.id});}
    scannedIdentities(a.id,a.public_config,'public_config',source);scannedIdentities(a.id,a.options,'options',source);
    const c=object(a.public_config);const settings=['single_choice','multiple_choice','ordering'].includes(a.activity_type)?{shuffle:typeof c.shuffle==='boolean'?c.shuffle:false,showScore:typeof c.showScore==='boolean'?c.showScore:true}:a.activity_type==='speaking'||a.activity_type==='writing'?{rubric:[]}:a.activity_type==='self_check'?{items:[]}:{showScore:typeof c.showScore==='boolean'?c.showScore:true};
    const options=a.options.map((text,index)=>({id:partMaps.get(a.id)?.get(`options[${index}]`)??'missing-identity',text:{'ko-KR':text}}));
    const publicRef=activityRefSchema.safeParse({id:a.id,activityId:a.id,revision,type:a.activity_type,publicPresentation:{prompt:a.prompt,instruction:a.instruction,options,settings}});
    if(publicRef.success)m.activityRefs.push(publicRef.data);else issue('activityRef','Activity public projection rejected',source);
    bindings.activities.push({ref:a.id,activityId:a.id,versionId:s.version.id,maxAttempts:a.max_attempts,countsTowardCompletion:a.counts_toward_completion});
    for(const [key,v] of Object.entries(a))if(key!=='public_config')classify(v,key,'converted','Public activity reference / private domain binding',source,{ref:a.id});
    progress(a.id,'activity');
    if(a.activity_type==='speaking'){bindings.recordings.push({activityId:a.id,versionId:s.version.id,evidenceService:'existing-recordings',practice:a.activity_key==='dialogue-roleplay'?'role-play':'speaking'});report.mediaScanned.recordingDependencies++;}
  }
  const learningCapsules=new Map<string,Extract<CompatibilityCapsule,{kind:'learning'}>>();
  for(const mod of [...s.modules].sort((a,b)=>a.sort_order-b.sort_order)){
    const p=profile[mod.module_code as keyof typeof profile];if(!p||p.moduleId!==mod.id||mod.chapter_id!==s.chapter.id){classify(mod,'module','unsupported','Unknown or mismatched first-chapter module',{moduleId:mod.id});continue;}
    const node=s.nodes.find(n=>n.module_id===mod.id);if(!node)continue;
    const source={moduleId:mod.id,nodeId:node.id};const blockId=identity('block',node.id,'learning'),capsuleId=identity('capsule',node.id,'learning');
    bindings.sourceMetadata.push({kind:'module',id:mod.id,title:mod.title,description:mod.description,accent:mod.accent_role,order:mod.sort_order},{kind:'node',id:node.id,title:node.title,nodeType:node.node_type,minutes:node.estimated_minutes,order:node.sort_order});
    const visits=scannedIdentities(node.id,node.content,'content',source);
    const panels=p.pages.map((key,i)=>({id:identity('panel',mod.id,key),legacyPageKey:key,title:p.pageLabels[i]}));
    const parts=[...panels.map(p=>({id:p.id,title:p.title})),...visits.map(v=>({id:v.id,title:node.title}))];
    const nodeProgress=progress(node.id,'node');
    const step:StepV1={id:mod.id,key:mod.module_code,title:p.title,order:mod.sort_order,regions:[],completion:{kind:'server',policyRef:nodeProgress},nextStep:null,teachingRef:null};m.steps.push(step);
    classify(mod,'module','converted','Step order, student title override and frozen compatibility profile',source,{step:step.id});
    for(const[key,v]of Object.entries(node))if(key!=='content')classify(v,key,'converted','Node binding retained as source identity / display metadata',source,{step:step.id,block:blockId});
    const content=object(node.content), shape=nodeContentSchemas[mod.module_code as keyof typeof nodeContentSchemas];
    const parsed=shape.safeParse(content);
    const sections:z.infer<typeof contentSectionSchema>[]=[];
    for(const[key,v]of Object.entries(content)){
      const section=contentSectionSchema.safeParse({slot:key,body:v,partId:identity('slot',node.id,key)});
      const allowed=key in shape.shape;
      if(!allowed||!section.success)classify(v,`content.${key}`,'unsupported','Unknown content key or value not accepted by closed compatibility DTO',source);
      else{sections.push(section.data);parts.push({id:section.data.partId,title:node.title});classify(v,`content.${key}`,'preserved-in-compat','Explicit versioned semantic slot; no raw node JSON',source,{step:step.id,block:blockId,part:section.data.partId,capsule:capsuleId});}
    }
    if(!parsed.success)for(const e of parsed.error.issues)issue(`content.${e.path.join('.')}`,'Invalid required content shape',source);
    const activities=s.activities.filter(a=>a.node_id===node.id).sort((a,b)=>a.sort_order-b.sort_order);
    const capsule:Extract<CompatibilityCapsule,{kind:'learning'}>={kind:'learning',schemaVersion:'compat.learning/1',id:capsuleId,stepId:step.id,nodeId:node.id,revision,sections,activities:activities.flatMap(a=>activityConfigs.has(a.id)?[activityConfigs.get(a.id)!]:[]),panels,contentSlots:[...p.contentSlots],activitySlots:[...p.activitySlots],completionWeights:'completionWeights'in p?[...p.completionWeights]:[]};
    bindings.capsules.push(capsuleSchema.parse(capsule));learningCapsules.set(node.id,capsule);
    const pageRef=progress(node.id,'activity-page',panels.map(p=>p.id));
    const progressRefs=[nodeProgress,pageRef];
    if(mod.module_code==='listen_speak')progressRefs.push(progress(activities.find(a=>a.activity_type==='speaking')?.id??node.id,'guided-repeat',visits.filter(v=>v.path.startsWith('content.repeatTracks')).map(v=>v.id)));
    const b:BlockV1={id:blockId,stepId:step.id,type:'compat.learning.v1',region:'interaction.main',order:1,title:node.title,props:{capsuleRef:capsuleId,activityRefs:mod.module_code==='orientation'?[]:activities.map(a=>a.id),progressRefs,parts},completion:{kind:'server',policyRef:nodeProgress},runtimeTarget:makeRuntimeTarget(step.id,blockId)};
    addBlock(step,b);parts.forEach(p=>addTarget(b,p.id));
    panels.forEach(p=>bindings.aliases.push({moduleId:mod.id,legacyKey:`${mod.module_code}:page:${p.legacyPageKey}`,target:makeRuntimeTarget(step.id,blockId,p.id),event:null}));
    for(const a of activities){
      let target=b.runtimeTarget;
      if(mod.module_code==='orientation'){
        const questionId=identity('block',a.id,'question');target=makeRuntimeTarget(step.id,questionId);
        addBlock(step,{id:questionId,stepId:step.id,type:'multiple_choice',region:'interaction.main',order:a.sort_order+1,title:a.prompt,props:{activityRef:a.id,presentation:'single'},completion:{kind:'server',policyRef:identity('progress',a.id,'activity')},runtimeTarget:target});
      }
      bindings.aliases.push({moduleId:mod.id,legacyKey:`activity:${a.id}`,target,event:'response-submitted'});
    }
    // Exact legacy dialogue index aliases are lookup-only, never used to construct new identity.
    if(mod.module_code==='orientation')for(const v of visits){const match=/^content\.dialogueGroups\[(\d+)\]\.lines\[(\d+)\]$/.exec(v.path);if(match){const groups=content.dialogueGroups as Array<{id:string}>;bindings.aliases.push({moduleId:mod.id,legacyKey:`dialogue:${groups[Number(match[1])].id}:${match[2]}`,target:makeRuntimeTarget(step.id,blockId,v.id),event:'audio_completed'});}}
  }
  for(const node of s.nodes){if(!s.modules.some(mod=>mod.id===node.module_id))issue('module_id','Dangling node module',{nodeId:node.id});}
  for(const node of s.nodes){const c=object(node.content);if(typeof c.nextNode==='string'&&c.nextNode&&c.nextNode!=='chapter-test'&&!s.nodes.some(n=>n.node_code===c.nextNode))issue('content.nextNode','Unresolved legacy next node destination',{nodeId:node.id});}
  m.steps.forEach((step,i)=>step.nextStep=m.steps[i+1]?.id??null);m.navigation.items=m.steps.map(s=>s.id);m.navigation.entryStep=m.steps[0]?.id??'missing';
  const mediaKeys=new Map(s.media.map(a=>[a.asset_key,a]));
  for(const a of s.media){const source={nodeId:a.node_id,mediaId:a.id};
    if(!s.nodes.some(n=>n.id===a.node_id))issue('node_id','Dangling media node',source);
    if(!['audio','image'].includes(a.media_type)||!['ready','pending','rejected'].includes(a.production_status))issue('media','Unsupported media type/status',source);
    const alt=Object.fromEntries(Object.entries(a.alt_text).filter(([,v])=>typeof v==='string'&&v.trim())) as {'zh-CN'?:string;'ko-KR'?:string};
    if(!Object.keys(alt).length){alt['zh-CN']=a.media_type==='audio'?'跟读音频':'教材图片';issue('alt_text','Source alt text missing; explicit fallback used in candidate',source);}
    const ref=identity('media',a.id);m.mediaRefs.push({id:ref,kind:a.media_type==='image'?'image':'audio',revision,readiness:a.production_status==='ready'?'ready':a.production_status==='rejected'?'rejected':'pending',access:'lesson',language:a.media_type==='audio'?'ko-KR':null,alt});
    bindings.media.push({ref,sourceId:a.id,objectKey:a.object_key,revision,access:'lesson'});
    const metadata=mediaMetadataSchema.safeParse(a.metadata);
    if(metadata.success){bindings.mediaMetadata.push({ref,assetKey:a.asset_key,purpose:a.purpose,data:metadata.data});classify(metadata.data,'metadata','preserved-in-compat','Closed private media metadata DTO preserves hotspots/timing/visibility; never public Manifest',source,{ref});}
    else classify(a.metadata,'metadata','unsupported','Unknown/invalid media metadata',source,{ref});
    for(const[key,v]of Object.entries(a))if(key!=='metadata')classify(v,key,'converted',key==='object_key'?'Private media binding only; never public Manifest':'Media reference / private binding',source,{ref});
    if(a.production_status==='ready'&&!a.object_key)issue('object_key','Ready media missing object location',source);
  }
  // Scan every nested explicit media reference. audioId is a legacy asset key, not Runtime identity.
  const scanMedia=(value:unknown,path:string,source:Partial<ConversionEntry['source']>)=>{
    const walk=(v:unknown,p:string):void=>{if(!v||typeof v!=='object')return;for(const[k,c]of Object.entries(v)){
      const childPath=Array.isArray(v)?`${p}[${k}]`:`${p}.${k}`;
      if(['audioId','audioAssetKey','audio'].includes(k)&&typeof c==='string'&&c){report.mediaScanned.grammarAudio+=source.nodeId===profile.grammar.nodeId?1:0;if(!mediaKeys.has(c))issue(childPath,'Unresolved explicit legacy media reference',source);}
      walk(c,childPath);
    }};walk(value,path);
  };
  for(const n of s.nodes)scanMedia(n.content,'content',{nodeId:n.id});for(const a of s.activities)scanMedia(a.public_config,'public_config',{activityId:a.id,nodeId:a.node_id});
  for(const t of s.tracks){const match=ledger.tracks.filter(x=>x.activityId===t.activity_id&&x.legacyPage===t.page_index&&x.sourceAudioDigest===digest(t.audio_object_key));
    const a=s.activities.find(a=>a.id===t.activity_id);if(!a||a.activity_type!=='listening')issue('tracks.activity_id','Dangling/non-listening activity',{activityId:t.activity_id});
    if(match.length!==1){issue('tracks','Listening track needs frozen identity rebinding',{activityId:t.activity_id});continue;}
    const ref=match[0].id;m.mediaRefs.push({id:ref,kind:'audio',revision,readiness:t.audio_status==='ready'?'ready':'pending',access:'lesson',language:'ko-KR',alt:{'zh-CN':'听力音轨','ko-KR':'듣기 음원'}});
    bindings.media.push({ref,sourceId:ref,objectKey:t.audio_object_key,revision,access:'lesson'});bindings.listening.push({ref,activityId:t.activity_id,legacyPage:t.page_index,audioRef:ref,transcriptAccess:'existing-authorized-service'});
    classify(t,'listeningTrack','converted','Frozen track ID; legacy page only in private binding; transcript remains authorized service',{activityId:t.activity_id},{ref});
  }
  for(const lesson of s.lessons){if(!s.modules.some(m=>m.id===lesson.module_id))issue('lessons.module_id','Dangling teaching lesson');classify(lesson,'lesson','converted','Teaching module dependency');}
  for(const version of s.teachingVersions){const lesson=s.lessons.find(l=>l.id===version.lesson_id),step=m.steps.find(s=>s.id===lesson?.module_id);if(!step){issue('teachingVersions','Dangling teaching lesson/Step');continue;}
    if(version.version_number!==23||version.status!=='published')issue('teachingVersions','Expected legacy published v23');
    const nodes=s.teachingNodes.filter(n=>n.script_version_id===version.id).sort((a,b)=>a.sort_order-b.sort_order);
    if(nodes.length!==8)issue('teachingNodes','Expected all eight v23 nodes');
    const ref=identity('teaching',version.id),capsuleId=identity('capsule',version.id,'teacher'),blockId=identity('block',lesson!.id,'teacher');
    step.teachingRef=ref;const entry=nodes[0]?.id??'missing';m.teachingRefs.push({id:ref,revision:version.id,mode:'legacy',entryCueId:entry});bindings.teaching.push({ref,scriptVersionId:version.id,entryCueId:entry,capsuleRef:capsuleId});
    const capsule:Extract<CompatibilityCapsule,{kind:'teacher'}>={kind:'teacher',schemaVersion:'compat.teacher/1',id:capsuleId,stepId:step.id,revision:version.id,nodes:[]};
    for(const n of nodes){const source={moduleId:step.id,teachingNodeId:n.id};const parsed=teacherConfigurationSchema.safeParse(n.configuration);
      if(!parsed.success){classify(n.configuration,'configuration','unsupported','Invalid/unknown teacher configuration',source);continue;}
      const config=parsed.data;if(config.virtualCharacter.kind!=='uply-teacher')issue('configuration.virtualCharacter','Unsupported legacy character',source);
      const sections:z.infer<typeof teacherSectionSchema>[]=[];
      for(const[key,value]of Object.entries(config)){const kind=teacherSectionKinds[key as keyof typeof teacherSectionKinds];const section=teacherSectionSchema.safeParse({kind,body:value});if(!section.success){classify(value,`configuration.${key}`,'unsupported','Unsupported teacher section',source);continue;}sections.push(section.data);classify(value,`configuration.${key}`,'preserved-in-compat','Versioned teacher section; pose/coordinates/blackboard never native props',source,{step:step.id,block:blockId,capsule:capsuleId});}
      for(const performance of config.scriptPerformances??[])if(!['greeting','explaining','encouraging','pointing-left','repeat-after-me','listening','gentle-correction'].includes(performance.pose))issue('configuration.scriptPerformances.pose','Unsupported character pose',source);
      for(const task of [config.studentTask,config.visualCue])if(task){const alias=bindings.aliases.find(a=>a.moduleId===step.id&&a.legacyKey===task.targetKey);if(!alias)issue('configuration.targetKey','Legacy target cannot be mapped',source);else if('eventType'in task)issue('configuration.studentTask','Target identity mapped, but compatibility target cannot declare playable media under current Registry; task event bridge unsupported',source);}
      if(n.reference_activity_id&&!s.activities.some(a=>a.id===n.reference_activity_id))issue('reference_activity_id','Dangling teaching activity',source);
      for(const key of [n.next_node_key,n.remediation_node_key])if(key&&!nodes.some(n=>n.node_key===key))issue('next_node_key','Dangling teaching transition',source);
      for(const[key,value]of Object.entries(n))if(key!=='configuration')classify(value,key,'preserved-in-compat','Fixed teacher node DTO',source,{capsule:capsuleId});
      capsule.nodes.push({id:n.id,key:n.node_key,nodeType:n.node_type,title:n.title,teacherScript:n.teacher_script,sections,activityRef:n.reference_activity_id,action:n.action_type,nextKey:n.next_node_key,remediationKey:n.remediation_node_key,required:n.is_required});
    }
    bindings.capsules.push(capsuleSchema.parse(capsule));classify(version,'teachingVersion','converted','Fixed legacy teaching revision',{}, {ref});
    addBlock(step,{id:blockId,stepId:step.id,type:'compat.teacher.v1',region:'teaching',order:1,props:{teachingRef:ref,capsuleRef:capsuleId},completion:{kind:'none'},runtimeTarget:makeRuntimeTarget(step.id,blockId)});
  }
  for(const n of s.teachingNodes)if(!s.teachingVersions.some(v=>v.id===n.script_version_id))issue('script_version_id','Dangling teaching node',{teachingNodeId:n.id});
  for(const a of s.speech){if(!s.teachingNodes.some(n=>n.id===a.script_node_id))issue('speech.script_node_id','Dangling speech node');bindings.speech.push({id:a.id,scriptNodeId:a.script_node_id,locale:a.locale,segmentIndex:a.segment_index,contentHash:a.content_hash,durationMs:a.duration_ms,status:a.production_status});classify(a,'speech','preserved-in-compat','Closed private speech dependency; existing speech service retains authorized bytes',{teachingNodeId:a.script_node_id,mediaId:a.id});}
  issue('speech.voiceTimeline','Voice timeline/segment consistency and current speech resolver authorization not verified by this capture');
  issue('progress.activity-page','Module panels are identified, but legacy activity-page item grouping/aggregation needs equivalence verification; node-level panel binding is not an activity-page service binding');
  issue('progress.guided-repeat','Repeat track/segment identities preserved; legacy activity/track_index/segment_index service mapping not yet certified');
  m.requiredCapabilities=['layout.v1','navigation.linear.v1','progress.server.v1',...new Set(m.blocks.map(b=>`block.${b.type}`))].sort();
  projectLearningTargetCapabilities(m,bindings);
  const {snapshot:_,...semantic}=m;m.snapshot.contentDigest=`sha256:${digest(semantic)}`;
  m.snapshot.id=identity('snapshot',m.snapshot.id,m.snapshot.contentDigest);
  const validated=validateLessonManifestV1(m,{requireBindings:true,resolveBinding:(kind,ref,owner)=>kind==='capsule'?bindings.capsules.some(c=>c.id===ref&&(c.kind==='learning'?identity('block',c.nodeId,'learning')===owner:bindings.teaching.some(t=>t.ref===owner&&t.capsuleRef===ref))):kind==='teaching-cue'?bindings.teaching.some(t=>t.ref===owner&&t.entryCueId===ref):false});
  if(!validated.success)for(const e of validated.issues)issue(`manifest.${e.path}`,e.message);
  else for(const e of validatePrivateBindings(validated.data,bindings))issue('bindings',e);
  issue('runtime.capabilities','All Runtime/compatibility renderers remain unimplemented; candidate cannot activate');
  report.warnings.push('Capture is read-only, not an atomic publication snapshot. No production readiness is asserted.');
  // Unsupported wins for an exact source field; never silently relabel it as a warning.
  const blocked=new Set(report.unsupported.map(e=>canonical(e.source)));
  report.converted=report.converted.filter(e=>!blocked.has(canonical(e.source)));
  report.preservedInCompat=report.preservedInCompat.filter(e=>!blocked.has(canonical(e.source)));
  // Prefer the most specific frozen entity target over the enclosing semantic slot.
  for(const e of report.preservedInCompat){
    const owner=e.source.nodeId,paths=owner?partMaps.get(owner):undefined;
    if(!paths||!e.target?.block)continue;
    const match=[...paths.entries()].filter(([p])=>e.source.path===p||e.source.path.startsWith(`${p}.`)).sort((a,b)=>b[0].length-a[0].length)[0];
    if(match)e.target={...e.target,part:match[1]};
  }
  for(const key of ['converted','preservedInCompat','ignoredSafe','unsupported'] as const)report[key].sort((a,b)=>canonical(a).localeCompare(canonical(b)));
  return{manifest:validated.success?validated.data:null,bindings,report};
}
