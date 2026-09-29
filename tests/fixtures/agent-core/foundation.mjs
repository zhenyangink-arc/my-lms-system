import '../smart-textbook-legacy-adapter/register-server-only.mjs';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { createSkillRegistry } from '../../../src/features/agent-core/skills/registry.ts';
import { createToolRegistry } from '../../../src/features/agent-core/tools/registry.ts';
import { transitionRun } from '../../../src/features/agent-core/runtime/run-state.ts';
import { CoreError } from '../../../src/features/agent-core/runtime/errors.ts';
import { DEEPSEEK_BASELINE } from '../../../src/features/agent-core/providers/deepseek/capabilities.ts';
export function fixture() {
  const authority = { actorId: '00000000-0000-4000-a000-000000000001', tenantId: '00000000-0000-4000-a000-000000000002',
    membershipRole: 'test', appId: 'test-app', scope: {kind:'user_global'}, scopeRef:'synthetic-scope', policyVersion:{name:'test-policy',version:'1.0.0'}, issuedAt:new Date(Date.now()-1000).toISOString(),expiresAt:new Date(Date.now()+120000).toISOString() };
  const skill = {name:'test-echo-skill',version:'1.0.0',status:'published',description:'Synthetic only',allowedTools:[{name:'echo_test',version:'1.0.0'}],procedure:['Call synthetic echo.'],outputContract:{name:'test-text',version:'1.0.0'}};
  const profile = {agentCode:'test-agent',definitionVersion:{name:'test-agent',version:'1.0.0'},status:'published',promptVersion:{name:'synthetic-prompt',version:'1.0.0'},contextVersion:{name:'synthetic-context',version:'1.0.0'},model:DEEPSEEK_BASELINE,
    allowedSkillRefs:[{name:skill.name,version:skill.version}],allowedToolRefs:skill.allowedTools,policyVersion:authority.policyVersion,
    budget:{maxModelCalls:2,maxToolExecutions:1,maxInputTokensPerCall:10000,maxOutputTokensPerCall:128,reservedTokens:20256}};
  let executed=0;
  const definition={name:'echo_test',version:'1.0.0',description:'Synthetic echo',status:'enabled',riskLevel:0,
    inputSchema:{type:'object',properties:{value:{type:'string'}},required:['value'],additionalProperties:false},
    inputValidator:z.object({value:z.string().max(100)}).strict(),outputValidator:z.object({echo:z.string()}).strict(),requiredPermissions:['test.echo'],timeoutMs:1000,maxResultBytes:1024};
  const tool={definition,executor:{async execute(input){executed++;return {status:'ok',data:{echo:input.value},sourceRefs:[]};}}};
  const policy={async evaluate(a){return {effect:'allow',policyVersion:a.policyVersion,scopeRef:a.scopeRef,expiresAt:a.expiresAt};}};
  const persistence=new MemoryPersistence(authority);
  return {authority,profile,skill,tool,policy,persistence,executed:()=>executed,
    request:{protocolVersion:1,agentCode:'test-agent',idempotencyKey:'test-key-001',message:'Call echo_test with value verification.',scope:{kind:'user_global'}},
    skills:createSkillRegistry([skill]),tools:createToolRegistry([tool]),
    context:{async resolve(){return {snapshotId:randomUUID(),sources:[],values:{}};}},
    prompt:{async assemble({request}){return [{role:'system',text:'Synthetic tool verification only.'},{role:'user',text:request.message}];}},
  };
}
// Tests only. Synchronous critical sections model atomic ports, NOT proof of Postgres behavior.
export class MemoryPersistence {
  constructor(authority){this.authority=authority;this.runs=new Map();this.events=[];this.usage=[];this.messages=[];}
  check(run){if(run.tenantId!==this.authority.tenantId||run.actorId!==this.authority.actorId||run.scopeRef!==this.authority.scopeRef)throw new CoreError('FORBIDDEN');}
  async admitRun(i){
    if(i.authority.tenantId!==this.authority.tenantId||i.authority.actorId!==this.authority.actorId)throw new CoreError('FORBIDDEN');
    for(const row of this.runs.values())if(row.conversationId===i.conversationId&&row.key===i.request.idempotencyKey){if(row.digest!==i.digest)throw new CoreError('IDEMPOTENCY_CONFLICT');return {run:structuredClone(row),replayed:true};}
    if([...this.runs.values()].some(r=>r.conversationId===i.conversationId&&!['completed','failed','cancelled'].includes(r.status)))throw new CoreError('CONVERSATION_BUSY');
    const run={id:randomUUID(),conversationId:i.conversationId,inputMessageId:randomUUID(),actorId:i.authority.actorId,tenantId:i.authority.tenantId,
      agentCode:i.profile.agentCode,scopeRef:i.authority.scopeRef,definitionVersion:i.profile.definitionVersion,skillRef:i.skillRef,status:'created',stateVersion:1,
      fencingToken:randomUUID(),executionAttempt:1,deadlineAt:i.budget.deadlineAt,leaseExpiresAt:i.budget.deadlineAt,budget:structuredClone(i.budget),createdAt:new Date().toISOString(),key:i.request.idempotencyKey,digest:i.digest};
    this.runs.set(run.id,run);this.messages.push({role:'user',runId:run.id,content:i.request.message});return {run:structuredClone(run),replayed:false};
  }
  current(run){this.check(run);const now=this.runs.get(run.id);if(!now||now.stateVersion!==run.stateVersion||now.fencingToken!==run.fencingToken||['completed','failed','cancelled'].includes(now.status))throw new CoreError('PERSISTENCE_FAILED');return now;}
  async transitionRun({run,to,budget,finalText}){const current=this.current(run);const next={...transitionRun(current,to),budget:structuredClone(budget)};this.runs.set(next.id,next);if(finalText!==undefined)this.messages.push({role:'assistant',runId:run.id,content:finalText});return structuredClone(next);}
  async getRun(id){return structuredClone(this.runs.get(id)??null);}
  async appendRunEvent(run,event){this.current(run);if(event.runId!==run.id)throw new CoreError('FORBIDDEN');this.events.push(structuredClone(event));}
  async persistUsage(run,record){this.current(run);this.usage.push(structuredClone(record));}
}
export function sse(events){return events.map(e=>`data: ${e==='[DONE]'?e:JSON.stringify(e)}\r\n\r\n`).join('');}
export function planningEvents(fragments=['{"value":','"verification"}']){return [
  ...fragments.map((args,i)=>({choices:[{index:0,delta:{tool_calls:[{index:0,...(i===0?{id:'test_call_001',type:'function'}:{}),function:{...(i===0?{name:'echo_test'}:{}),arguments:args}}]},finish_reason:null}]})),
  {choices:[{delta:{},finish_reason:'tool_calls'}]},
  {choices:[],usage:{prompt_tokens:304,completion_tokens:38,total_tokens:342}},'[DONE]'];}
export const finalEvents=[{choices:[{delta:{content:'veri',reasoning_content:'DO NOT PERSIST synthetic hidden reasoning'},finish_reason:null}]},
  {choices:[{delta:{content:'fication'},finish_reason:null}]},{choices:[{delta:{},finish_reason:'stop'}]},
  {choices:[],usage:{prompt_tokens:94,completion_tokens:2,total_tokens:96}},'[DONE]'];
export function streamResponse(text,chunkSize=7){const bytes=new TextEncoder().encode(text);let offset=0;return new Response(new ReadableStream({pull(controller){if(offset>=bytes.length){controller.close();return;}controller.enqueue(bytes.slice(offset,offset+chunkSize));offset+=chunkSize;}}),{headers:{'content-type':'text/event-stream','x-request-id':'synthetic-request'}});}
export function fixtureFetch(){const calls=[];return {calls,fetchImpl:async (_url,init)=>{calls.push(JSON.parse(init.body));return streamResponse(sse(calls.length===1?planningEvents():finalEvents));}};}
