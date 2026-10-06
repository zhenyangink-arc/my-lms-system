import 'server-only';
import { nativeVideoSourceSchema } from './native-video-source.server.ts';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { canonical, digest } from '../smart-textbook-legacy-adapter/identity.server.ts';
import { localizedTextSchema, type LessonManifestV1, type BlockV1 } from '../smart-textbook-runtime-v1/contracts.ts';
import { validateLessonManifestV1 } from '../smart-textbook-runtime-v1/validator.ts';
import { makeRuntimeTarget } from '../smart-textbook-runtime-v1/targets.ts';
import { dependencyCaptureSchema, type DependencyCapture } from './capture.server.ts';
import type { PublicationScope } from './artifact.server.ts';

export const nativeVideoPublicationRevision = 'publish-foundation/3' as const;
export const nativeVideoCompilerVersion = 'native-video-publication-1' as const;
const uuid = z.uuid(), L = localizedTextSchema;
const row = z.object({ id: uuid });
const bookSchema = row.extend({ lesson_id: uuid, student_app_id: uuid, agent_profile_id: uuid, slug: z.string(), title: L, status: z.literal('published') });
const versionSchema = row.extend({ textbook_id: uuid, version_number: z.number().int().positive(), status: z.literal('published') });
const chapterSchema = row.extend({ version_id: uuid, slug: z.string(), chapter_number: z.number().int().nonnegative(), title: L, scenario: L, goal: L, status: z.literal('published'), chapter_test_id:z.null().optional() });
const moduleSchema = row.extend({ chapter_id: uuid, sort_order: z.number().int().positive() });
const nodeSchema = row.extend({ module_id: uuid, sort_order: z.number().int().positive(), node_type:z.enum(['learn','practice','mission','review']), content: z.strictObject({}) });
const activitySchema = row.extend({ node_id: uuid, activity_key: z.string().min(1), activity_type: z.literal('single_choice'), prompt: L, instruction: L,
 options: z.array(z.union([z.string().min(1), L])).min(2).max(100), public_config: z.strictObject({ shuffle: z.boolean().optional(), showScore: z.boolean().optional() }),
 max_attempts: z.number().int().min(1).max(20), counts_toward_completion: z.literal(true) });
const lessonSchema = row.extend({ module_id: uuid, agent_profile_id: uuid, status: z.literal('published') });
const scriptSchema = row.extend({ lesson_id: uuid, version_number: z.number().int().positive(), status: z.literal('published') });
const sourceNodeSchema = row.extend({ script_version_id: uuid, sort_order: z.number().int().positive(), title: L, teacher_script: L,
 node_key: z.string().min(1), node_type:z.enum(['opening','explanation','example','question','instruction','summary']), is_required:z.boolean(), configuration: z.strictObject({videoPilotPublication:nativeVideoSourceSchema}), reference_activity_id: uuid, action_type: z.literal('focus_activity'),
 next_node_key: z.null().optional(), remediation_node_key: z.null().optional(),
 video_mode: z.literal('legacy').optional(), segments: z.array(z.never()).optional() });
const secretSchema = z.object({ activity_id: uuid, answer_key: z.strictObject({ kind: z.literal('index'), value: z.number().int().nonnegative() }) });

