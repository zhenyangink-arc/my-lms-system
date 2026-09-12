import 'server-only';
import { capsuleSchema, type PrivateBindings } from './capsules.server.ts';
import type { LearningContent, ContentCard, LearningSectionKind } from '../../features/smart-textbook-runtime/core/services.ts';
import {learningPanels} from './panel-projection.server.ts';

/** Explicit safe display projection. Private activity policy, media locations and teacher
 * configurations are never sent as Client Component props. */
export function projectLearningContent(bindings:PrivateBindings,ref:string,locale:'zh-CN'|'ko-KR'):LearningContent {
  const capsule=capsuleSchema.parse(bindings.capsules.find(c=>c.id===ref));
  if(capsule.kind!=='learning')throw Error('Wrong capsule kind');
  const local=(v:{'zh-CN'?:string;'ko-KR'?:string})=>v[locale]??v['zh-CN']??'';
  const part=(path:string,_sectionId:string)=>{
    const identity=bindings.identities.find(i=>i.owner===capsule.nodeId&&i.legacyPath===path);
    if(!identity)throw Error('FROZEN_PART_IDENTITY_MISSING');
    return identity.partId;
  };
  const card=(partId:string,title:string,paragraphs:string[],children:ContentCard[]=[],section?:LearningSectionKind):ContentCard=>({partId,title,paragraphs:paragraphs.filter(Boolean),children,...(section?{section}:{})});
  const cards:ContentCard[]=[],unsupported:string[]=[];
  for(const section of capsule.sections){
    const id=section.partId,path=`content.${section.slot}`;
    const add=(title:string,paragraphs:string[],children:ContentCard[]=[])=>cards.push(card(id,title,paragraphs,children,section.slot));
    switch(section.slot){
      case 'lead': add('学习内容',[local(section.body)]);break;
      case 'coach': add('学习提示',[local(section.body)]);break;
      case 'completion': add('完成要求',[local(section.body)]);break;
      case 'targets': add('学习目标',[],section.body.map((v,i)=>card(part(`${path}[${i}]`,id),v.ko,[v.zh])));break;
      case 'checklist': add('自查清单',section.body.map(v=>`${v.ko}\n${v.zh}`));break;
      case 'dialogueGroups': add('对话练习',[],section.body.map((g,i)=>card(part(`${path}[${i}]`,id),local(g.title),[],g.lines.map((l,j)=>card(part(`${path}[${i}].lines[${j}]`,id),l.speaker,[l.ko,l.zh])))));break;
      case 'vocabulary': add('核心词汇',[],section.body.map((v,i)=>card(part(`${path}[${i}]`,id),v.ko,[v.zh,v.transcription,v.pos,v.collocation])));break;
      case 'grammarCards': add('语法理解',[],section.body.map((g,i)=>card(part(`${path}[${i}]`,id),g.form,[local(g.function),...g.rules,local(g.caution),local(g.source)],g.examples.map((e,j)=>card(part(`${path}[${i}].examples[${j}]`,id),e.ko,[e.zh])))));break;
      case 'patternCards': add('句型库',[],section.body.map((p,i)=>card(part(`${path}[${i}]`,id),p.form,[local(p.function)],p.examples.map((e,j)=>card(part(`${path}[${i}].examples[${j}]`,id),e,[])))));break;
      case 'dialogueScenes': add('情景对话',[],section.body.map((g,i)=>card(part(`${path}[${i}]`,id),local(g.title),[local(g.context),g.coverage.join('、')],g.lines.map((l,j)=>card(part(`${path}[${i}].lines[${j}]`,id),l.speaker,[l.ko,l.zh,l.words.join('、')])))));break;
      case 'dialogueFlow': add('交流顺序',[],section.body.map((v,i)=>card(part(`${path}[${i}]`,id),local(v.title),[local(v.description),v.words.join('、')])));break;
      case 'repeatTracks': add('跟读练习',[],section.body.map((v,i)=>card(part(`${path}[${i}]`,id),local(v.title),[v.keywords.join('、')],v.lines.map((l,j)=>card(part(`${path}[${i}].lines[${j}]`,id),l.ko,[l.zh])))));break;
      case 'repeatLines': add('逐句示范',[],section.body.map((v,i)=>card(part(`${path}[${i}]`,id),v.ko,[v.zh])));break;
      case 'listenSpeakPages': add('听说任务',section.body.flatMap(v=>[local(v.title),local(v.description)]));break;
      case 'listeningContext': add('听力情景',[local(section.body)]);break;
      case 'listeningFocus': add('听辨重点',section.body.map(local));break;
      case 'substitutionGroups': add('替换练习',[],section.body.map((v,i)=>card(part(`${path}[${i}]`,id),'替换练习',[],v.map((text,j)=>card(part(`${path}[${i}][${j}]`,id),text,[])))));break;
      case 'pattern': add('核心句型',[section.body]);break;
      case 'speakingFrame': add('口语支架',[section.body]);break;
      case 'reading': add('阅读材料',[section.body]);break;
      case 'writingFrame': add('写作支架',[section.body]);break;
      case 'originalExample': add('参考表达',[section.body]);break;
      case 'quickResponse': case 'personalOutput': case 'substitutions': add(section.slot==='quickResponse'?'快速回应':section.slot==='personalOutput'?'个人表达':'可替换表达',[],section.body.map((v,i)=>card(part(`${path}[${i}]`,id),v,[])));break;
      case 'listenFor': add('听辨任务',section.body);break;
      case 'outputChecklist': add('表达检查',section.body);break;
      case 'speakingCriteria': add('口语要求',section.body);break;
      case 'questions': add('阅读问题',section.body);break;
      case 'rubric': add('评价要求',section.body);break;
      case 'returnMap': add('复习建议',section.body.map(v=>v.reason));break;
      case 'nextNode': case 'formalAudioStatus': break; // Navigation/status belong to bound services, not instructional prose.
      default: { const impossible:never=section; throw Error(`Unmapped section ${String(impossible)}`); }
    }
  }
  if(capsule.activities.some(a=>!a.activityKey.startsWith('orientation-')))unsupported.push('复杂活动、听说录音及页进度执行尚待完成；本投影仅显示教学内容。');
  return {revision:capsule.revision,capsuleRef:ref,stepId:capsule.stepId,cards,unsupported,panels:learningPanels(capsule,locale)};
}
