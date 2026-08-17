"use client";

import Link from "next/link";
import {
  BellRing,
  ChevronDown,
  ChevronRight,
  FilePenLine,
  Megaphone,
  Pin,
  Plus,
  Search,
  Send,
} from "lucide-react";
import { Fragment, useActionState, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  type AnnouncementCategory,
  type AnnouncementPriority,
  type AnnouncementStatus,
} from "@/app/dashboard/announcements/config";
import {
  createAnnouncementAction,
  updateAnnouncementAction,
} from "@/app/dashboard/announcements/actions";
import { initialAnnouncementActionState } from "@/app/dashboard/announcements/action-state";
import { AnnouncementStatusActions } from "@/app/dashboard/announcements/AnnouncementStatusActions";
import { LocalDateTime } from "@/components/LocalDateTime";

export type ManagedAnnouncement = {
  id: string;
  title: string;
  content: string;
  category: AnnouncementCategory;
  priority: AnnouncementPriority;
  status: AnnouncementStatus;
  isPinned: boolean;
  scope: "platform" | "tenant";
  tenantId: string | null;
  tenantName: string;
  authorName: string;
  publishedAt: string | null;
  updatedAt: string;
  readCount: number;
  audienceCount: number;
};

export type AnnouncementTenantOption = {
  id: string;
  name: string;
};

const FILTERS = [
  ["all", "全部"],
  ["published", "已发布"],
  ["draft", "草稿"],
  ["archived", "已归档"],
] as const;

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

function FormattedDate({ value }: { value: string | null }) {
  return <LocalDateTime value={value} options={DATE_OPTIONS} />;
}

function statusTone(status: AnnouncementStatus) {
  if (status === "published") return "bg-emerald-50 text-emerald-700";
  if (status === "archived") return "bg-amber-50 text-amber-700";
  return "bg-zinc-100 text-zinc-600";
}

function priorityTone(priority: AnnouncementPriority) {
  if (priority === "urgent") return "bg-rose-50 text-rose-700";
  if (priority === "important") return "bg-amber-50 text-amber-700";
  return "bg-sky-50 text-sky-700";
}