function requiredEmpty(value:unknown) { if(value!==undefined && value!==null && value!==false && value!=='' && !(Array.isArray(value)&&!value.length) && !(typeof value==='object'&&!Array.isArray(value)&&!Object.keys(value).length))throw Error('NATIVE_VIDEO_UNSUPPORTED_MEDIA'); }
/** Project exactly one authenticated SQL capture. No mutable secondary reads. */
export function projectNativeVideoPublicationCapture(input:unknown,scope:PublicationScope) {
 const dependencies=dependencyCaptureSchema.parse(input);
 for(const key of ['digital_textbooks','digital_textbook_versions','digital_textbook_chapters','digital_textbook_modules','digital_textbook_nodes','digital_textbook_activities','digital_textbook_activity_secrets','learning_agent_lessons','learning_agent_profiles','learning_agent_script_versions','learning_agent_script_nodes'] as const)
  if(dependencies[key].length!==1)throw Error('NATIVE_VIDEO_CARDINALITY');
 for(const key of ['digital_textbook_media_assets','digital_textbook_listening_tracks','learning_agent_script_audio_assets','learning_agent_node_interaction_secrets','chapter_tests'] as const)
  if(dependencies[key].length)throw Error('NATIVE_VIDEO_UNSUPPORTED_MEDIA');
 const book=bookSchema.parse(dependencies.digital_textbooks[0]),version=versionSchema.parse(dependencies.digital_textbook_versions[0]),chapter=chapterSchema.parse(dependencies.digital_textbook_chapters[0]);
 const selectedModule=moduleSchema.parse(dependencies.digital_textbook_modules[0]),node=nodeSchema.parse(dependencies.digital_textbook_nodes[0]),activity=activitySchema.parse(dependencies.digital_textbook_activities[0]);
 const lesson=lessonSchema.parse(dependencies.learning_agent_lessons[0]),script=scriptSchema.parse(dependencies.learning_agent_script_versions[0]),teachingNode=sourceNodeSchema.parse(dependencies.learning_agent_script_nodes[0]);
 const profile=dependencies.learning_agent_profiles[0],secret=secretSchema.parse(dependencies.digital_textbook_activity_secrets[0]),promoted=teachingNode.configuration.videoPilotPublication;
 if(book.id!==scope.textbookId||version.id!==scope.versionId||chapter.id!==scope.chapterId||version.textbook_id!==book.id||chapter.version_id!==version.id||selectedModule.chapter_id!==chapter.id||node.module_id!==selectedModule.id||activity.node_id!==node.id||lesson.module_id!==selectedModule.id||script.lesson_id!==lesson.id||teachingNode.script_version_id!==script.id||teachingNode.reference_activity_id!==activity.id||promoted.cue.activityId!==activity.id||profile.id!==book.agent_profile_id||lesson.agent_profile_id!==profile.id||profile.status!=='published'||secret.activity_id!==activity.id||secret.answer_key.value>=activity.options.length)throw Error('NATIVE_VIDEO_ASSOCIATION');
 // Optional subject metadata must agree when present. It never selects a second auth system.
 const subjects=[...dependencies.digital_textbooks,...dependencies.learning_agent_profiles,...dependencies.learning_agent_lessons].map(r=>r.subject).filter(v=>v!==undefined&&v!==null);
 if(subjects.some(v=>typeof v!=='string'||v!==subjects[0]))throw Error('NATIVE_VIDEO_SUBJECT');
 for(const row of dependencies.learning_agent_profile_secrets)if(row.agent_profile_id!==profile.id)throw Error('NATIVE_VIDEO_PROFILE_SECRET');
 for(const key of ['video_asset_id','video_url','audio_asset_id','audio_url','cue_points','cues','interaction','interaction_config','required_video','required_audio','required_speech','required_listening','required_cue'])requiredEmpty(dependencies.learning_agent_script_nodes[0][key]);
 const activityRevision=`activity-${digest({id:activity.id,type:activity.activity_type,prompt:activity.prompt,instruction:activity.instruction,options:activity.options,public_config:activity.public_config,max_attempts:activity.max_attempts,counts_toward_completion:activity.counts_toward_completion})}`;
 const bindings=[{activityId:activity.id,activityAlias:activity.activity_key,executionNodeId:node.id,sourceTeachingNodeId:teachingNode.id,moduleId:selectedModule.id,teachingLessonId:lesson.id,scriptVersionId:script.id,scriptVersion:script.version_number,countsTowardCompletion:true as const,activityRevision,mediaRef:`video-${teachingNode.id}`,mediaRevision:promoted.media.revision,cueId:'pause-1' as const}];
 return {source:{book,version,chapter,modules:[selectedModule],nodes:[node],activities:[activity],lessons:[lesson],scripts:[script],teachingNodes:[teachingNode]},bindings,dependencies};
}
export type NativeVideoPublicationCapture=ReturnType<typeof projectNativeVideoPublicationCapture>;
export type NativeVideoPublicationBinding=NativeVideoPublicationCapture['bindings'][number];
function nativeVideoSemantic(c:NativeVideoPublicationCapture):Omit<LessonManifestV1,'snapshot'> {
 const s=c.source,t=s.teachingNodes[0],a=s.activities[0],b=c.bindings[0],p=t.configuration.videoPilotPublication;
 const stepId=t.id,videoId=b.mediaRef,choiceId=`choice-${a.id}`,videoTarget=makeRuntimeTarget(stepId,videoId),choiceTarget=makeRuntimeTarget(stepId,choiceId);
 const cue={id:'pause-1' as const,stepId,sourceBlockId:videoId,mediaRevision:b.mediaRevision,triggerType:'time' as const,triggerTime:p.cue.atSeconds,action:'show_activity' as const,targetBlockId:choiceId,pauseSource:true as const,mandatory:true as const,resumePolicy:'after_authoritative_activity_completion' as const,sortOrder:1};
 const blocks:BlockV1[]=[
  {id:videoId,stepId,region:'teaching',order:1,type:'video',props:{mediaRef:videoId,role:'content',fallback:'retry',startPaused:true},completion:{kind:'none'},runtimeTarget:videoTarget},
  {id:choiceId,stepId,region:'interaction.main',order:1,type:'multiple_choice',props:{activityRef:a.id,presentation:'single'},completion:{kind:'server',policyRef:`activity-${a.id}`},runtimeTarget:choiceTarget},
 ];
 return {schemaVersion:'1.0.0',runtimeContract:'uply-runtime/1',requiredCapabilities:['layout.v1','navigation.linear.v1','progress.server.v1','block.video','block.multiple_choice','timeline.cue.v1'],
  textbook:{id:s.book.id,slug:s.book.slug,title:s.book.title,appId:s.book.student_app_id},version:{id:s.version.id,number:s.version.version_number},chapter:{id:s.chapter.id,key:s.chapter.slug,number:s.chapter.chapter_number,title:s.chapter.title,scenario:s.chapter.scenario,goal:s.chapter.goal},localization:{defaultLocale:'zh-CN',locales:['zh-CN','ko-KR']},
  template:{id:'native-classroom',key:'native-classroom',revision:'native-video-publication-1'},layout:{preset:'split-classroom',desktopRatio:'40-60',splitBreakpoint:'xl',narrowOrder:['teaching','interaction'],teachingCollapsible:true,focusPolicy:'manual',supportPresentation:'inline',navigationPlacement:'bottom',density:'comfortable'},
  regions:[{id:'teaching',role:'teaching',parent:null,content:'blocks',allowedBlockTypes:['video']},{id:'interaction',role:'interaction',parent:null,content:'regions',allowedBlockTypes:[]},{id:'interaction.main',role:'main',parent:'interaction',content:'blocks',allowedBlockTypes:['multiple_choice']},{id:'navigation',role:'navigation',parent:null,content:'runtime-navigation',allowedBlockTypes:[]}],
  steps:[{id:stepId,key:stepId,title:t.title,order:1,regions:[{region:'teaching',blockIds:[videoId]},{region:'interaction.main',blockIds:[choiceId]}],completion:{kind:'server',policyRef:`node-${b.executionNodeId}`},nextStep:null,teachingRef:null}],blocks,
  navigation:{region:'navigation',entryStep:stepId,items:[stepId],mode:'linear',access:'free',previous:'allowed',autoAdvance:false,resume:'stable-id'},completion:{authority:'server',chapterPolicyRef:`chapter-${s.chapter.id}`},
  runtimeTargets:[{id:videoTarget,stepId,blockId:videoId,partId:null,capabilities:['play','focus'],acceptedEvents:['media-ended'],verification:'playback-observation'},{id:choiceTarget,stepId,blockId:choiceId,partId:null,capabilities:['reveal','focus'],acceptedEvents:['response-submitted'],verification:'server-attempt'}],
  mediaRefs:[{id:videoId,kind:'video',revision:b.mediaRevision,readiness:'ready',access:'lesson',language:null,alt:t.title}],
  activityRefs:[{id:a.id,activityId:a.id,revision:b.activityRevision,type:'single_choice',publicPresentation:{prompt:a.prompt,instruction:a.instruction,options:a.options.map((text,i)=>({id:`option-${i}`,text:typeof text==='string'?{'zh-CN':text,'ko-KR':text}:text})),settings:{shuffle:a.public_config.shuffle??false,showScore:a.public_config.showScore??false}}}],
  progressRefs:[{id:`chapter-${s.chapter.id}`,kind:'chapter'},{id:`node-${b.executionNodeId}`,kind:'node'},{id:`activity-${a.id}`,kind:'activity'}],teachingRefs:[],compatibility:{profile:'native',adapterRevision:null},
  execution:{contract:'native-execution/2',targetAlias:`native-video-${s.chapter.id}`,lessonBinding:digest({teachingLessonId:b.teachingLessonId}),scriptVersionBinding:digest({scriptVersionId:b.scriptVersionId,scriptVersion:b.scriptVersion}),scriptVersion:b.scriptVersion,
   sourceNodes:[{nodeNumber:t.sort_order,binding:digest({sourceTeachingNodeId:t.id}),rowHash:digest({title:t.title,activityRevision:b.activityRevision,mediaRef:videoId,mediaRevision:b.mediaRevision,cue}),blockIds:[videoId,choiceId]}],media:[{blockId:videoId,revision:b.mediaRevision,durationSeconds:30}],cues:[cue],initialLayout:'split'},
 };
}
export type NativeVideoPublicationBundle={revision:typeof nativeVideoPublicationRevision;publicationKind:'canonical-native-video';snapshotId:string;scope:PublicationScope;schemaVersion:'1.0.0';runtimeContract:'uply-runtime/1';manifestDigest:string;sourceRevision:string;compilerVersion:typeof nativeVideoCompilerVersion;manifest:LessonManifestV1;privatePayload:{contract:'canonical-native-video-publication/1';source:NativeVideoPublicationCapture['source'];bindings:NativeVideoPublicationBinding[];dependencies:DependencyCapture;result:{manifest:LessonManifestV1;report:{sourceRevision:string}}};privateDigest:string;pins:{captureDigest:string;sourceRevision:string};seal:string};
const sourceRevision=(c:NativeVideoPublicationCapture)=>digest({compilerVersion:nativeVideoCompilerVersion,source:c.source,bindings:c.bindings,dependencies:c.dependencies});
export function packageNativeVideoPublication(capture:NativeVideoPublicationCapture,scope:PublicationScope):NativeVideoPublicationBundle {
 const c=projectNativeVideoPublicationCapture(capture.dependencies,scope),semantic=nativeVideoSemantic(c),manifest={...semantic,snapshot:{id:`snapshot-native-video-${randomUUID()}`,contentDigest:`sha256:${digest(semantic)}`,compiledAt:new Date().toISOString(),compilerVersion:nativeVideoCompilerVersion,scope:'chapter' as const}};
 const revision=sourceRevision(c),privatePayload={contract:'canonical-native-video-publication/1' as const,...c,result:{manifest,report:{sourceRevision:revision}}};
 const body={revision:nativeVideoPublicationRevision,publicationKind:'canonical-native-video' as const,snapshotId:manifest.snapshot.id,scope,schemaVersion:'1.0.0' as const,runtimeContract:'uply-runtime/1' as const,manifestDigest:manifest.snapshot.contentDigest,sourceRevision:revision,compilerVersion:nativeVideoCompilerVersion,manifest,privatePayload,privateDigest:digest(privatePayload),pins:{captureDigest:digest(c.dependencies),sourceRevision:revision}};
 return certifyNativeVideoPublication(JSON.parse(JSON.stringify({...body,seal:digest(body)})));
}
export function certifyNativeVideoPublication(input:unknown):NativeVideoPublicationBundle {
 const hash=z.string().regex(/^[a-f0-9]{64}$/),scope=z.strictObject({textbookId:uuid,versionId:uuid,chapterId:uuid});
 const b=z.strictObject({revision:z.literal(nativeVideoPublicationRevision),publicationKind:z.literal('canonical-native-video'),snapshotId:z.string().refine(v=>v.startsWith('snapshot-native-video-')&&uuid.safeParse(v.slice('snapshot-native-video-'.length)).success),scope,schemaVersion:z.literal('1.0.0'),runtimeContract:z.literal('uply-runtime/1'),manifestDigest:z.string(),sourceRevision:hash,compilerVersion:z.literal(nativeVideoCompilerVersion),manifest:z.unknown(),privatePayload:z.strictObject({contract:z.literal('canonical-native-video-publication/1'),source:z.unknown(),bindings:z.unknown(),dependencies:dependencyCaptureSchema,result:z.strictObject({manifest:z.unknown(),report:z.strictObject({sourceRevision:hash})})}),privateDigest:hash,pins:z.strictObject({captureDigest:hash,sourceRevision:hash}),seal:hash}).parse(input);
 const {seal,...body}=b;if(digest(body)!==seal||digest(b.privatePayload)!==b.privateDigest)throw Error('PUBLICATION_SEAL_MISMATCH');
 const validation=validateLessonManifestV1(b.manifest,{published:true});if(!validation.success)throw Error('PUBLICATION_MANIFEST_INVALID');
 const m=validation.data,{snapshot,...semantic}=m,c=projectNativeVideoPublicationCapture(b.privatePayload.dependencies,b.scope),revision=sourceRevision(c);
 if(snapshot.id!==b.snapshotId||snapshot.scope!=='chapter'||snapshot.compilerVersion!==b.compilerVersion||snapshot.contentDigest!==b.manifestDigest||`sha256:${digest(semantic)}`!==b.manifestDigest||canonical(semantic)!==canonical(nativeVideoSemantic(c)))throw Error('PUBLICATION_MANIFEST_ASSOCIATION');
 if(canonical(b.privatePayload.source)!==canonical(c.source)||canonical(b.privatePayload.bindings)!==canonical(c.bindings)||canonical(b.privatePayload.result.manifest)!==canonical(m)||revision!==b.sourceRevision||revision!==b.privatePayload.result.report.sourceRevision||canonical(b.pins)!==canonical({captureDigest:digest(c.dependencies),sourceRevision:revision}))throw Error('PUBLICATION_NATIVE_CERTIFICATION');
 return {...b,manifest:m,privatePayload:{contract:'canonical-native-video-publication/1',...c,result:{manifest:m,report:{sourceRevision:revision}}}};
}
