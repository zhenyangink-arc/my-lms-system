import {auditRecording} from '@/features/smart-textbook-runtime/server/audit-recording.server';
import {requirePlatformOwner} from '@/lib/admin';
/** Owner-only audit byte proxy. No recording-domain persistence import. */
export async function POST(request:Request){
  const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin'};
  if(request.headers.get('origin')!==new URL(request.url).origin||request.headers.get('sec-fetch-site')==='cross-site')return new Response(null,{status:403,headers});
  try{await requirePlatformOwner();}catch{return new Response(null,{status:403,headers});}
  try{
    // Bound the actual stream, not merely the client Content-Length header.
    const reader=request.body?.getReader();if(!reader)throw Error('EMPTY');const chunks:Uint8Array<ArrayBuffer>[]=[];let bytes=0;
    while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>11*1024*1024){await reader.cancel();return new Response(null,{status:413,headers});}chunks.push(new Uint8Array(value));}
    const body=new Blob(chunks),copy=new Request(request.url,{method:'POST',headers:request.headers,body});
    let input:unknown,blob:Blob|undefined;
    if(request.headers.get('content-type')?.startsWith('multipart/form-data')){
      const form=await copy.formData();if([...form.keys()].some(k=>!['request','recording'].includes(k))||form.getAll('request').length!==1||form.getAll('recording').length!==1)throw Error('FIELDS');
      input=JSON.parse(String(form.get('request')));const file=form.get('recording');if(!(file instanceof File))throw Error('FILE');blob=file;
    }else{if(bytes>8192)throw Error('BODY');input=await copy.json();}
    const result=await auditRecording(input,request.signal,blob);
    return result instanceof Blob?new Response(result,{headers:{...headers,'Content-Type':result.type}}):Response.json(result,{headers});
  }catch{return Response.json({message:'录音操作未通过，请检查权限、会话和录音要求后重试。'},{status:400,headers});}
}
