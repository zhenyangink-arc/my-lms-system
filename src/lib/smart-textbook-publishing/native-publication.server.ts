import 'server-only';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { canonical, digest } from '../smart-textbook-legacy-adapter/identity.server.ts';
import { localizedTextSchema, type LessonManifestV1, type BlockV1 } from '../smart-textbook-runtime-v1/contracts.ts';
import { validateLessonManifestV1 } from '../smart-textbook-runtime-v1/validator.ts';
import { makeRuntimeTarget } from '../smart-textbook-runtime-v1/targets.ts';
import { dependencyCaptureSchema, type DependencyCapture } from './capture.server.ts';
import type { PublicationScope } from './artifact.server.ts';

export const nativePublicationRevision = 'publish-foundation/2' as const;
export const nativeCompilerVersion = 'native-publication-1' as const;
const uuid = z.uuid(), L = localizedTextSchema;
const row = z.object({ id: uuid });
const bookSchema = row.extend({ lesson_id: uuid, student_app_id: uuid, agent_profile_id: uuid, slug: z.string(), title: L, status: z.literal('published') });
const versionSchema = row.extend({ textbook_id: uuid, version_number: z.number().int().positive(), status: z.literal('published') });
const chapterSchema = row.extend({ version_id: uuid, slug: z.string(), chapter_number: z.number().int().nonnegative(), title: L, scenario: L, goal: L, status: z.literal('published'), chapter_test_id:z.null().optional() });
const moduleSchema = row.extend({ chapter_id: uuid, sort_order: z.number().int().positive() });
const nodeSchema = row.extend({ module_id: uuid, sort_order: z.number().int().positive(), node_type:z.enum(['learn','practice','mission','review']), content: z.strictObject({}) });
const activitySchema = row.extend({ node_id: uuid, activity_key: z.string().min(1), activity_type: z.literal('single_choice'), prompt: L, instruction: L,
 options: z.array(z.union([z.string().min(1), L])).min(2).max(100), public_config: z.strictObject({ shuffle: z.boolean().optional(), showScore: z.boolean().optional() }),
 max_attempts: z.number().int().min(1).max(20), counts_toward_completion: z.boolean() });
const lessonSchema = row.extend({ module_id: uuid, agent_profile_id: uuid, status: z.literal('published') });
const scriptSchema = row.extend({ lesson_id: uuid, version_number: z.number().int().positive(), status: z.literal('published') });
const sourceNodeSchema = row.extend({ script_version_id: uuid, sort_order: z.number().int().positive(), title: L, teacher_script: L,
 node_key: z.string().min(1), node_type:z.enum(['opening','explanation','example','question','instruction','summary']), is_required:z.boolean(), configuration: z.strictObject({}), reference_activity_id: uuid.nullable(), action_type: z.enum(['none','focus_activity']),
 next_node_key: z.string().nullable().optional(), remediation_node_key: z.null().optional(),
 video_mode: z.literal('legacy').optional(), segments: z.array(z.never()).optional() });
const secretSchema = z.object({ activity_id: uuid, answer_key: z.strictObject({ kind: z.literal('index'), value: z.number().int().nonnegative() }) });
function one<T>(items: T[], predicate: (value:T)=>boolean): T { const values=items.filter(predicate);if(values.length!==1)throw Error('NATIVE_PUBLICATION_ASSOCIATION');return values[0]; }
function unique(items: {id:string}[]) { if(new Set(items.map(x=>x.id)).size!==items.length)throw Error('NATIVE_PUBLICATION_DUPLICATE'); }
function requiredEmpty(value:unknown) { if(value!==undefined && value!==null && value!==false && value!=='' && !(Array.isArray(value)&&!value.length) && !(typeof value==='object'&&!Array.isArray(value)&&!Object.keys(value).length))throw Error('NATIVE_PUBLICATION_UNSUPPORTED_MEDIA'); }
/** Pure projection of ONE official SQL capture. No DB client, legacy reader,
 * fixed chapter identity, runtime cursor, publication store or write capability. */
