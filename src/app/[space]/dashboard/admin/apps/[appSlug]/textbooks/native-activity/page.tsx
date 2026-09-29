import { notFound } from 'next/navigation';
import { requirePlatformOwner } from '@/lib/admin';
import { CreateNativeActivityForm } from '@/features/digital-textbook/components/create-native-activity-form';
import { readCanonicalBinding } from '@/features/digital-textbook/server/native-activity-authoring.server';

export default async function NativeActivityPage({params}:{params:Promise<{space:string;appSlug:string}>}) {
  const {supabase}=await requirePlatformOwner();
  const {space,appSlug}=await params;
  if(space!=='platform'||appSlug!=='korean')notFound();
  const binding=await readCanonicalBinding(supabase);
  return <main className="mx-auto max-w-2xl space-y-4 p-6">
    <h1 className="text-2xl font-semibold">韩文字母入门 · 课前导航</h1>
    <p>第0章 · 教学脚本第1版草稿 · 8个冻结小节</p>
    <CreateNativeActivityForm binding={binding}/>
  </main>;
}
