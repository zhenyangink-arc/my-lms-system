import { requirePlatformOwner } from '@/lib/admin';
import { auditSession } from '@/features/smart-textbook-runtime/server/audit-session.server';
import { auditCharacterRequest,auditCharacterSelection,proxyAuthorizedCharacter } from '@/features/smart-textbook-runtime/server/audit-speech.server';
import { GET as existingCharacter } from '@/app/api/learning-agent/characters/[pose]/route';

export async function GET(request:Request){
  let ownerId:string;try{const {user}=await requirePlatformOwner();ownerId=user.id;}catch{return new Response(null,{status:403});}
  try{
    if(request.headers.get('sec-fetch-dest')==='document'||request.headers.get('sec-fetch-site')==='cross-site')return new Response(null,{status:403});
    const params=new URL(request.url).searchParams;if(new Set(params.keys()).size!==[...params.keys()].length)throw Error('Duplicate parameters');
    const input=auditCharacterRequest.parse(Object.fromEntries(params)),session=auditSession(ownerId,input.sessionId),pose=auditCharacterSelection(session,input),account=process.env.R2_ACCOUNT_ID;
    if(!account||!/^[a-z0-9]+$/i.test(account))throw Error('Missing media configuration');
    return await proxyAuthorizedCharacter(request,()=>existingCharacter(request,{params:Promise.resolve({pose})}),`https://${account}.r2.cloudflarestorage.com`);
  }catch{return new Response(null,{status:404,headers:{'Cache-Control':'private, no-store'}});}
}
