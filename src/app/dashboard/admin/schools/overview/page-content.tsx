import Link from "next/link";
import { ArrowLeft, ArrowRight, CircleAlert, CircleCheckBig, ImageOff } from "lucide-react";

import { DashboardPageHeader } from "../../../DashboardPageHeader";
import { requireAdmin } from "@/lib/admin";
import { SchoolCrest } from "@/components/school/SchoolCrest";
import { schoolCategories } from "../school-config";


type SchoolRow = { id: string; category: string; name_zh: string; logo_url: string | null; is_published: boolean; detailed_introduction: string | null };

export default async function SchoolOverviewPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("schools").select("id, category, name_zh, logo_url, is_published, detailed_introduction").order("updated_at", { ascending: false });
  const schools = (data ?? []) as SchoolRow[];
  const incomplete = schools.filter((school) => !school.logo_url || !school.detailed_introduction);

  return <><DashboardPageHeader title="学校总览" description="集中检查五类学校的数据数量、发布状态与资料完整度。" /><div className="mx-auto w-full max-w-[1500px] space-y-5 p-4 sm:p-5"><Link href="/dashboard/admin/schools" className="inline-flex items-center gap-2 text-xs font-black app-muted-text"><ArrowLeft size={14} />返回学校管理</Link><section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">{schoolCategories.map((category) => { const list=schools.filter((item)=>item.category===category.value); const complete=list.filter((item)=>item.logo_url&&item.detailed_introduction).length; return <Link key={category.slug} href={`/dashboard/admin/schools/${category.slug}`} className="app-card rounded-2xl border p-4"><div className="flex items-center justify-between"><h2 className="font-black">{category.label}</h2><ArrowRight size={15} /></div><p className="mt-3 text-2xl font-black">{list.length}</p><p className="app-muted-text mt-1 text-xs">资料完整 {complete} 所</p></Link>; })}</section><section className="app-card rounded-3xl border p-5"><div className="flex items-center justify-between"><div><h2 className="text-lg font-black">待完善资料</h2><p className="app-muted-text mt-1 text-xs">缺少校徽或详细介绍的学校会出现在这里。</p></div>{incomplete.length ? <CircleAlert className="text-amber-500" /> : <CircleCheckBig className="text-emerald-500" />}</div><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{incomplete.slice(0,18).map((school)=>{const category=schoolCategories.find((item)=>item.value===school.category); return <Link key={school.id} href={`/dashboard/admin/schools/${category?.slug}/${school.id}`} className="app-soft-card flex items-center gap-3 rounded-2xl border p-3"><SchoolCrest logoUrl={school.logo_url} name={school.name_zh} size="sm"/><span className="min-w-0 flex-1"><span className="block truncate text-sm font-black">{school.name_zh}</span><span className="app-muted-text mt-1 block text-xs">{category?.label} · {!school.logo_url ? "缺校徽" : "缺详细介绍"}</span></span><ImageOff size={15} className="app-muted-text" /></Link>;})}{incomplete.length===0&&<p className="app-muted-text col-span-full py-10 text-center text-sm">当前学校资料均已完整。</p>}</div></section></div></>;
}
