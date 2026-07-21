import Link from "next/link";
import { ArrowRight, BellRing, CalendarDays, Megaphone, Pin, ShieldCheck } from "lucide-react";

import { getAnnouncementAccess } from "@/lib/announcements";
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  type AnnouncementCategory,
  type AnnouncementPriority,
} from "./config";


export const runtime = "edge";
type AnnouncementRow = {
  id: string;
  title: string;
  content: string;
  category: AnnouncementCategory;
  priority: AnnouncementPriority;
  is_pinned: boolean;
  published_at: string | null;
};

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const priorityTone: Record<AnnouncementPriority, { color: string; soft: string }> = {
  normal: { color: "var(--app-secondary)", soft: "var(--app-secondary-soft)" },
  important: { color: "var(--app-warm)", soft: "var(--app-warm-soft)" },
  urgent: { color: "#c94f45", soft: "#fff0ed" },
};

export default async function AnnouncementsPage() {
  const access = await getAnnouncementAccess();
  const { supabase } = access;
  const { data, error } = await supabase
    .from("announcements")
    .select("id,title,content,category,priority,is_pinned,published_at")
    .eq("status", "published")
    .order("is_pinned", { ascending: false })
    .order("published_at", { ascending: false, nullsFirst: false });
  const announcements = (data ?? []) as AnnouncementRow[];
  const pinnedCount = announcements.filter((item) => item.is_pinned).length;
  const importantCount = announcements.filter((item) => item.priority !== "normal").length;

  return (
    <div className="pb-12">
      <div className="mx-auto mt-5 w-full max-w-[1500px] space-y-5 px-4 sm:px-6 lg:px-8">
        {access.canAccess && (
          <div className="flex justify-end">
            <Link href="/dashboard/admin/announcements" className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-white" style={{ backgroundColor: "var(--app-secondary)" }}>进入公告后台<ArrowRight size={15} /></Link>
          </div>
        )}
        <section className="app-card overflow-hidden rounded-3xl border p-5 sm:p-6" style={{ background: "linear-gradient(125deg, var(--app-hero-end), var(--app-card-bg), var(--app-accent-soft))" }}>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-end">
            <div><span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black" style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}><BellRing size={14} />消息公告栏</span><h2 className="mt-3 text-2xl font-black tracking-tight">重要消息，一处查看</h2><p className="app-muted-text mt-2 max-w-2xl text-sm leading-6">这里只展示已经正式发布的公告。置顶、重要和紧急通知会优先排列，草稿与后台编辑功能不会出现在学生页面。</p></div>
            <div className="grid grid-cols-3 gap-3">{[["全部公告", announcements.length, Megaphone, "var(--app-accent)", "var(--app-accent-soft)"], ["置顶", pinnedCount, Pin, "var(--app-secondary)", "var(--app-secondary-soft)"], ["需关注", importantCount, ShieldCheck, "var(--app-warm)", "var(--app-warm-soft)" ]].map(([label, value, Icon, color, soft]) => { const MetricIcon = Icon as typeof Megaphone; return <div key={String(label)} className="app-card rounded-2xl border p-3 text-center"><span className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl" style={{ color: String(color), backgroundColor: String(soft) }}><MetricIcon size={17} /></span><p className="mt-2 text-2xl font-black">{String(value)}</p><p className="app-muted-text text-xs font-black">{String(label)}</p></div>; })}</div>
          </div>
        </section>

        {error && <section className="rounded-2xl border p-4 text-sm font-bold" style={{ color: "var(--app-warm)", backgroundColor: "var(--app-warm-soft)", borderColor: "var(--app-warm)" }}>公告暂时无法读取，请稍后刷新重试。</section>}

        <section className="space-y-4">
          {announcements.map((announcement) => {
            const tone = priorityTone[announcement.priority];
            return <article key={announcement.id} className="app-card rounded-3xl border p-4 sm:p-5"><div className="flex flex-wrap items-center gap-2">{announcement.is_pinned && <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black" style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}><Pin size={11} />置顶</span>}<span className="rounded-full px-2.5 py-1 text-xs font-black" style={{ color: "var(--app-secondary)", backgroundColor: "var(--app-secondary-soft)" }}>{CATEGORY_LABELS[announcement.category]}</span><span className="rounded-full px-2.5 py-1 text-xs font-black" style={{ color: tone.color, backgroundColor: tone.soft }}>{PRIORITY_LABELS[announcement.priority]}</span></div><h2 className="mt-4 text-xl font-black leading-8">{announcement.title}</h2><p className="app-muted-text mt-4 whitespace-pre-wrap text-sm leading-6">{announcement.content}</p><div className="app-muted-text mt-5 flex items-center gap-2 border-t pt-4 text-xs font-bold" style={{ borderColor: "var(--app-border-soft)" }}><CalendarDays size={13} />{announcement.published_at ? `发布于 ${dateFormatter.format(new Date(announcement.published_at))}` : "平台公告"}</div></article>;
          })}
          {!error && announcements.length === 0 && <div className="app-card rounded-3xl border border-dashed p-8 text-center"><BellRing className="mx-auto opacity-30" size={34} /><h2 className="mt-4 font-black">当前没有新公告</h2><p className="app-muted-text mt-2 text-sm">后台发布通知后，会自动显示在这里。</p></div>}
        </section>
      </div>
    </div>
  );
}
