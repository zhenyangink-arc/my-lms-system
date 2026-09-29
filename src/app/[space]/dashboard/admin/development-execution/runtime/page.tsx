import { notFound } from 'next/navigation';
import { requirePlatformOwner } from '@/lib/admin';
import { readExecutionApproval } from '@/features/development-execution/server/execution-composition.server';
import { ExecutionConsole } from '@/features/development-execution/components/execution-console';
export const dynamic='force-dynamic';export const runtime='nodejs';
export default async function Page({params}:{params:Promise<{space:string}>}){
 await requirePlatformOwner();if((await params).space!=='platform')notFound();
 let allowed=false;try{await readExecutionApproval();allowed=true;}catch{/* no execution approval means closed */}
 return <main className="p-6"><h1 className="text-xl font-semibold">开发教学执行验证</h1><p>仅限已批准的两次作答场景。不会启用教学 Agent。</p><ExecutionConsole allowed={allowed}/></main>;
}