export function projectNativePublicationCapture(input:unknown, scope:PublicationScope) {
 const dependencies=dependencyCaptureSchema.parse(input);
 const textbook=one(dependencies.digital_textbooks,x=>x.id===scope.textbookId);
 if(dependencies.digital_textbooks.length!==1||dependencies.digital_textbook_versions.length!==1||dependencies.digital_textbook_chapters.length!==1)throw Error('NATIVE_PUBLICATION_CAPTURE_SCOPE');
 const book=bookSchema.parse(textbook),version=versionSchema.parse(dependencies.digital_textbook_versions[0]),chapter=chapterSchema.parse(dependencies.digital_textbook_chapters[0]);
 if(version.id!==scope.versionId||version.textbook_id!==book.id||chapter.id!==scope.chapterId||chapter.version_id!==version.id)throw Error('NATIVE_PUBLICATION_GRAPH');
 const modules=dependencies.digital_textbook_modules.map(x=>moduleSchema.parse(x));
 const nodes=dependencies.digital_textbook_nodes.map(x=>nodeSchema.parse(x));
 const activities=dependencies.digital_textbook_activities.map(x=>activitySchema.parse(x));
 const lessons=dependencies.learning_agent_lessons.map(x=>lessonSchema.parse(x));
 const scripts=dependencies.learning_agent_script_versions.map(x=>scriptSchema.parse(x));
 const teachingNodes=dependencies.learning_agent_script_nodes.map(x=>sourceNodeSchema.parse(x));
 for(const items of [modules,nodes,activities,lessons,scripts,teachingNodes])unique(items);
 if(!modules.length||!nodes.length||!teachingNodes.length)throw Error('NATIVE_PUBLICATION_EMPTY_GRAPH');
 for(const table of ['digital_textbook_media_assets','digital_textbook_listening_tracks','learning_agent_script_audio_assets','learning_agent_node_interaction_secrets','chapter_tests'] as const)if(dependencies[table].length)throw Error('NATIVE_PUBLICATION_UNSUPPORTED_MEDIA');
 // Authored media/cue requirements must be rejected, never projected away.
 for(const n of dependencies.learning_agent_script_nodes){
  for(const key of ['video_asset_id','video_url','audio_asset_id','audio_url','cue_points','cues','interaction','interaction_config','required_video','required_audio','required_speech','required_listening','required_cue'])requiredEmpty(n[key]);
 }
 const profile=one(dependencies.learning_agent_profiles,x=>x.id===book.agent_profile_id);
 if(profile.status!=='published'||dependencies.learning_agent_profiles.length!==1)throw Error('NATIVE_PUBLICATION_PROFILE');
 if(new Set(modules.map(m=>m.sort_order)).size!==modules.length)throw Error('NATIVE_PUBLICATION_SEQUENCE');
 for(const m of modules){const ordered=nodes.filter(n=>n.module_id===m.id);if(new Set(ordered.map(n=>n.sort_order)).size!==ordered.length)throw Error('NATIVE_PUBLICATION_SEQUENCE');if(m.chapter_id!==chapter.id)throw Error('NATIVE_PUBLICATION_MODULE');one(lessons,x=>x.module_id===m.id);}
 for(const l of lessons){one(modules,x=>x.id===l.module_id);if(l.agent_profile_id!==book.agent_profile_id)throw Error('NATIVE_PUBLICATION_PROFILE');one(scripts,x=>x.lesson_id===l.id);}
 for(const s of scripts)one(lessons,x=>x.id===s.lesson_id);
 for(const n of nodes)one(modules,x=>x.id===n.module_id);
 for(const t of teachingNodes)one(scripts,x=>x.id===t.script_version_id);
 for(const script of scripts){
  const sequence=teachingNodes.filter(n=>n.script_version_id===script.id).sort((a,b)=>a.sort_order-b.sort_order);
  if(new Set(sequence.map(n=>n.node_key)).size!==sequence.length||new Set(sequence.map(n=>n.sort_order)).size!==sequence.length)throw Error('NATIVE_PUBLICATION_SEQUENCE');
  for(const [i,n] of sequence.entries())if(n.next_node_key!=null&&n.next_node_key!==sequence[i+1]?.node_key)throw Error('NATIVE_PUBLICATION_UNSUPPORTED_BRANCH');
 }
 const secrets=dependencies.digital_textbook_activity_secrets.map(x=>secretSchema.parse(x));
 if(secrets.length!==activities.length)throw Error('NATIVE_PUBLICATION_SECRET_SCOPE');
 const bindings=activities.map(a=>{
  const n=one(nodes,x=>x.id===a.node_id),source=one(teachingNodes,x=>x.reference_activity_id===a.id),script=one(scripts,x=>x.id===source.script_version_id),lesson=one(lessons,x=>x.id===script.lesson_id);
  if(lesson.module_id!==n.module_id)throw Error('NATIVE_PUBLICATION_ACTIVITY_GRAPH');
  const secret=one(secrets,x=>x.activity_id===a.id);if(secret.answer_key.value>=a.options.length)throw Error('NATIVE_PUBLICATION_SECRET_INVALID');
  return {activityId:a.id,activityAlias:a.activity_key,executionNodeId:n.id,sourceTeachingNodeId:source.id,moduleId:n.module_id,teachingLessonId:lesson.id,scriptVersionId:script.id,scriptVersion:script.version_number,countsTowardCompletion:a.counts_toward_completion};
 });
 for(const t of teachingNodes){if(t.reference_activity_id!==null)one(activities,x=>x.id===t.reference_activity_id);else if(t.action_type==='focus_activity')throw Error('NATIVE_PUBLICATION_ASSOCIATION');}
 for(const n of nodes){const selected=activities.filter(a=>a.node_id===n.id);if(selected.filter(a=>a.counts_toward_completion).length>1)throw Error('NATIVE_PUBLICATION_NODE_AGGREGATION');}
 const source={book,version,chapter,modules,nodes,activities,lessons,scripts,teachingNodes};
 return {source,bindings,dependencies};
}
export type NativePublicationCapture=ReturnType<typeof projectNativePublicationCapture>;
export type NativePublicationBinding=NativePublicationCapture['bindings'][number];
/** Safe semantic projection shared by producer and certifier. Private capture and
 * secrets never enter the Manifest or its public content digest. */
