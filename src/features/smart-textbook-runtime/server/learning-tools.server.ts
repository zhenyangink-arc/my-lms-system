import 'server-only';
import type {LessonManifestV1} from '../../../lib/smart-textbook-runtime-v1/contracts.ts';
import type {PrivateBindings} from '../../../lib/smart-textbook-legacy-adapter/capsules.server.ts';
import type {ReadinessBindings} from '../../../lib/smart-textbook-legacy-adapter/readiness-contracts.server.ts';
import type {ServiceScope} from '../../../lib/smart-textbook-legacy-adapter/compatibility-services.server.ts';
import {resolveChapterDestination} from '../../../lib/smart-textbook-legacy-adapter/compatibility-services.server.ts';
import {learningToolsSchema, type LearningTools} from '../core/learning-tools.ts';
import type {ServerLearningState} from '../core/services.ts';
import {contentUtterances} from './content-playback.server.ts';

export type ReturnNode = {id:string;node_code:string};
export function learningTools(m:LessonManifestV1,b:PrivateBindings,s:ReadinessBindings,capsuleRef:string,nodes:ReadonlyArray<ReturnNode>=[]):LearningTools{
  const c=b.capsules.find(c=>c.id===capsuleRef),block=m.blocks.find(x=>x.type==='compat.learning.v1'&&x.props.capsuleRef===capsuleRef);
  if(!c||c.kind!=='learning'||!block)throw Error('LEARNING_TOOLS_SCOPE');
  const target=(partId:string)=>{const t=m.runtimeTargets.find(t=>t.blockId===block.id&&t.partId===partId);if(!t)throw Error('TOOLS_TARGET_UNBOUND');return t.id;};
  const playback:LearningTools['playback']=[];
  const grammar=c.sections.find(x=>x.slot==='grammarCards');
  if(grammar?.slot==='grammarCards')grammar.body.forEach((card,i)=>card.examples.forEach((example,n)=>{
    const identity=b.identities.find(x=>x.owner===c.nodeId&&x.legacyPath===`content.grammarCards[${i}].examples[${n}]`);
    const media=b.mediaMetadata.find(x=>x.assetKey===example.audioId),ref=m.mediaRefs.find(x=>x.id===media?.ref);
    if(!identity||!media||!ref||media.data.script!==example.ko)throw Error('GRAMMAR_MEDIA_BINDING');
    // Published frozen resources are pending; current old UI directly speaks ko.
    // Do not pretend they are ready objects or create a new fallback.
    if(ref.readiness!=='pending')throw Error('GRAMMAR_SOURCE_CHANGED_REQUIRES_REVIEW');
    playback.push({kind:'browser-tts',partId:identity.partId,target:target(identity.partId),text:example.ko,locale:'ko-KR'});
  }));
  for(const p of s.playback.filter(x=>x.source==='authorized-listening')){
    const declaration=m.runtimeTargets.find(t=>t.id===p.target&&t.blockId===block.id);if(!declaration)continue;
    const ref=m.mediaRefs.find(x=>x.id===p.mediaRef),page=s.activityPages.find(x=>x.pageId===declaration.partId&&x.nodeId===c.nodeId);
    if(!ref||ref.readiness!=='ready'||ref.revision!==p.revision||!page)throw Error('LISTENING_OWNER_BINDING');
    playback.push({kind:'listening',target:p.target,partId:page.pageId,pageId:page.pageId,mediaRef:ref.id,revision:ref.revision});
  }
  const navigation:LearningTools['navigation']=[];
  for(const u of contentUtterances(b,capsuleRef))playback.push({kind:'browser-tts',partId:u.partId,target:target(u.partId),text:u.text,locale:'ko-KR'});
  const returns=c.sections.find(x=>x.slot==='returnMap');
  if(returns?.slot==='returnMap')returns.body.forEach((item,index)=>{
    const node=nodes.find(n=>n.node_code===item.node),destination=b.capsules.find(c=>c.kind==='learning'&&c.nodeId===node?.id);
    const frozen=b.identities.find(i=>i.owner===c.nodeId&&i.legacyPath===`content.returnMap[${index}]`);
    if(!destination||!frozen||!m.steps.some(s=>s.id===destination.stepId))throw Error('RETURN_NODE_UNRESOLVED');
    navigation.push({kind:'step',partId:frozen.partId,target:target(frozen.partId),label:`返回${item.reason}练习`});
  });
  const next=c.sections.find(x=>x.slot==='nextNode');
  if(next?.slot==='nextNode'&&next.body==='chapter-test:korean-level-one-01')navigation.push({kind:'chapter-test',partId:next.partId,target:target(next.partId),label:'进入章节测试'});
  return learningToolsSchema.parse({snapshotId:m.snapshot.id,capsuleRef,playback,navigation});
}
/** Both frozen chapter binding and original server completion remain required.
 * Preview never manufactures a completion row. The destination page independently
 * retains its own assignment-viewer/unlock guards. */
export function openLearningDestination(m:LessonManifestV1,b:PrivateBindings,s:ReadinessBindings,scope:ServiceScope,capsuleRef:string,target:string,state:ServerLearningState,legacyGate:boolean,nodes:ReadonlyArray<ReturnNode>=[]){
  const entry=learningTools(m,b,s,capsuleRef,nodes).navigation.find(n=>n.target===target);
  if(!entry||state.snapshotId!==m.snapshot.id||state.revision!==scope.sourceRevision)throw Error('NAVIGATION_TARGET_SCOPE');
  if(entry.kind==='step'){
    const c=b.capsules.find(c=>c.id===capsuleRef);if(c?.kind!=='learning')throw Error('RETURN_NODE_UNRESOLVED');
    const frozen=b.identities.find(i=>i.partId===entry.partId&&i.owner===c.nodeId),index=frozen?.legacyPath.match(/^content\.returnMap\[(\d+)\]$/),section=c.sections.find(s=>s.slot==='returnMap');
    const code=index&&section?.slot==='returnMap'?section.body[Number(index[1])]?.node:null,node=nodes.find(n=>n.node_code===code),destination=b.capsules.find(c=>c.kind==='learning'&&c.nodeId===node?.id);
    if(!destination)throw Error('RETURN_NODE_UNRESOLVED');return {kind:'step' as const,stepId:destination.stepId};
  }
  const completed=legacyGate&&m.steps.every(step=>state.completedStepIds.includes(step.id))&&b.activities.filter(a=>a.countsTowardCompletion).every(a=>state.activityProgress.some(p=>p.activityRef===a.ref&&p.completed));
  resolveChapterDestination(s,scope,'chapter-test:korean-level-one-01',completed);
  return {kind:'chapter-test' as const,path:'/dashboard/assignments/korean/korean-level-one-01' as const};
}
