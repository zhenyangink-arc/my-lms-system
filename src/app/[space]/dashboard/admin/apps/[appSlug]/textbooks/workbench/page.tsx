import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePlatformOwner } from '@/lib/admin';
import { ManagementApplicationSectionFrame, requireManagementApplicationSection } from '@/app/dashboard/admin/apps/ManagementApplicationSectionPage';
import { chapterWorkbenchOperation } from '@/features/digital-textbook/workbench/service.server';
import { ChapterWorkbench } from '@/features/digital-textbook/workbench/chapter-workbench';

export default async function ChapterWorkbenchPage({params}:{params:Promise<{space:string;appSlug:string}>}) {
  await requirePlatformOwner();
  const {space,appSlug}=await params;
  if(appSlug!=='korean')notFound();
  const context=await requireManagementApplicationSection(space,appSlug,'textbooks');
  const result=await chapterWorkbenchOperation({operation:'read'});
  const base=context.access.appPath;
  return <ManagementApplicationSectionFrame {...context}>
    <Link href={`${base}/textbooks?chapter=cda24fb8-c93b-4a19-9577-4418350ff708`} className="mb-4 inline-flex min-h-11 items-center text-sm text-muted-foreground hover:text-foreground">← 返回第一章教材制作</Link>
    {result.ok&&result.kind==='read'?<ChapterWorkbench initial={result.data}
      contentHref={`${base}/textbooks?chapter=cda24fb8-c93b-4a19-9577-4418350ff708`}
      previewHref={`${base}/teaching-scripts/runtime-v1-preview`}
      scriptsHref={`${base}/teaching-scripts`}/>:<p role="alert">{!result.ok?result.message:'暂时无法读取第一章。'}</p>}
  </ManagementApplicationSectionFrame>;
}
