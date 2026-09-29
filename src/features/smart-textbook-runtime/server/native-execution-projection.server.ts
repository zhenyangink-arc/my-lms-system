import 'server-only';
import { createHash } from 'node:crypto';
import type { LessonManifestV1 } from '../../../lib/smart-textbook-runtime-v1/contracts.ts';
import type { publicNativeActivity } from './native-activity-binding.server.ts';
import { makeRuntimeTarget } from '../../../lib/smart-textbook-runtime-v1/targets.ts';
import { validateLessonManifestV1 } from '../../../lib/smart-textbook-runtime-v1/validator.ts';
/** Trusted server projection input. The activity source accepts a safe binding,
 * never the answer-bearing authoring body. No private key is in this DTO. */
export type FrozenExecutionInput={lessonBinding:string;versionBinding:string;node5:{binding:string;rowHash:string;text:string};node7:{binding:string;rowHash:string};compiledAt:string;mediaRevision:string;durationSeconds:number;cueTime:number;activity?:ReturnType<typeof publicNativeActivity>};
export function projectFrozenExecution(input:FrozenExecutionInput):LessonManifestV1{
  if(input.activity&&input.activity.alias!=='hangul-introduction-vowel-recognition')throw Error('NATIVE_ACTIVITY_ALIAS');
  const step='hangul-prelesson',video='test-video',activity='test-activity',text='node5-text',ref='hangul-introduction-vowel-recognition';
  const L=(value:string)=>({'zh-CN':value});
  const m:LessonManifestV1={schemaVersion:'1.0.0',runtimeContract:'uply-runtime/1',requiredCapabilities:['layout.v1','navigation.linear.v1','progress.server.v1','block.text','block.video','block.multiple_choice','timeline.cue.v1'],
    snapshot:{id:'hangul-execution-fixture',contentDigest:`sha256:${'0'.repeat(64)}`,compiledAt:input.compiledAt,compilerVersion:'native-frozen-v1',scope:'step-preview'},
    textbook:{id:'hangul-introduction',slug:'hangul-introduction',title:L('韩文字母入门'),appId:'korean'},version:{id:'hangul-version1',number:1},
    chapter:{id:'hangul-chapter0',key:'prelesson',number:0,title:L('韩文字母入门'),scenario:L('课前导航'),goal:L('认识字母组合')},
    localization:{defaultLocale:'zh-CN',locales:['zh-CN','ko-KR']},template:{id:'native-classroom',key:'native-classroom',revision:'v1'},
    layout:{preset:'split-classroom',desktopRatio:'50-50',splitBreakpoint:'xl',narrowOrder:['teaching','interaction'],teachingCollapsible:false,focusPolicy:'manual',supportPresentation:'inline',navigationPlacement:'bottom',density:'comfortable'},
    regions:[{id:'teaching',role:'teaching',parent:null,content:'blocks',allowedBlockTypes:['video','text']},{id:'interaction',role:'interaction',parent:null,content:'regions',allowedBlockTypes:[]},{id:'interaction.main',role:'main',parent:'interaction',content:'blocks',allowedBlockTypes:['multiple_choice']},{id:'navigation',role:'navigation',parent:null,content:'runtime-navigation',allowedBlockTypes:[]}],
    steps:[{id:step,key:step,title:L('课前导航'),order:1,regions:[{region:'teaching',blockIds:[video,text]},{region:'interaction.main',blockIds:[activity]}],completion:{kind:'server',policyRef:'step-progress'},nextStep:null,teachingRef:'frozen-teaching'}],
    blocks:[{id:video,stepId:step,region:'teaching',order:1,title:L('开发播放测试'),completion:{kind:'none'},runtimeTarget:makeRuntimeTarget(step,video),type:'video',props:{mediaRef:'development-video',role:'teacher',fallback:'retry',startPaused:true}},
      {id:text,stepId:step,region:'teaching',order:2,title:L('把辅音和元音放在一起'),completion:{kind:'none'},runtimeTarget:makeRuntimeTarget(step,text),type:'text',props:{paragraphs:[{'zh-CN':input.node5.text,'ko-KR':input.node5.text}]}},
      {id:activity,stepId:step,region:'interaction.main',order:1,completion:{kind:'server',policyRef:'activity-progress'},runtimeTarget:makeRuntimeTarget(step,activity),type:'multiple_choice',props:{activityRef:ref,presentation:'single'}}],
    navigation:{region:'navigation',entryStep:step,items:[step],mode:'linear',access:'completed-prefix',previous:'allowed',autoAdvance:false,resume:'stable-id'},completion:{authority:'server',chapterPolicyRef:'chapter-progress'},
    runtimeTargets:[{id:makeRuntimeTarget(step,video),stepId:step,blockId:video,partId:null,capabilities:['reveal','focus','play'],acceptedEvents:['media-ended'],verification:'playback-observation'},{id:makeRuntimeTarget(step,text),stepId:step,blockId:text,partId:null,capabilities:['reveal','focus'],acceptedEvents:[],verification:'ui-only'},{id:makeRuntimeTarget(step,activity),stepId:step,blockId:activity,partId:null,capabilities:['reveal','focus'],acceptedEvents:['response-submitted'],verification:'server-attempt'}],
    mediaRefs:[{id:'development-video',kind:'video',revision:input.mediaRevision,readiness:'ready',access:'lesson',language:null,alt:L('仅用于开发的播放测试视频')}],
    activityRefs:[{id:ref,activityId:ref,revision:input.activity?.revision??'fixture-v1',type:'single_choice',publicPresentation:{prompt:input.activity?.prompt??L('哪个是元音？'),instruction:input.activity?.instruction??L('请选择一个选项。'),options:input.activity?.options??['ㄱ','ㅏ','ㄴ'].map((v,i)=>({id:`option-${i}`,text:L(v)})),settings:{shuffle:false,showScore:false}}}],
    progressRefs:[{id:'chapter-progress',kind:'chapter'},{id:'step-progress',kind:'node'},{id:'activity-progress',kind:'activity'}],teachingRefs:[{id:'frozen-teaching',revision:'frozen-v1',mode:'video-first',entryCueId:'vowel-cue'}],compatibility:{profile:'native',adapterRevision:null},
    execution:{contract:'native-execution/1',targetAlias:'hangul-introduction',lessonBinding:input.lessonBinding,scriptVersionBinding:input.versionBinding,scriptVersion:1,
      sourceNodes:[{nodeNumber:5,binding:input.node5.binding,rowHash:input.node5.rowHash,blockIds:[video,text]},{nodeNumber:7,binding:input.node7.binding,rowHash:input.node7.rowHash,blockIds:[activity]}],
      media:[{blockId:video,revision:input.mediaRevision,durationSeconds:input.durationSeconds}],cues:[{id:'vowel-cue',stepId:step,sourceBlockId:video,mediaRevision:input.mediaRevision,triggerType:'time',triggerTime:input.cueTime,action:'show_activity',targetBlockId:activity,pauseSource:true,mandatory:true,resumePolicy:'after_authoritative_activity_completion',sortOrder:10}],initialLayout:'split'},
  };
  // No private bindings or answer-bearing authoring source participate in public serialization.
  m.snapshot.contentDigest=`sha256:${createHash('sha256').update(JSON.stringify(m)).digest('hex')}`;
  const checked=validateLessonManifestV1(m);if(!checked.success)throw Error(`NATIVE_PROJECTION_INVALID:${checked.issues.map(i=>i.message).join(',')}`);return checked.data;
}
