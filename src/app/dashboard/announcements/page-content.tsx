import Link from "next/link";
import { DashboardTitleWithHint } from "@/app/dashboard/DashboardTitleWithHint";
import { ArrowRight, BellRing, CalendarDays, Megaphone, Pin, ShieldCheck } from "lucide-react";

import { LocalDateTime } from "@/components/LocalDateTime";
import { getAnnouncementAccess } from "@/lib/announcements";
import { getPublishedAnnouncementsForTenant } from "@/lib/published-tenant-content";
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  type AnnouncementCategory,
  type AnnouncementPriority,
} from "./config";
import { AnnouncementReadTracker } from "./AnnouncementReadTracker";


type AnnouncementRow = {
  id: string;
  title: string;
  content: string;
  category: AnnouncementCategory;
  priority: AnnouncementPriority;
  is_pinned: boolean;
  scope: "platform" | "tenant";
  tenant_id: string | null;
  published_at: string | null;
};

type TenantRow = { id: string; name: string };

const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

const priorityTone: Record<AnnouncementPriority, { color: string; soft: string }> = {
  normal: { color: "var(--support)", soft: "var(--support-surface)" },
  important: { color: "var(--status-warning)", soft: "var(--status-warning-surface)" },
  urgent: { color: "var(--destructive)", soft: "var(--surface-soft)" },
};

export default async function AnnouncementsPage() {
  const access = await getAnnouncementAccess();
  const { supabase } = access;
  const { data, error } = access.tenantId
    ? await getPublishedAnnouncementsForTenant(access.tenantId)
        .then((result) => ({ data: result.data, error: null }))
        .catch(() =>
          supabase
            .from("announcements")
            .select("id,title,content,category,priority,is_pinned,scope,tenant_id,published_at")
            .eq("status", "published")
            .order("is_pinned", { ascending: false })
            .order("published_at", { ascending: false, nullsFirst: false }),
        )
    : await supabase
        .from("announcements")
        .select("id,title,content,category,priority,is_pinned,scope,tenant_id,published_at")
        .eq("status", "published")
        .order("is_pinned", { ascending: false })
        .order("published_at", { ascending: false, nullsFirst: false });
  const announcements = (data ?? []) as AnnouncementRow[];
  const tenantIds = [...new Set(announcements.flatMap((item) => item.tenant_id ? [item.tenant_id] : []))];
  const { data: tenantData, error: tenantError } = tenantIds.length
    ? await supabase.from("tenants").select("id,name").in("id", tenantIds)
    : { data: [] as TenantRow[], error: null };
  const tenantNames = new Map(((tenantData ?? []) as TenantRow[]).map((tenant) => [tenant.id, tenant.name]));
  const pinnedCount = announcements.filter((item) => item.is_pinned).length;
  const importantCount = announcements.filter((item) => item.priority !== "normal").length;

  return (
    <div className="pb-12">
      <div className="mx-auto mt-5 w-full max-w-[1500px] space-y-5 px-4 sm:px-6 lg:px-8">
        {access.canAccess && (
          <div className="flex justify-end">
            <Link href="/dashboard/admin/announcements" className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white" style={{ backgroundColor: "var(--support)" }}>进入公告后台<ArrowRight size={15} aria-hidden="true" /></Link>
          </div>
        )}
        <section className="app-card overflow-hidden rounded-3xl border p-5 sm:p-6" style={{ background: "linear-gradient(125deg, var(--accent), var(--card), var(--accent))" }}>
          <div className={access.canAccess ? "grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-center" : "grid"}>
            {access.canAccess && <div><span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold" style={{ color: "var(--primary)", backgroundColor: "var(--accent)" }}><BellRing size={14} aria-hidden="true" />消息公告栏</span><DashboardTitleWithHint className="mt-3" headingLevel={2} title="重要消息，一处查看" description="这里只展示已经正式发布的公告。置顶、重要和紧急通知会优先排列，草稿与后台编辑功能不会出现在学生页面。" /></div>}
            <div className={access.canAccess ? "dashboard-title-metrics" : "grid grid-cols-3 gap-2"}>{[["全部公告", announcements.length, Megaphone, "var(--primary)", "var(--accent)"], ["置顶", pinnedCount, Pin, "var(--support)", "var(--support-surface)"], ["需关注", importantCount, ShieldCheck, "var(--status-warning)", "var(--status-warning-surface)" ]].map(([label, value, Icon, color, soft]) => { const MetricIcon = Icon as typeof Megaphone; return <div key={String(label)} className="app-card rounded-2xl border p-3 text-center"><span className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl" style={{ color: String(color), backgroundColor: String(soft) }}><MetricIcon size={17} aria-hidden="true" /></span><p className="mt-2 text-2xl font-bold">{String(value)}</p><p className="app-muted-text text-xs font-bold">{String(label)}</p></div>; })}</div>
          </div>
        </section>

        {(error || tenantError) && <section role="alert" className="rounded-2xl border p-4 text-sm font-bold" style={{ color: "var(--status-warning)", backgroundColor: "var(--status-warning-surface)", borderColor: "var(--status-warning)" }}>公告暂时无法完整读取，请稍后刷新重试。</section>}

        <section className="space-y-4">
          {announcements.map((announcement) => {
            const tone = priorityTone[announcement.priority];
            const source = announcement.scope === "platform"
              ? "平台公告 · 全部机构可见"
              : `${tenantNames.get(announcement.tenant_id ?? "") ?? "本机构"}公告`;
            return <article key={announcement.id} className="app-card rounded-3xl border p-4 sm:p-5"><AnnouncementReadTracker announcementId={announcement.id} /><div className="flex flex-wrap items-center gap-2">{announcement.is_pinned && <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold" style={{ color: "var(--primary)", backgroundColor: "var(--accent)" }}><Pin size={11} aria-hidden="true" />置顶</span>}<span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ color: announcement.scope === "platform" ? "var(--support)" : "var(--primary)", backgroundColor: announcement.scope === "platform" ? "var(--support-surface)" : "var(--accent)" }}>{source}</span><span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ color: "var(--support)", backgroundColor: "var(--support-surface)" }}>{CATEGORY_LABELS[announcement.category]}</span><span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ color: tone.color, backgroundColor: tone.soft }}>{PRIORITY_LABELS[announcement.priority]}</span></div><h2 className="mt-4 text-xl font-bold leading-8">{announcement.title}</h2><p className="app-muted-text mt-4 whitespace-pre-wrap text-sm leading-6">{announcement.content}</p><div className="app-muted-text mt-5 flex items-center gap-2 border-t pt-4 text-xs font-bold" style={{ borderColor: "var(--border-subtle)" }}><CalendarDays size={13} aria-hidden="true" />{announcement.published_at ? <>发布于 <LocalDateTime value={announcement.published_at} options={DATE_TIME_OPTIONS} /></> : source}</div></article>;
          })}
          {!error && announcements.length === 0 && <div className="app-card rounded-3xl border border-dashed p-8 text-center"><BellRing className="mx-auto opacity-30" size={34} aria-hidden="true" /><h2 className="mt-4 font-bold">当前没有新公告</h2></div>}
        </section>
      </div>
    </div>
  );
}
