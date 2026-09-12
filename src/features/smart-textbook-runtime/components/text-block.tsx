'use client';
import type { BlockV1 } from '../../../lib/smart-textbook-runtime-v1/contracts';
import { useRuntimeServices } from './runtime-context';
export function TextBlock({block}:{block:Extract<BlockV1,{type:'text'}>}) {
  const {context}=useRuntimeServices();
  return <div>{block.props.paragraphs.map((p,i)=><p key={i}>{p[context.locale]??p['zh-CN']}</p>)}</div>;
}
