import 'server-only';
import {applicationRuntimeRequest} from './application-runtime.server';

const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin'};
/** Bounded transport only; opaque envelopes are closed by existing boundaries. */
export async function runtimeApplicationPost(request:Request,kind:'learning'|'teacher'){
 const configuredOrigin=process.env.SMART_TEXTBOOK_RELEASE_ORIGIN;
 let expectedOrigin:string;
 try{expectedOrigin=configuredOrigin?new URL(configuredOrigin).origin:new URL(request.url).origin;}
 catch{return new Response(null,{status:403,headers});}
 // Behind the approved HTTPS reverse proxy request.url can describe the
 // internal Next listener. Compare the browser Origin with the fixed,
 // server-owned canonical origin; never trust forwarded Host/proto headers.
 if(request.headers.get('origin')!==expectedOrigin||request.headers.get('sec-fetch-site')==='cross-site')return new Response(null,{status:403,headers});
 try{
  const reader=request.body?.getReader();if(!reader)throw Error('EMPTY');const chunks:Uint8Array<ArrayBuffer>[]=[];let size=0;
  while(true){const v=await reader.read();if(v.done)break;size+=v.value.byteLength;if(size>11*1024*1024){await reader.cancel();return new Response(null,{status:413,headers});}chunks.push(new Uint8Array(v.value));}
  const copy=new Request(request.url,{method:'POST',headers:request.headers,body:new Blob(chunks)});let input:unknown,blob:Blob|undefined;
  if(request.headers.get('content-type')?.startsWith('multipart/form-data')){
   const f=await copy.formData();if([...f.keys()].some(k=>!['request','recording'].includes(k))||f.getAll('request').length!==1||f.getAll('recording').length!==1)throw Error('FIELDS');
   const raw=f.get('request');if(typeof raw!=='string'||raw.length>65536)throw Error('ENVELOPE');input=JSON.parse(raw);
   const file=f.get('recording');if(!(file instanceof File))throw Error('FILE');blob=file;
  }else{if(size>65536||!request.headers.get('content-type')?.startsWith('application/json'))throw Error('JSON');input=await copy.json();}
  const value=await applicationRuntimeRequest(request,kind,input,blob);
  return value instanceof Blob?new Response(value,{headers:{...headers,'Content-Type':value.type}}):Response.json(value??null,{headers});
 }catch{
  // Never log exception payloads, private revisions, storage details or proofs.
  return Response.json({code:'RUNTIME_REQUEST_REJECTED',message:'教材请求未通过权限、会话或服务检查，请返回课程后重试。'},{status:409,headers});
 }
}
