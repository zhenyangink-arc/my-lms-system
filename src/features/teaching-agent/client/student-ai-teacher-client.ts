import { studentRunStatusSchema, type StudentTransportEvent } from '../../agent-core/contracts/transport.ts';
import { parseStudentRunStream } from './ndjson-parser.ts';
import { explainRequest, type PublicSelectionPin } from './selection-state.ts';
export type StudentRunPhase = 'idle' | 'starting' | 'resolving' | 'retrieving' | 'answering' | 'cancelling' | 'recovering' | 'completed' | 'failed' | 'cancelled';
export interface StudentRunView {
 phase: StudentRunPhase; selection: PublicSelectionPin | null; runId?: string; conversationId?: string;
 answer?: { text: string; sourceRefs: string[]; completeness: 'complete' | 'partial' };
 error?: string; uncertain: boolean; invalidSelection: boolean;
}
const idle: StudentRunView = { phase: 'idle', selection: null, uncertain: false, invalidSelection: false };
export function studentRunBusy(state: StudentRunView) {
 return state.uncertain || ['starting','resolving','retrieving','answering','cancelling','recovering'].includes(state.phase);
}
export function studentErrorMessage(code?: string, locale: 'zh-CN' | 'ko-KR' = 'zh-CN') {
 if(locale==='ko-KR') {
  const messages: Record<string,string> = {
   FEATURE_DISABLED:'아직 사용할 수 없는 기능이에요.', UNAUTHENTICATED:'로그인이 만료되었어요. 다시 로그인해 주세요.',
   FORBIDDEN:'현재 내용을 사용할 수 없어요. 수업 내용이 변경되었을 수 있으니 문장을 다시 선택해 주세요.',
   RUN_NOT_FOUND:'현재 내용을 사용할 수 없어요. 수업 내용이 변경되었을 수 있으니 문장을 다시 선택해 주세요.',
   IDEMPOTENCY_CONFLICT:'요청 상태가 바뀌었어요. 문장을 다시 선택해 주세요.', CONVERSATION_BUSY:'이전 설명이 아직 진행 중이에요.',
   DEADLINE_EXCEEDED:'설명 시간이 초과되었어요. 잠시 후 다시 시도해 주세요.', REQUIRED_EVIDENCE_MISSING:'현재 교재 내용을 확인할 수 없어요. 문장을 다시 선택해 주세요.',
   PROVIDER_UNAVAILABLE:'설명 서비스를 잠시 사용할 수 없어요. 나중에 다시 시도해 주세요.',
   PROTOCOL_ERROR:'설명 결과를 확인할 수 없어요. 상태를 다시 확인해 주세요.',NETWORK_ERROR:'연결이 끊겼어요. 설명 상태를 다시 확인해 주세요.',
  };
  return messages[code??'']??'설명을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.';
 }
 switch(code) {
  case 'FEATURE_DISABLED': return '功能暂未开放。';
  case 'UNAUTHENTICATED': return '登录状态已失效，请重新登录。';
  case 'FORBIDDEN': case 'RUN_NOT_FOUND': return '当前内容不可用。课程内容可能已经更新，请重新选择这句话。';
  case 'IDEMPOTENCY_CONFLICT': return '请求状态已变化，请重新选择这句话。';
  case 'CONVERSATION_BUSY': return '上一条讲解还在进行。';
  case 'DEADLINE_EXCEEDED': return '讲解超时，请稍后重试。';
  case 'REQUIRED_EVIDENCE_MISSING': return '无法取得当前课文依据，请重新选择这句话。';
  case 'SKILL_OUTPUT_INVALID': return '这次没有完成讲解，请稍后再试。';
  case 'PROVIDER_UNAVAILABLE': return '讲解服务暂时不可用，请稍后重试。';
  case 'PROTOCOL_ERROR': return '讲解结果暂时无法确认，请重新查看状态。';
  case 'NETWORK_ERROR': return '连接中断，请重新查看讲解状态。';
  default: return '这次没有完成讲解，请稍后再试。';
 }
}
class ClientFailure extends Error {
 code: string; constructor(code: string) { super('Student request unavailable'); this.code=code; }
}
/** Page-lifetime controller. No storage, authority, prompt construction or classroom actions. */
export function createStudentAiTeacherClient(options: { fetch?: typeof fetch; retryDelays?: number[]; key?: () => string } = {}) {
 const fetcher=options.fetch ?? globalThis.fetch.bind(globalThis), listeners=new Set<()=>void>();
 let state: StudentRunView=idle, controller: AbortController | undefined, key: string | undefined, closed=false;
 let generation=0, recovering: Promise<void> | undefined, recoverController: AbortController | undefined;
 const delays=options.retryDelays ?? [0,1000,2000];
 const update=(patch: Partial<StudentRunView>)=>{ if(!closed){state={...state,...patch};for(const notify of listeners)notify();} };
 const failure=(code: string, uncertain=false)=>{
  const invalid=['FORBIDDEN','RUN_NOT_FOUND','IDEMPOTENCY_CONFLICT','REQUIRED_EVIDENCE_MISSING'].includes(code);
  update({phase:'failed',answer:undefined,error:code,uncertain,invalidSelection:invalid, ...(invalid?{selection:null}:{})});
 };
 async function json(response: Response) {
  let value; try { value=await response.json(); } catch { throw new ClientFailure('PROTOCOL_ERROR'); }
  if(!response.ok) throw new ClientFailure(response.status===401?'UNAUTHENTICATED':response.status===403?'FORBIDDEN':response.status===404?'RUN_NOT_FOUND':typeof value?.code==='string'?value.code:'NETWORK_ERROR');
  return value;
 }
 function applyStatus(value: unknown) {
  const parsed=studentRunStatusSchema.safeParse(value);
  if(!parsed.success || parsed.data.runId!==state.runId)throw new ClientFailure('PROTOCOL_ERROR');
  const status=parsed.data;
  // A GET started before a terminal event can return an older active snapshot.
  if(['completed','failed','cancelled'].includes(state.phase) && !['completed','failed','cancelled'].includes(status.status))return;
  if(status.status==='completed') {
   if(!status.finalAnswer||!status.sourceRefs?.length||!status.completeness)throw new ClientFailure('PROTOCOL_ERROR');
   update({phase:'completed',answer:{text:status.finalAnswer,sourceRefs:status.sourceRefs,completeness:status.completeness},error:undefined,uncertain:false});
  } else if(status.status==='failed')failure(status.safeFailure?.code ?? 'UNKNOWN');
  else if(status.status==='cancelled')update({phase:'cancelled',answer:undefined,uncertain:false,error:undefined});
  else update({phase:state.phase==='cancelling'?'cancelling':'recovering',uncertain:true});
 }
 async function recover() {
  if(recovering)return recovering;
  const id=state.runId,version=generation;if(!id||closed)return;
  recoverController=new AbortController(); const signal=recoverController.signal;
  recovering=(async()=>{
   update({phase:state.phase==='cancelling'?'cancelling':'recovering',uncertain:true});
   for(const ms of delays){
    if(closed||version!==generation||signal.aborted)return;
    if(ms)await new Promise<void>(resolve=>{const stop=()=>{clearTimeout(timer);resolve();};const timer=setTimeout(()=>{signal.removeEventListener('abort',stop);resolve();},ms);signal.addEventListener('abort',stop,{once:true});});
    if(closed||version!==generation||signal.aborted)return;
    try {
     const response=await fetcher(`/api/teaching-agent/runs/${id}`,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.any([signal,AbortSignal.timeout(10000)])});
     const value=await json(response);if(closed||version!==generation)return;applyStatus(value);
     if(!studentRunBusy(state))return;
    }catch(error){
     if(closed||version!==generation)return;
     const code=error instanceof ClientFailure?error.code:'NETWORK_ERROR';
     if(['UNAUTHENTICATED','FORBIDDEN','RUN_NOT_FOUND'].includes(code)){failure(code);return;}
     update({phase:'recovering',uncertain:true,error:code});
    }
   }
   if(!closed&&version===generation&&studentRunBusy(state))update({phase:'recovering',uncertain:true});
  })().finally(()=>{recovering=undefined;});
  return recovering;
 }
 function applyEvent(event: StudentTransportEvent) {
  if(event.type==='run.started') {
   if(state.runId&&state.runId!==event.runId)throw new ClientFailure('PROTOCOL_ERROR');
   update({runId:event.runId,conversationId:event.conversationId,phase:'resolving'});return;
  }
  if(event.runId!==state.runId)throw new ClientFailure('PROTOCOL_ERROR');
  switch(event.type){
   case 'run.status': if(state.phase!=='cancelling') update({phase:event.phase==='answering'?'answering':event.phase==='retrieving'?'retrieving':'resolving'});break;
   case 'tool.status': if(state.phase!=='cancelling')update({phase:'retrieving'});break;
   case 'answer.final': if(!event.sourceRefs.length)throw new ClientFailure('PROTOCOL_ERROR');update({answer:{text:event.text,sourceRefs:event.sourceRefs,completeness:event.completeness}});break;
   case 'run.completed': if(!state.answer?.sourceRefs.length)throw new ClientFailure('PROTOCOL_ERROR');update({phase:'completed',uncertain:false,error:undefined});break;
   case 'run.failed':failure(event.code);break;
   case 'run.cancelled':update({phase:'cancelled',answer:undefined,uncertain:false,error:undefined});break;
  }
 }
 async function post(pin: PublicSelectionPin, reuse: boolean) {
  const version=++generation; if(!reuse)key=(options.key??(()=>crypto.randomUUID()))();
  controller=new AbortController(); const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(60000)]);
  update({phase:'starting',selection:structuredClone(pin),answer:undefined,error:undefined,uncertain:false,invalidSelection:false,
   ...(!reuse?{runId:undefined,conversationId:undefined}:{})});
  try{
   const response=await fetcher('/api/teaching-agent/runs',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(explainRequest(pin,key!)),signal});
   if(closed||version!==generation){await response.body?.cancel();return;}
   if(!response.ok){await json(response);return;}
   if(!response.body||!response.headers.get('content-type')?.includes('application/x-ndjson'))throw new ClientFailure('PROTOCOL_ERROR');
   for await(const event of parseStudentRunStream(response.body)){
    if(closed||version!==generation)return;applyEvent(event);
   }
   if(closed||version!==generation)return;
   if(studentRunBusy(state)) { if(state.runId)await recover();else failure('NETWORK_ERROR',true); }
  }catch(error){
   if(closed||version!==generation)return;
   if(state.phase==='completed'||state.phase==='cancelled')return;
   const code=error instanceof ClientFailure?error.code:'NETWORK_ERROR';
   if(state.runId){await recover();}
   else failure(code,!(error instanceof ClientFailure) || code==='PROTOCOL_ERROR' || code==='NETWORK_ERROR');
  }
 }
 async function cancel() {
  if(!studentRunBusy(state)||closed)return;
  update({phase:'cancelling',uncertain:true});
  if(!state.runId){controller?.abort();return;} // Transport disconnect persists a late admission cancellation.
  try {
   const response=await fetcher(`/api/teaching-agent/runs/${state.runId}/cancel`,{method:'POST',credentials:'same-origin',keepalive:true,signal:AbortSignal.timeout(10000)});
   const value=await json(response);if(closed)return;
   if(!['accepted','already_terminal'].includes(value.result))throw new ClientFailure('PROTOCOL_ERROR');
   controller?.abort();await recover();
  }catch(error){if(closed)return;update({phase:'recovering',uncertain:true,error:error instanceof ClientFailure?error.code:'NETWORK_ERROR'});await recover();}
 }
 return {
  getSnapshot:()=>state, getServerSnapshot:()=>idle,
  subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};},
  start(pin:PublicSelectionPin){if(closed||studentRunBusy(state))return Promise.resolve();return post(pin,false);},
  retry(){if(closed||!state.selection||['starting','resolving','retrieving','answering','cancelling'].includes(state.phase))return Promise.resolve();if(state.runId&&state.uncertain)return recover();return post(state.selection,state.uncertain);},
  recover,cancel,
  dispose(){
   if(closed)return;
   if(studentRunBusy(state)&&state.runId)void fetcher(`/api/teaching-agent/runs/${state.runId}/cancel`,{method:'POST',credentials:'same-origin',keepalive:true,signal:AbortSignal.timeout(5000)}).catch(()=>{});
   closed=true;generation++;controller?.abort();recoverController?.abort();listeners.clear();
  },
 };
}
