import { notFound } from 'next/navigation';
import { requirePlatformOwner } from '@/lib/admin';
import { readProvisioningEntrypoint } from '@/features/development-execution/server/provisioning-entrypoint.server';
import { ProvisioningForm } from '@/features/development-execution/components/provisioning-form';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function DevelopmentExecutionPage({ params }: { params: Promise<{ space: string }> }) {
  const { supabase } = await requirePlatformOwner();
  if ((await params).space !== 'platform') notFound();
  const state = await readProvisioningEntrypoint(supabase);
  return <main className="mx-auto max-w-2xl space-y-6 p-6">
    <h1 className="text-2xl font-semibold">开发执行身份</h1>
    <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-3">
      <dt>目标</dt><dd className="break-words">development-domain-execution/1</dd>
      <dt>环境</dt><dd>canonical development</dd>
      <dt>执行主体</dt><dd>1 个稳定复用的非个人主体</dd>
      <dt>租户</dt><dd>1 个专用开发租户</dd>
      <dt>安全合同</dt><dd>INITIAL-BAN / NO USABLE SESSION</dd>
      <dt>预期写入</dt><dd>15 INSERT / 8 UPDATE / 0 DELETE</dd>
      <dt>作答 / 进度</dt><dd>0 / 0</dd>
      <dt>执行范围</dt><dd>DISABLED</dd>
    </dl>
    <ProvisioningForm state={state.status}/>
  </main>;
}
