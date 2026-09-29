import 'server-only';
import { readFileSync, appendFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { DeepSeekProviderAdapter } from '../../src/features/agent-core/providers/deepseek/adapter';
/** Only upstream Provider HTTP is synthetic. All Runtime, Policy, Tools and DB remain real. */
export function r2Provider() {
 const directory=process.env.UPLY_R2_DIRECTORY;
 if(!directory?.startsWith('/tmp/uply-r2-private-'))throw Error('STAGING_ONLY');
 const state=JSON.parse(readFileSync(directory+'/state.json','utf8'));
 if(process.env.NEXT_PUBLIC_SUPABASE_URL!==state.url||state.marker!=='uply-teaching-agent-r2-disposable-v1')throw Error('STAGING_ONLY');
 return new DeepSeekProviderAdapter({readApiKey:()=> 'synthetic-noncredential',fetchImpl:async(url,init)=>{
  if(String(url)!=='https://api.deepseek.com/chat/completions')throw Error('UNEXPECTED_PROVIDER_URL');
  const body=JSON.parse(String(init?.body)),control=JSON.parse(readFileSync(directory+'/control.json','utf8'));
  const planning=body.tool_choice!=='none';
  appendFileSync(directory+'/provider-events.jsonl',JSON.stringify({at:Date.now(),phase:planning?'planning':'final',fixture:true})+'\n');
  await new Promise<void>((resolve,reject)=>{
   const done=()=>{init?.signal?.removeEventListener('abort',abort);resolve();};
   const timer=setTimeout(done,control.providerDelayMs??100),abort=()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'));};
   if(init?.signal?.aborted)abort();else init?.signal?.addEventListener('abort',abort,{once:true});
  });
  const context=planning?JSON.parse(body.messages[1].content.split('\n').slice(1).join('\n')):null;
  const delta=planning?{tool_calls:[{index:0,id:'synthetic_'+randomUUID(),type:'function',function:{name:'get_current_lesson_context',arguments:JSON.stringify({lessonRef:context.lessonRef,segmentRef:context.segmentRef})}}]}:{content:'는 标记话题，这里谈论的是“我”。저는 학생입니다. 的意思是“我是学生”。'};
  const frames=[{choices:[{delta,finish_reason:null}]},{choices:[{delta:{},finish_reason:planning?'tool_calls':'stop'}]},{choices:[],usage:{prompt_tokens:300,completion_tokens:30,total_tokens:330}}];
  return new Response(frames.map(x=>'data: '+JSON.stringify(x)+'\n\n').join('')+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});
 }});
}