function nativeSemantic(c:NativePublicationCapture):Omit<LessonManifestV1,'snapshot'> {
 const s=c.source, ordered=[...s.teachingNodes].sort((a,b)=>{
  const moduleOrder=(id:string)=>one(s.modules,m=>m.id===one(s.lessons,l=>l.id===one(s.scripts,v=>v.id===id).lesson_id).module_id).sort_order;
  return moduleOrder(a.script_version_id)-moduleOrder(b.script_version_id)||a.sort_order-b.sort_order||a.id.localeCompare(b.id);
 });
 const blocks:BlockV1[]=[],steps:LessonManifestV1['steps']=[],runtimeTargets:LessonManifestV1['runtimeTargets']=[],progressRefs:LessonManifestV1['progressRefs']=[{id:`chapter-${s.chapter.id}`,kind:'chapter'}];
 for(const [i,t] of ordered.entries()){
  const stepId=t.id,textId=`text-${t.id}`,activity=t.reference_activity_id?one(s.activities,a=>a.id===t.reference_activity_id):null;
  const binding=activity?one(c.bindings,b=>b.activityId===activity.id):null;
  const textTarget=makeRuntimeTarget(stepId,textId);
  blocks.push({id:textId,stepId,region:'teaching',order:1,type:'text',props:{paragraphs:[t.teacher_script]},completion:{kind:'none'},runtimeTarget:textTarget});
  runtimeTargets.push({id:textTarget,stepId,blockId:textId,partId:null,capabilities:['reveal','focus'],acceptedEvents:['opened'],verification:'ui-only'});
  const activityIds:string[]=[];
  if(activity){const id=`choice-${activity.id}`,target=makeRuntimeTarget(stepId,id),progressId=`activity-${activity.id}`;activityIds.push(id);
   progressRefs.push({id:progressId,kind:'activity'});
   blocks.push({id,stepId,region:'interaction.main',order:1,type:'multiple_choice',props:{activityRef:activity.id,presentation:'single'},completion:activity.counts_toward_completion?{kind:'server',policyRef:progressId}:{kind:'none'},runtimeTarget:target});
   runtimeTargets.push({id:target,stepId,blockId:id,partId:null,capabilities:['reveal','focus'],acceptedEvents:['response-submitted'],verification:'server-attempt'});
  }
  const nodeRef=binding?`node-${binding.executionNodeId}`:null;
  if(nodeRef&&!progressRefs.some(p=>p.id===nodeRef))progressRefs.push({id:nodeRef,kind:'node'});
  steps.push({id:stepId,key:stepId,title:t.title,order:i+1,regions:[{region:'teaching',blockIds:[textId]},{region:'interaction.main',blockIds:activityIds}],completion:binding?.countsTowardCompletion&&nodeRef?{kind:'server',policyRef:nodeRef}:{kind:'none'},nextStep:ordered[i+1]?.id??null,teachingRef:null});
 }
 return {schemaVersion:'1.0.0',runtimeContract:'uply-runtime/1',requiredCapabilities:['layout.v1','navigation.linear.v1','progress.server.v1','block.text',...(s.activities.length?['block.multiple_choice']:[])],
 textbook:{id:s.book.id,slug:s.book.slug,title:s.book.title,appId:s.book.student_app_id},version:{id:s.version.id,number:s.version.version_number},
 chapter:{id:s.chapter.id,key:s.chapter.slug,number:s.chapter.chapter_number,title:s.chapter.title,scenario:s.chapter.scenario,goal:s.chapter.goal},localization:{defaultLocale:'zh-CN',locales:['zh-CN','ko-KR']},
 template:{id:'native-classroom',key:'native-classroom',revision:'native-publication-1'},layout:{preset:'stacked-classroom',desktopRatio:'40-60',splitBreakpoint:'xl',narrowOrder:['teaching','interaction'],teachingCollapsible:true,focusPolicy:'manual',supportPresentation:'inline',navigationPlacement:'bottom',density:'comfortable'},
 regions:[{id:'teaching',role:'teaching',parent:null,content:'blocks',allowedBlockTypes:['text']},{id:'interaction',role:'interaction',parent:null,content:'regions',allowedBlockTypes:[]},{id:'interaction.main',role:'main',parent:'interaction',content:'blocks',allowedBlockTypes:['multiple_choice']},{id:'navigation',role:'navigation',parent:null,content:'runtime-navigation',allowedBlockTypes:[]}],
 steps,blocks,navigation:{region:'navigation',entryStep:steps[0].id,items:steps.map(s=>s.id),mode:'linear',access:'free',previous:'allowed',autoAdvance:false,resume:'stable-id'},completion:{authority:'server',chapterPolicyRef:`chapter-${s.chapter.id}`},runtimeTargets,mediaRefs:[],
 activityRefs:s.activities.map(a=>({id:a.id,activityId:a.id,revision:`activity-${digest({id:a.id,prompt:a.prompt,options:a.options,config:a.public_config})}`,type:'single_choice',publicPresentation:{prompt:a.prompt,instruction:a.instruction,options:a.options.map((text,i)=>({id:`option-${i}`,text:typeof text==='string'?{'zh-CN':text,'ko-KR':text}:text})),settings:{shuffle:a.public_config.shuffle??false,showScore:a.public_config.showScore??false}}})),progressRefs,teachingRefs:[],compatibility:{profile:'native',adapterRevision:null}};
}
export type NativePublicationBundle={revision:typeof nativePublicationRevision;publicationKind:'canonical-native';snapshotId:string;scope:PublicationScope;schemaVersion:'1.0.0';runtimeContract:'uply-runtime/1';manifestDigest:string;sourceRevision:string;compilerVersion:typeof nativeCompilerVersion;manifest:LessonManifestV1;privatePayload:{contract:'canonical-native-publication/1';source:NativePublicationCapture['source'];bindings:NativePublicationBinding[];dependencies:DependencyCapture;result:{manifest:LessonManifestV1;report:{sourceRevision:string}}};privateDigest:string;pins:{captureDigest:string;sourceRevision:string};seal:string};
const sourceRevision=(c:NativePublicationCapture)=>digest({compilerVersion:nativeCompilerVersion,source:c.source,bindings:c.bindings});
export function packageNativePublication(capture:NativePublicationCapture,scope:PublicationScope):NativePublicationBundle {
 const c=projectNativePublicationCapture(capture.dependencies,scope),semantic=nativeSemantic(c),manifest={...semantic,snapshot:{id:`snapshot-native-${randomUUID()}`,contentDigest:`sha256:${digest(semantic)}`,compiledAt:new Date().toISOString(),compilerVersion:nativeCompilerVersion,scope:'chapter' as const}};
 const revision=sourceRevision(c),privatePayload={contract:'canonical-native-publication/1' as const,...c,result:{manifest,report:{sourceRevision:revision}}};
 const body={revision:nativePublicationRevision,publicationKind:'canonical-native' as const,snapshotId:manifest.snapshot.id,scope,schemaVersion:'1.0.0' as const,runtimeContract:'uply-runtime/1' as const,manifestDigest:manifest.snapshot.contentDigest,sourceRevision:revision,compilerVersion:nativeCompilerVersion,manifest,privatePayload,privateDigest:digest(privatePayload),pins:{captureDigest:digest(c.dependencies),sourceRevision:revision}};
 return certifyNativePublication(JSON.parse(JSON.stringify({...body,seal:digest(body)})));
}
export function certifyNativePublication(input:unknown):NativePublicationBundle {
 const hash=z.string().regex(/^[a-f0-9]{64}$/),scope=z.strictObject({textbookId:uuid,versionId:uuid,chapterId:uuid});
 const b=z.strictObject({revision:z.literal(nativePublicationRevision),publicationKind:z.literal('canonical-native'),snapshotId:z.string().regex(/^snapshot-native-[a-f0-9-]{36}$/),scope,schemaVersion:z.literal('1.0.0'),runtimeContract:z.literal('uply-runtime/1'),manifestDigest:z.string(),sourceRevision:hash,compilerVersion:z.literal(nativeCompilerVersion),manifest:z.unknown(),privatePayload:z.strictObject({contract:z.literal('canonical-native-publication/1'),source:z.unknown(),bindings:z.unknown(),dependencies:dependencyCaptureSchema,result:z.strictObject({manifest:z.unknown(),report:z.strictObject({sourceRevision:hash})})}),privateDigest:hash,pins:z.strictObject({captureDigest:hash,sourceRevision:hash}),seal:hash}).parse(input);
 const {seal,...body}=b;if(digest(body)!==seal||digest(b.privatePayload)!==b.privateDigest)throw Error('PUBLICATION_SEAL_MISMATCH');
 const validation=validateLessonManifestV1(b.manifest,{published:true});if(!validation.success)throw Error('PUBLICATION_MANIFEST_INVALID');
 const m=validation.data,{snapshot,...semantic}=m,c=projectNativePublicationCapture(b.privatePayload.dependencies,b.scope),revision=sourceRevision(c);
 if(snapshot.id!==b.snapshotId||snapshot.scope!=='chapter'||snapshot.compilerVersion!==b.compilerVersion||snapshot.contentDigest!==b.manifestDigest||`sha256:${digest(semantic)}`!==b.manifestDigest||canonical(semantic)!==canonical(nativeSemantic(c)))throw Error('PUBLICATION_MANIFEST_ASSOCIATION');
 if(canonical(b.privatePayload.source)!==canonical(c.source)||canonical(b.privatePayload.bindings)!==canonical(c.bindings)||canonical(b.privatePayload.result.manifest)!==canonical(m)||revision!==b.sourceRevision||revision!==b.privatePayload.result.report.sourceRevision||canonical(b.pins)!==canonical({captureDigest:digest(c.dependencies),sourceRevision:revision}))throw Error('PUBLICATION_NATIVE_CERTIFICATION');
 return b as NativePublicationBundle;
}
