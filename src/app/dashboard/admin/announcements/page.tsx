import Link from "next/link";
import { Archive, ArrowRight, BellRing, FilePenLine, Megaphone, Pin, Send, ShieldCheck } from "lucide-react";

import { DashboardPageHeader } from "@/app/dashboard/DashboardPageHeader";
import { AnnouncementAdminManager } from "@/app/dashboard/announcements/AnnouncementAdminManager";
import { AnnouncementComposer } from "@/app/dashboard/announcements/AnnouncementComposer";
import { AnnouncementEditor } from "@/app/dashboard/announcements/AnnouncementEditor";
import { AnnouncementStatusActions } from "@/app/dashboard/announcements/AnnouncementStatusActions";
import { CATEGORY_LABELS, PRIORITY_LABELS, STATUS_LABELS, type AnnouncementCategory, type AnnouncementPriority, type AnnouncementStatus } from "@/app/dashboard/announcements/config";
import { requireAnnouncementAccess } from "@/lib/announcements";


export const runtime = "edge";
type AnnouncementRow = { id: string; title: string; content: string; category: AnnouncementCategory; priority: AnnouncementPriority; status: AnnouncementStatus; is_pinned: boolean; published_at: string | null; updated_at: string };
type ProfileRow = { id: string; full_name: string | null; email: string | null };

const statusTone: Record<AnnouncementStatus, { color: string; soft: string }> = {
  draft: { color: "var(--app-muted)", soft: "var(--app-soft-bg)" },
  published: { color: "var(--app-success)", soft: "var(--app-success-soft)" },
  archived: { color: "var(--app-warm)", soft: "var(--app-warm-soft)" },
};
const priorityTone: Record<AnnouncementPriority, { color: string; soft: string }> = {
  normal: { color: "var(--app-secondary)", soft: "var(--app-secondary-soft)" },
  important: { color: "var(--app-warm)", soft: "var(--app-warm-soft)" },
  urgent: { color: "#c94f45", soft: "#fff0ed" },
};

