'use client';
import { Component, type ReactNode } from 'react';
import { blockSchemaV1, type BlockV1, type LessonManifestV1 } from '../../../lib/smart-textbook-runtime-v1/contracts';
import { blockRegistryV1 } from '../../../lib/smart-textbook-runtime-v1/registry';
import { TextBlock } from './text-block';
import { MultipleChoiceBlock } from './choice-block';
import { LearningContentRenderer } from './learning-content';
import { LegacyTeacherRenderer } from './teacher-block';
import { RuntimeTarget } from './target';
import { CardTitleWithHint } from '../../../components/ui/card-title-with-hint';
import { useRuntimeServices } from './runtime-context';

class BlockErrorBoundary extends Component<{children:ReactNode},{failed:boolean}>{
  state={failed:false};static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?<p role="alert">当前内容无法显示，请重新加载。</p>:this.props.children;}
}
export function BlockRenderer({block:input,manifest}:{block:BlockV1;manifest:LessonManifestV1}){
  const {context}=useRuntimeServices();
  const block=blockSchemaV1.parse(input),region=manifest.regions.find(r=>r.id===block.region);
  if(!region||region.content!=='blocks'||!region.allowedBlockTypes.includes(block.type)||!blockRegistryV1[block.type].allowedRegions.includes(region.id))throw Error('BLOCK_REGION_DENIED');
  const declaration=manifest.runtimeTargets.find(t=>t.id===block.runtimeTarget&&t.stepId===block.stepId&&t.blockId===block.id&&t.partId===null);
  if(!declaration)throw Error('BLOCK_TARGET_MISSING');
  let content:ReactNode;
  switch(block.type){
    case 'text':content=<TextBlock block={block}/>;break;
    case 'multiple_choice':content=<MultipleChoiceBlock block={block} manifest={manifest}/>;break;
    case 'compat.learning.v1':content=<LearningContentRenderer block={block} manifest={manifest}/>;break;
    case 'compat.teacher.v1':content=<LegacyTeacherRenderer block={block}/>;break;
    default:throw Error(`RENDERER_UNSUPPORTED:${block.type}`);
  }
  const title=block.title?.[context.locale]??block.title?.['zh-CN'],hint=block.hint?.[context.locale]??block.hint?.['zh-CN'];
  return <BlockErrorBoundary><RuntimeTarget declaration={declaration}><div className="runtime-card">
    {title&&block.type!=='multiple_choice'&&<CardTitleWithHint title={title} description={hint} headingLevel={2}/>}{content}
  </div></RuntimeTarget></BlockErrorBoundary>;
}