function AnnouncementFields({
  announcement,
}: {
  announcement?: ManagedAnnouncement;
}) {
  return (
    <div className="border border-black/[0.08] text-[10px]">
      <label className="grid border-b border-black/[0.07] sm:grid-cols-[130px_minmax(0,1fr)]">
        <span className="bg-zinc-50/60 px-3 py-3 font-medium text-zinc-500">公告标题</span>
        <span className="p-2"><input name="title" required minLength={2} maxLength={120} defaultValue={announcement?.title} placeholder="填写清晰、可执行的公告标题" className="app-input w-full border px-3 py-2.5 text-xs outline-none" /></span>
      </label>
      <div className="grid border-b border-black/[0.07] sm:grid-cols-2">
        <label className="grid border-b border-black/[0.07] sm:grid-cols-[130px_minmax(0,1fr)] sm:border-b-0 sm:border-r">
          <span className="bg-zinc-50/60 px-3 py-3 font-medium text-zinc-500">公告分类</span>
          <span className="p-2"><select name="category" defaultValue={announcement?.category ?? "general"} className="app-input w-full border px-3 py-2.5 text-xs">{Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></span>
        </label>
        <label className="grid sm:grid-cols-[130px_minmax(0,1fr)]">
          <span className="bg-zinc-50/60 px-3 py-3 font-medium text-zinc-500">重要程度</span>
          <span className="p-2"><select name="priority" defaultValue={announcement?.priority ?? "normal"} className="app-input w-full border px-3 py-2.5 text-xs">{Object.entries(PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></span>
        </label>
      </div>
      <label className="grid border-b border-black/[0.07] sm:grid-cols-[130px_minmax(0,1fr)]">
        <span className="bg-zinc-50/60 px-3 py-3 font-medium text-zinc-500">公告内容</span>
        <span className="p-2"><textarea name="content" required minLength={2} maxLength={5000} rows={9} defaultValue={announcement?.content} placeholder="写明执行时间、适用人员和需要完成的动作" className="app-input w-full resize-y border px-3 py-2.5 text-xs leading-5 outline-none" /></span>
      </label>
      <label className="flex min-h-11 items-center gap-3 px-3 text-[10px] text-zinc-600">
        <input name="is_pinned" type="checkbox" defaultChecked={announcement?.isPinned} className="size-3.5" />
        置顶这条公告
        <span className="ml-auto text-zinc-400">平台置顶作用于全部机构；机构置顶只作用于本机构</span>
      </label>
    </div>
  );
}

function CreateAnnouncementDialog({ scope }: { scope: "platform" | "tenant" }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createAnnouncementAction, initialAnnouncementActionState);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-8 items-center gap-2 border border-zinc-900 bg-zinc-900 px-3 text-[10px] font-medium text-white">
        <Plus size={12} />新建公告
      </button>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto rounded-none border-black/[0.12] p-0">
        <DialogHeader className="border-b border-black/[0.08] px-5 py-4 text-left">
          <DialogTitle className="text-base font-semibold tracking-[-0.02em]">新建{scope === "platform" ? "全平台" : "本机构"}公告</DialogTitle>
          <DialogDescription className="text-[10px] text-zinc-500">发布范围由当前身份自动确定，不能手动改成其他机构或全平台。</DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4 px-5 pb-5">
          <AnnouncementFields />
          {state.message && <p className={`border px-3 py-2 text-[10px] ${state.status === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{state.message}</p>}
          <div className="flex justify-end gap-2">
            <button type="submit" name="intent" value="draft" disabled={pending} className="h-8 border border-black/[0.1] bg-white px-3 text-[10px] font-medium text-zinc-700 disabled:opacity-50">保存草稿</button>
            <button type="submit" name="intent" value="publish" disabled={pending} className="inline-flex h-8 items-center gap-2 border border-emerald-700 bg-emerald-700 px-3 text-[10px] font-medium text-white disabled:opacity-50"><Send size={12} />{pending ? "保存中…" : "立即发布"}</button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditAnnouncementDialog({ announcement }: { announcement: ManagedAnnouncement }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(updateAnnouncementAction.bind(null, announcement.id), initialAnnouncementActionState);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-7 items-center gap-1.5 border border-black/[0.08] bg-white px-2.5 text-[9px] font-medium text-zinc-700"><FilePenLine size={11} />编辑</button>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto rounded-none border-black/[0.12] p-0">
        <DialogHeader className="border-b border-black/[0.08] px-5 py-4 text-left">
          <DialogTitle className="text-base font-semibold tracking-[-0.02em]">编辑公告</DialogTitle>
          <DialogDescription className="text-[10px] text-zinc-500">只能修改当前发布范围内的公告，发布来源不能变更。</DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4 px-5 pb-5">
          <AnnouncementFields announcement={announcement} />
          {state.message && <p className={`border px-3 py-2 text-[10px] ${state.status === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{state.message}</p>}
          <div className="flex justify-end"><button type="submit" disabled={pending} className="h-8 border border-zinc-900 bg-zinc-900 px-4 text-[10px] font-medium text-white disabled:opacity-50">{pending ? "保存中…" : "保存修改"}</button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AnnouncementRows({
  announcements,
  editable,
  expandedIds,
  onToggle,
}: {
  announcements: ManagedAnnouncement[];
  editable: boolean;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  return announcements.map((announcement) => {
    const expanded = expandedIds.has(announcement.id);
    const readRate = announcement.audienceCount > 0 ? Math.round((announcement.readCount / announcement.audienceCount) * 100) : 0;
    return (
      <Fragment key={announcement.id}>
        <tr className="h-[52px] border-b border-black/[0.07] text-[10px] hover:bg-zinc-50/60">
          <td className="px-3"><button type="button" onClick={() => onToggle(announcement.id)} className="flex size-6 items-center justify-center text-zinc-400 hover:text-zinc-950" aria-label={expanded ? `收起 ${announcement.title}` : `展开 ${announcement.title}`}>{expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</button></td>
          <td className="border-r border-black/[0.06] px-3"><div className="flex items-center gap-2"><span className={`size-1.5 shrink-0 rounded-full ${announcement.isPinned ? "bg-violet-500" : "bg-zinc-300"}`} /><div className="min-w-0"><p className="truncate font-medium text-zinc-950">{announcement.title}</p><p className="mt-0.5 truncate text-[9px] text-zinc-400">{announcement.authorName}</p></div>{announcement.isPinned && <Pin size={10} className="ml-auto shrink-0 text-violet-600" />}</div></td>
          <td className="px-3 text-zinc-600">{announcement.scope === "platform" ? "平台公告" : announcement.tenantName}</td>
          <td className="px-3 text-zinc-500">{CATEGORY_LABELS[announcement.category]}</td>
          <td className="px-3"><span className={`inline-flex px-2 py-1 text-[9px] font-medium ${priorityTone(announcement.priority)}`}>{PRIORITY_LABELS[announcement.priority]}</span></td>
          <td className="px-3"><span className={`inline-flex px-2 py-1 text-[9px] font-medium ${statusTone(announcement.status)}`}>{STATUS_LABELS[announcement.status]}</span></td>
          <td className="px-3 text-right font-mono tabular-nums text-zinc-600">{announcement.readCount} / {announcement.audienceCount}</td>
          <td className="px-3 text-right font-mono tabular-nums text-zinc-500">{announcement.status === "published" ? `${readRate}%` : "—"}</td>
          <td className="px-3 font-mono text-[9px] text-zinc-400"><FormattedDate value={announcement.publishedAt} /></td>
          <td className="px-3 font-mono text-[9px] text-zinc-400"><FormattedDate value={announcement.updatedAt} /></td>
          <td className="px-5"><div className="flex justify-end gap-1">{editable ? <><EditAnnouncementDialog announcement={announcement} /><AnnouncementStatusActions id={announcement.id} status={announcement.status} /></> : <span className="text-[9px] text-zinc-400">只读巡检</span>}</div></td>
        </tr>
        {expanded && (
          <tr className="border-b border-black/[0.08] bg-zinc-50/45">
            <td colSpan={11} className="px-12 py-4">
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
                <div><p className="text-[8px] uppercase tracking-[0.07em] text-zinc-400">公告正文</p><p className="mt-2 whitespace-pre-wrap text-[11px] leading-6 text-zinc-700">{announcement.content}</p></div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-l border-black/[0.07] pl-5 text-[9px] text-zinc-500"><div><dt className="text-zinc-400">可见范围</dt><dd className="mt-0.5 font-medium text-zinc-700">{announcement.scope === "platform" ? "全部机构及成员" : `仅 ${announcement.tenantName}`}</dd></div><div><dt className="text-zinc-400">阅读率</dt><dd className="mt-0.5 font-mono text-zinc-700">{announcement.status === "published" ? `${readRate}%` : "尚未发布"}</dd></div><div><dt className="text-zinc-400">发布人</dt><dd className="mt-0.5 text-zinc-700">{announcement.authorName}</dd></div><div><dt className="text-zinc-400">最近更新</dt><dd className="mt-0.5 font-mono text-zinc-700"><FormattedDate value={announcement.updatedAt} /></dd></div></dl>
              </div>
            </td>
          </tr>
        )}
      </Fragment>
    );
  });
}

export function AnnouncementManagementWorkspace({
  scope,
  announcements,
  tenants,
  hasError,
}: {
  scope: "platform" | "tenant";
  announcements: ManagedAnnouncement[];
  tenants: AnnouncementTenantOption[];
  hasError: boolean;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [expandedTenants, setExpandedTenants] = useState<Set<string>>(new Set());

  const ownAnnouncements = useMemo(
    () => announcements.filter((item) => item.scope === scope),
    [announcements, scope]
  );
  const institutionAnnouncements = useMemo(
    () => scope === "platform" ? announcements.filter((item) => item.scope === "tenant") : [],
    [announcements, scope]
  );
  const filteredOwn = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("zh-CN");
    return ownAnnouncements.filter((item) => (status === "all" || item.status === status) && (!normalized || `${item.title} ${item.content} ${item.authorName}`.toLocaleLowerCase("zh-CN").includes(normalized)));
  }, [ownAnnouncements, query, status]);
  const institutionGroups = useMemo(() => {
    const groups = new Map<string, { tenantId: string; tenantName: string; announcements: ManagedAnnouncement[] }>();
    for (const tenant of tenants) {
      groups.set(tenant.id, { tenantId: tenant.id, tenantName: tenant.name, announcements: [] });
    }
    for (const item of institutionAnnouncements) {
      if (!item.tenantId) continue;
      const group = groups.get(item.tenantId) ?? { tenantId: item.tenantId, tenantName: item.tenantName, announcements: [] };
      group.announcements.push(item);
      groups.set(item.tenantId, group);
    }
    return [...groups.values()].sort((a, b) => a.tenantName.localeCompare(b.tenantName, "zh-CN"));
  }, [institutionAnnouncements, tenants]);
  const publishedCount = ownAnnouncements.filter((item) => item.status === "published").length;
  const draftCount = ownAnnouncements.filter((item) => item.status === "draft").length;

  function toggle(setter: Dispatch<SetStateAction<Set<string>>>, id: string) {
    setter((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="pb-12">
      <div className="mx-auto mt-5 w-full max-w-[1720px] px-4 sm:px-6 lg:px-8">
        <section className="border-y border-black/[0.08] bg-white">
          <header className="flex flex-col gap-4 border-b border-black/[0.08] px-5 py-5 xl:flex-row xl:items-end xl:justify-between">
            <div><p className="text-[9px] font-medium uppercase tracking-[0.12em] text-zinc-400">{scope === "platform" ? "平台负责人 / 全平台发布" : "机构负责人 / 本机构发布"}</p><h2 className="mt-1.5 text-xl font-semibold tracking-[-0.035em] text-zinc-950">通知公告管理</h2>{scope !== "platform" && <p className="mt-1 text-[11px] text-zinc-500">本页发布的公告只对本机构成员可见；平台公告在成员公告栏统一展示。</p>}</div>
            <div className="flex items-end gap-4"><dl className="flex text-[10px]">{[["公告", ownAnnouncements.length], ["已发布", publishedCount], ["草稿", draftCount]].map(([label, value], index) => <div key={String(label)} className={`min-w-[82px] px-4 ${index > 0 ? "border-l border-black/[0.08]" : ""}`}><dt className="text-zinc-400">{label}</dt><dd className="mt-0.5 font-mono text-base font-medium tabular-nums text-zinc-950">{value}</dd></div>)}</dl><CreateAnnouncementDialog scope={scope} /></div>
          </header>
          {hasError && <div className="border-b border-rose-200 bg-rose-50 px-5 py-3 text-[10px] text-rose-700">公告数据暂时无法读取，请稍后重试。</div>}
          <div className="grid border-b border-black/[0.08] lg:grid-cols-[minmax(260px,1fr)_auto_auto]">
            <label className="flex min-h-11 items-center gap-2 border-b border-black/[0.06] px-4 lg:border-b-0 lg:border-r"><Search size={13} className="text-zinc-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题、正文或发布人" className="min-w-0 flex-1 bg-transparent text-[10px] outline-none placeholder:text-zinc-400" /></label>
            <div className="flex min-h-11 items-center gap-1 border-b border-black/[0.06] px-3 py-1.5 lg:border-b-0 lg:border-r">{FILTERS.map(([value, label]) => <button key={value} type="button" onClick={() => setStatus(value)} className={`h-7 border px-3 text-[9px] font-medium ${status === value ? "border-zinc-900 bg-zinc-900 text-white" : "border-transparent text-zinc-500 hover:border-black/[0.08]"}`}>{label}</button>)}</div>
            <Link href="/dashboard/announcements" className="flex min-h-11 items-center gap-2 px-4 text-[10px] font-medium text-zinc-600 hover:text-zinc-950"><BellRing size={12} />查看成员公告栏</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1460px] border-collapse text-left">
              <thead><tr className="h-10 border-b border-black/[0.08] bg-zinc-50/40 text-[8px] uppercase tracking-[0.07em] text-zinc-500"><th className="w-10 px-3 font-medium"><span className="sr-only">展开</span></th><th className="w-[260px] border-r border-black/[0.06] px-3 font-medium">公告</th><th className="w-[160px] px-3 font-medium">发布来源</th><th className="w-[95px] px-3 font-medium">分类</th><th className="w-[90px] px-3 font-medium">级别</th><th className="w-[90px] px-3 font-medium">状态</th><th className="w-[100px] px-3 text-right font-medium">已读 / 覆盖</th><th className="w-[80px] px-3 text-right font-medium">已读率</th><th className="w-[115px] px-3 font-medium">发布时间</th><th className="w-[115px] px-3 font-medium">最近更新</th><th className="w-[250px] px-5 text-right font-medium">操作</th></tr></thead>
              <tbody><AnnouncementRows announcements={filteredOwn} editable expandedIds={expandedIds} onToggle={(id) => toggle(setExpandedIds, id)} />{filteredOwn.length === 0 && <tr><td colSpan={11} className="px-5 py-16 text-center"><Megaphone className="mx-auto text-zinc-300" size={24} /><p className="mt-3 text-xs font-medium text-zinc-700">没有符合条件的公告</p></td></tr>}</tbody>
            </table>
          </div>
        </section>

        {scope === "platform" && (
          <section className="mt-5 border-y border-black/[0.08] bg-white">
            <header className="border-b border-black/[0.08] px-5 py-4"><h2 className="text-sm font-semibold text-zinc-950">各机构发布情况</h2></header>
            <div className="overflow-x-auto"><table className="w-full min-w-[1050px] border-collapse text-left"><thead><tr className="h-10 border-b border-black/[0.08] bg-zinc-50/40 text-[8px] uppercase tracking-[0.07em] text-zinc-500"><th className="w-10 px-3 font-medium"><span className="sr-only">展开</span></th><th className="px-3 font-medium">机构</th><th className="w-[110px] px-3 text-right font-medium">公告</th><th className="w-[110px] px-3 text-right font-medium">已发布</th><th className="w-[110px] px-3 text-right font-medium">草稿</th><th className="w-[110px] px-3 text-right font-medium">紧急</th><th className="w-[140px] px-5 font-medium">最近发布</th></tr></thead><tbody>
              {institutionGroups.map((group) => { const expanded = expandedTenants.has(group.tenantId); const published = group.announcements.filter((item) => item.status === "published"); return <Fragment key={group.tenantId}><tr className="h-[48px] border-b border-black/[0.07] text-[10px] hover:bg-zinc-50/60"><td className="px-3"><button type="button" onClick={() => toggle(setExpandedTenants, group.tenantId)} className="flex size-6 items-center justify-center text-zinc-400">{expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</button></td><td className="px-3 font-medium text-zinc-900">{group.tenantName}</td><td className="px-3 text-right font-mono text-zinc-600">{group.announcements.length}</td><td className="px-3 text-right font-mono text-emerald-700">{published.length}</td><td className="px-3 text-right font-mono text-zinc-500">{group.announcements.filter((item) => item.status === "draft").length}</td><td className="px-3 text-right font-mono text-rose-700">{group.announcements.filter((item) => item.priority === "urgent" && item.status === "published").length}</td><td className="px-5 font-mono text-[9px] text-zinc-400"><FormattedDate value={published[0]?.publishedAt ?? null} /></td></tr>{expanded && <tr className="border-b border-black/[0.08] bg-zinc-50/45"><td colSpan={7} className="px-10 py-3"><div className="overflow-x-auto"><table className="w-full min-w-[1200px] border-collapse text-left"><tbody><AnnouncementRows announcements={group.announcements} editable={false} expandedIds={expandedIds} onToggle={(id) => toggle(setExpandedIds, id)} /></tbody></table></div></td></tr>}</Fragment>; })}
              {institutionGroups.length === 0 && <tr><td colSpan={7} className="px-5 py-12 text-center text-[10px] text-zinc-400">暂无机构</td></tr>}
            </tbody></table></div>
          </section>
        )}
      </div>
    </div>
  );
}