export default async function AnnouncementManagementPage() {
  const { supabase, canAssignAdmins, role } = await requireAnnouncementAccess();
  const { data, error } = await supabase.from("announcements").select("id,title,content,category,priority,status,is_pinned,published_at,updated_at").order("is_pinned", { ascending: false }).order("updated_at", { ascending: false });
  const announcements = (data ?? []) as AnnouncementRow[];

  let adminOptions: Array<{ id: string; name: string; email: string; assigned: boolean }> = [];
  if (canAssignAdmins) {
    const [{ data: admins }, { data: assignments }] = await Promise.all([
      supabase.from("profiles").select("id,full_name,email").eq("role", "admin").eq("status", "active").order("full_name", { ascending: true }),
      supabase.from("announcement_admin_assignments").select("admin_id").is("revoked_at", null),
    ]);
    const assignedIds = new Set((assignments ?? []).map((assignment) => assignment.admin_id as string));
    adminOptions = ((admins ?? []) as ProfileRow[]).map((admin) => ({ id: admin.id, name: admin.full_name?.trim() || "未填写姓名", email: admin.email || "未填写邮箱", assigned: assignedIds.has(admin.id) }));
  }

  const publishedCount = announcements.filter((item) => item.status === "published").length;
  const draftCount = announcements.filter((item) => item.status === "draft").length;
  const archivedCount = announcements.filter((item) => item.status === "archived").length;

  return (
    <div className="pb-12">
      <DashboardPageHeader title="通知公告管理" description="起草、发布、修改和归档平台公告。" action={<Link href="#publish-announcement" className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-white" style={{ backgroundColor: "var(--app-accent)" }}><FilePenLine size={16} />新建公告</Link>} />
      <div className="mx-auto mt-5 w-full max-w-[1500px] space-y-5 px-4 sm:px-6 lg:px-8">
        <section className="app-card rounded-3xl border p-5 sm:p-6" style={{ background: "linear-gradient(125deg, var(--app-card-bg), var(--app-hero-start), var(--app-accent-soft))" }}><div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_500px] xl:items-end"><div><span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black" style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}><ShieldCheck size={14} />{role === "tenant_super_admin" ? "负责人权限" : role === "ceo" ? "运营负责人权限" : "已授权管理员"}</span><h2 className="mt-3 text-2xl font-black tracking-tight">公告编辑与学生查看彻底分开</h2><p className="app-muted-text mt-2 max-w-2xl text-sm leading-6">这里可以查看草稿和归档记录并进行编辑；学生公告栏只会读取已经发布的内容。</p></div><div className="grid grid-cols-3 gap-3">{[["已发布", publishedCount, Send, "var(--app-success)", "var(--app-success-soft)"], ["草稿", draftCount, FilePenLine, "var(--app-accent)", "var(--app-accent-soft)"], ["已归档", archivedCount, Archive, "var(--app-warm)", "var(--app-warm-soft)" ]].map(([label, value, Icon, color, soft]) => { const MetricIcon = Icon as typeof Send; return <div key={String(label)} className="app-card rounded-2xl border p-4 text-center"><span className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl" style={{ color: String(color), backgroundColor: String(soft) }}><MetricIcon size={17} /></span><p className="mt-2 text-2xl font-black">{String(value)}</p><p className="app-muted-text text-xs font-black">{String(label)}</p></div>; })}</div></div></section>
        {error && <section className="rounded-2xl border p-4 text-sm font-bold" style={{ color: "var(--app-warm)", backgroundColor: "var(--app-warm-soft)", borderColor: "var(--app-warm)" }}>公告后台数据暂时无法读取，请确认数据库迁移已经执行。</section>}
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(330px,0.75fr)_minmax(0,1.35fr)]"><div className="space-y-5"><AnnouncementComposer />{canAssignAdmins && <AnnouncementAdminManager admins={adminOptions} />}<Link href="/dashboard/announcements" className="app-soft-card flex items-center gap-3 rounded-2xl border p-4 text-xs font-black"><BellRing size={16} style={{ color: "var(--app-accent)" }} />查看学生公告栏<ArrowRight className="ml-auto" size={14} /></Link></div><section className="app-card rounded-3xl border p-4 sm:p-5"><div className="flex items-center justify-between"><div><h2 className="flex items-center gap-2 text-xl font-black"><Megaphone size={19} style={{ color: "var(--app-accent)" }} />公告记录</h2><p className="app-muted-text mt-1 text-xs">共 {announcements.length} 条公告</p></div></div><div className="mt-5 space-y-4">{announcements.map((announcement) => { const status = statusTone[announcement.status]; const priority = priorityTone[announcement.priority]; return <article key={announcement.id} className="app-soft-card rounded-3xl border p-5"><div className="flex flex-wrap items-center gap-2">{announcement.is_pinned && <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black" style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}><Pin size={11} />置顶</span>}<span className="rounded-full px-2.5 py-1 text-xs font-black" style={{ color: "var(--app-secondary)", backgroundColor: "var(--app-secondary-soft)" }}>{CATEGORY_LABELS[announcement.category]}</span><span className="rounded-full px-2.5 py-1 text-xs font-black" style={{ color: priority.color, backgroundColor: priority.soft }}>{PRIORITY_LABELS[announcement.priority]}</span><span className="rounded-full px-2.5 py-1 text-xs font-black" style={{ color: status.color, backgroundColor: status.soft }}>{STATUS_LABELS[announcement.status]}</span></div><h3 className="mt-4 text-lg font-black">{announcement.title}</h3><p className="app-muted-text mt-3 whitespace-pre-wrap text-sm leading-6">{announcement.content}</p><div className="mt-4 space-y-3 border-t pt-4" style={{ borderColor: "var(--app-border-soft)" }}><AnnouncementStatusActions id={announcement.id} status={announcement.status} /><AnnouncementEditor announcement={{ id: announcement.id, title: announcement.title, content: announcement.content, category: announcement.category, priority: announcement.priority, isPinned: announcement.is_pinned }} /></div></article>; })}{!error && announcements.length === 0 && <div className="rounded-3xl border border-dashed p-8 text-center"><Megaphone className="mx-auto opacity-30" size={30} /><p className="mt-3 font-black">还没有公告</p><p className="app-muted-text mt-2 text-xs">从左侧创建第一条公告。</p></div>}</div></section></div>
      </div>
    </div>
  );
}
