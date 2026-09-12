import { requirePlatformOwner } from '@/lib/admin';
import { auditTeacherBoundary } from '@/features/smart-textbook-runtime/server/audit-teacher-boundary.server';

/** Owner audit only. Does not install a student route or production Agent port. */
export async function POST(request:Request) {
  const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin'};
  if(request.headers.get('origin')!==new URL(request.url).origin||request.headers.get('sec-fetch-site')==='cross-site')return new Response(null,{status:403,headers});
  try { await requirePlatformOwner(); } catch { return new Response(null,{status:403,headers}); }
  try {
    const reader=request.body?.getReader();if(!reader)throw Error('EMPTY_BODY');let size=0;const chunks:Uint8Array<ArrayBuffer>[]=[];
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>8192){await reader.cancel();return new Response(null,{status:413,headers});}chunks.push(new Uint8Array(value));}
    const input=JSON.parse(await new Blob(chunks).text()), result=await auditTeacherBoundary(request,input);
    return result instanceof Blob ? new Response(result,{headers:{...headers,'Content-Type':result.type}}) : Response.json(result,{headers});
  } catch { return Response.json({message:'教学会话已变化或请求未通过，请重新开始讲解。'},{status:409,headers}); }
}
