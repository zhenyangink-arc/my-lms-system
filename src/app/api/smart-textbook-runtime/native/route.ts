import { z } from 'zod';
import { bootstrapNativeLearningSession, refreshNativeLearningState, readNativeActivity, submitNativeActivity } from '../../../../features/smart-textbook-runtime/server/native-published-activity.server.ts';
import { revokeNativeLearningSession } from '../../../../features/smart-textbook-runtime/server/native-learning-session.server.ts';
import { nativePublishedReadRequestSchema } from '../../../../features/smart-textbook-runtime/core/native-published-media-contracts.ts';
import { completionRequestSchema } from '../../../../features/smart-textbook-runtime/core/execution-contracts.ts';
export const runtime='nodejs';
const sessionRef=z.string().refine(v=>v.startsWith('learning-session-')&&z.uuid().safeParse(v.slice(17)).success);
const bodySchema=z.union([
 z.strictObject({op:z.enum(['bootstrap','refresh','revoke']),sessionRef}),
 z.strictObject({op:z.enum(['restore','checkpoint','readback']),sessionRef,request:nativePublishedReadRequestSchema}),
 z.strictObject({op:z.literal('submit'),sessionRef,request:completionRequestSchema.extend({requestId:z.uuid()}),optionId:z.string().min(1).max(200)}),
]);
const headers={'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'};
export async function POST(request:Request){
 try{
  const origin=request.headers.get('origin'),site=request.headers.get('sec-fetch-site');
  if((origin!==null&&origin!==new URL(request.url).origin)||(site!==null&&site!=='same-origin')||(!origin&&site!=='same-origin'))return Response.json({error:'请求来源无效。'},{status:403,headers});
  if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')return Response.json({error:'请求格式无效。'},{status:400,headers});
  const reader=request.body?.getReader();if(!reader)throw Error('NATIVE_BODY_INVALID');
  const chunks:Uint8Array[]=[];let length=0;
  try{for(;;){request.signal.throwIfAborted();const chunk=await reader.read();if(chunk.done)break;length+=chunk.value.byteLength;if(length>16384){await reader.cancel();throw Error('NATIVE_BODY_INVALID');}chunks.push(chunk.value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  let raw:unknown;try{raw=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw Error('NATIVE_BODY_INVALID');}
  const parsed=bodySchema.safeParse(raw);if(!parsed.success)throw Error('NATIVE_BODY_INVALID');const body=parsed.data;
  if('request' in body&&(body.request.binding.sessionId!==body.sessionRef||('operation' in body.request&&body.op!==body.request.operation)))throw Error('NATIVE_BODY_INVALID');
  let result:unknown;
  if(body.op==='bootstrap')result=await bootstrapNativeLearningSession(body.sessionRef,request.signal);
  else if(body.op==='refresh')result=await refreshNativeLearningState(body.sessionRef,request.signal);
  else if(body.op==='revoke')result=await revokeNativeLearningSession(body.sessionRef);
  else if(body.op==='submit')result=await submitNativeActivity(body.sessionRef,{request:body.request,optionId:body.optionId},request.signal);
  else if('request' in body)result=await readNativeActivity(body.sessionRef,body.request,request.signal);
  else throw Error('NATIVE_BODY_INVALID');
  return Response.json(result,{headers});
 }catch(error){const message=error instanceof Error?error.message:'';
  const status=message==='NATIVE_BODY_INVALID'||error instanceof z.ZodError?400:/FORBIDDEN|OWNER/.test(message)?403:/EXPIRED|MISMATCH|CONFLICT/.test(message)?409:/UNAUTHORIZED|NEXT_REDIRECT/.test(message)?401:503;
  return Response.json({error:status===400?'请求内容无效。':status===401||status===403?'请重新登录并确认课程权限。':status===409?'学习会话已失效，请刷新页面。':'学习服务暂时不可用，请稍后重试。'},{status,headers});
 }
}
