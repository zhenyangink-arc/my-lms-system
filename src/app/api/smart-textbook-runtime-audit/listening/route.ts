import { requirePlatformOwner } from '@/lib/admin';
import { auditSession } from '@/features/smart-textbook-runtime/server/audit-session.server';
import { listeningRequest,resolveAuditListening } from '@/features/smart-textbook-runtime/server/listening-binding.server';
import { GET as existingAudio } from '@/app/api/digital-textbook/audio/[activityId]/route';
import { GET as existingTranscript } from '@/app/api/digital-textbook/transcript/[activityId]/route';

export async function GET(request:Request){
  let ownerId:string;try{const {user}=await requirePlatformOwner();ownerId=user.id;}catch{return new Response(null,{status:403});}
  try{
    if(request.headers.get('sec-fetch-dest')==='document'||request.headers.get('sec-fetch-site')==='cross-site')return new Response(null,{status:403});
    const params=new URL(request.url).searchParams;if(new Set(params.keys()).size!==[...params.keys()].length)throw Error('Duplicate parameters');
    const input=listeningRequest.parse(Object.fromEntries(params)),session=auditSession(ownerId,input.sessionId),binding=resolveAuditListening(session,input);
    const privateUrl=new URL(request.url);privateUrl.search=`?page=${binding.page}`;
    // Reuse the original auth/RLS/published chain and byte proxy/transcript service.
    // No cookies, object keys or foreign URLs are manufactured or transferred.
    const internalRequest=new Request(privateUrl,{headers:request.headers,signal:request.signal});
    return input.kind==='audio'?await existingAudio(internalRequest,{params:Promise.resolve({activityId:binding.activityId})}):await existingTranscript(internalRequest,{params:Promise.resolve({activityId:binding.activityId})});
  }catch{return new Response(null,{status:404,headers:{'Cache-Control':'private, no-store'}});}
}
