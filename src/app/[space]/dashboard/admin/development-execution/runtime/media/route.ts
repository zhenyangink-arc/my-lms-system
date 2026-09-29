import { requirePlatformOwner } from '@/lib/admin';
import { verifyCurrentEnvironment } from '@/features/development-execution/server/execution-transport.server';
import { readFile } from 'node:fs/promises';
export const runtime='nodejs';
export async function GET(request:Request,{params}:{params:Promise<{space:string}>}){
 await requirePlatformOwner();if((await params).space!=='platform')return new Response(null,{status:404});
 await verifyCurrentEnvironment();const data=await readFile('.next/server/b3/development-video.webm');
 const range=request.headers.get('range'),m=range?/^bytes=(\d+)-(\d*)$/.exec(range):null;
 if(range&&!m)return new Response(null,{status:416});
 const start=m?Number(m[1]):0,end=m&&m[2]?Math.min(Number(m[2]),data.length-1):data.length-1;
 if(start>end)return new Response(null,{status:416});
 return new Response(new Uint8Array(data.subarray(start,end+1)),{status:m?206:200,headers:{'content-type':'video/webm','accept-ranges':'bytes','content-length':String(end-start+1),'cache-control':'private, no-store',...(m?{'content-range':`bytes ${start}-${end}/${data.length}`}:{})}});
}
