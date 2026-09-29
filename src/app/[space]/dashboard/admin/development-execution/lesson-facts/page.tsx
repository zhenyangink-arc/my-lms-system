import { notFound } from 'next/navigation';
import { requirePlatformOwner } from '@/lib/admin';
import { verifyCurrentEnvironment } from '@/features/development-execution/server/execution-transport.server';
import { readDevelopmentLessonFacts } from '@/features/development-execution/server/lesson-facts-readonly.server';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export default async function Page({params}:{params:Promise<{space:string}>}){
 await requirePlatformOwner();
 if((await params).space!=='platform')notFound();
 try{await verifyCurrentEnvironment();}catch{notFound();}
 const result=await readDevelopmentLessonFacts();
 if(!('data'in result))return <main className="p-6"><h1 className="text-xl font-semibold">课程执行事实核验</h1><p role="status">当前事实无法核验，已停止读取。</p></main>;
 const d=result.data;
 const fields=[['课程',d.lessonTitle],['活动',d.activityAlias],['作答次数',String(d.attemptCount)],['最近结果',d.latestResult==='CORRECT'?'正确':d.latestResult==='INCORRECT'?'不正确':'未知'],['活动完成',d.completionStatus==='COMPLETED'?'已完成':'未完成'],['完成度',`${d.nodeProgress?.completionPercent??0}%`],['掌握度',`${d.nodeProgress?.masteryScore??0}%`],['当前位置','暂无可核验的位置'],['证据来源',d.evidence.storage],['读取时间',d.asOf]];
 return <main className="max-w-3xl space-y-4 p-6"><h1 className="text-xl font-semibold">课程执行事实核验</h1><p>只读核验已有开发学习记录，不提交答案或改变进度。</p><dl className="space-y-3">{fields.map(([label,value])=><div key={label} className="grid gap-1 sm:grid-cols-[8rem_1fr]"><dt className="font-medium">{label}</dt><dd className="break-words">{value}</dd></div>)}</dl></main>;
}
