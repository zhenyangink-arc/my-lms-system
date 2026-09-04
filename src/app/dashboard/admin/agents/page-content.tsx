import Link from "next/link";
import { Activity, Bot, ChevronLeft, ChevronRight, CircleAlert, Gauge, ListChecks, MessagesSquare, Route, ScrollText, Settings2 } from "lucide-react";

import {
  ManagementMetricStrip,
  ManagementNotice,
  ManagementPage,
} from "@/components/layout/management-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LearningAgentModelSettings } from "@/features/model-usage/components/learning-agent-model-settings";
import { NavigationRulesManager } from "@/features/agent-operations/components/NavigationRulesManager";
import { AgentBehaviorSettings } from "@/features/agent-operations/components/AgentBehaviorSettings";
import { getAgentOperationsData } from "@/features/agent-operations/service";
import type { AgentConversation } from "@/features/agent-operations/types";

const sections = [
  { key: "overview", label: "运行概览", icon: Gauge },
  { key: "conversations", label: "会话记录", icon: MessagesSquare },
  { key: "rules", label: "导航规则", icon: Route },
  { key: "settings", label: "Agent 配置", icon: Settings2 },
  { key: "audit", label: "操作日志", icon: ScrollText },
] as const;

type SectionKey = typeof sections[number]["key"];

function isSection(value: string | undefined): value is SectionKey {
  return sections.some((section) => section.key === value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDuration(value: number | null) {
  if (value === null) return "—";
  return value >= 1000 ? `${(value / 1000).toFixed(2)} 秒` : `${value} 毫秒`;
}

function ConversationList({ conversations }: { conversations: AgentConversation[] }) {
  if (conversations.length === 0) {
    return <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">没有符合条件的会话记录。</div>;
  }

  return (
    <div className="grid gap-3">
      {conversations.map((conversation) => {
        const firstQuestion = conversation.messages.find((message) => message.role === "user");
        const localCount = conversation.messages.filter((message) => message.responseMode === "local_rule").length;
        const failureCount = conversation.failures.length;
        return (
          <details key={conversation.id} className="group rounded-xl border border-border bg-card open:ring-1 open:ring-primary/15">
            <summary className="flex cursor-pointer list-none items-center gap-4 px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground"><MessagesSquare size={17} aria-hidden="true" /></span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <strong className="font-medium text-foreground">{conversation.studentName}</strong>
                  <span className="text-xs text-muted-foreground">{conversation.tenantName}</span>
                  {localCount > 0 && <span className="rounded-full bg-[var(--status-success-surface)] px-2 py-0.5 text-xs text-[var(--status-success)]">本地规则 {localCount}</span>}
                  {failureCount > 0 && <span className="rounded-full bg-[var(--status-danger-surface)] px-2 py-0.5 text-xs text-[var(--status-danger)]">失败 {failureCount}</span>}
                </span>
                <span className="mt-1 block truncate text-sm text-muted-foreground">{firstQuestion?.content ?? "暂无学生消息"}</span>
              </span>
              <span className="shrink-0 text-right text-xs text-muted-foreground">
                <span className="block tabular-nums">{conversation.messages.length} 条消息</span>
                <span className="mt-1 block">{formatDate(conversation.updatedAt)}</span>
              </span>
            </summary>
            <div className="border-t border-border bg-muted/30 px-4 py-4">
              <ol className="grid gap-3">
                {conversation.messages.map((message) => (
                  <li key={message.id} className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3 text-sm">
                    <div className="text-xs font-medium text-muted-foreground">{message.role === "user" ? "学生" : message.responseMode === "local_rule" ? "本地规则" : "Agent"}</div>
                    <div className="min-w-0">
                      <p className="whitespace-pre-wrap break-words leading-6 text-foreground">{message.content}</p>
                      {message.role === "assistant" && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {message.responseMode === "local_rule" ? "本地即时处理" : [message.provider, message.model].filter(Boolean).join(" / ") || "历史回复"}
                          {message.firstTokenMs !== null ? ` · 首字 ${formatDuration(message.firstTokenMs)}` : ""}
                          {message.totalDurationMs !== null ? ` · 完成 ${formatDuration(message.totalDurationMs)}` : ""}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
              {conversation.failures.length > 0 && (
                <div className="mt-4 grid gap-2 border-t border-border pt-4" aria-label="失败记录">
                  {conversation.failures.map((failure) => (
                    <div key={failure.id} className="flex gap-2 rounded-lg bg-[var(--status-danger-surface)] px-3 py-2 text-sm text-[var(--status-danger)]">
                      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      <span>{failure.publicMessage} · {formatDate(failure.createdAt)}{failure.durationMs !== null ? ` · ${formatDuration(failure.durationMs)}` : ""}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </details>
        );
      })}
    </div>
  );
}

export default async function AgentOperationsPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string; q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const section: SectionKey = isSection(params.section) ? params.section : "overview";
  const query = params.q?.trim().slice(0, 100) ?? "";
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const conversationPage = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const data = await getAgentOperationsData({
    includeConversations: section === "overview" || section === "conversations",
    conversationPage: section === "conversations" ? conversationPage : 1,
    conversationPageSize: section === "conversations" ? 20 : 5,
    conversationQuery: section === "conversations" ? query : "",
    conversationAuditScope: section === "overview" ? "overview" : "conversations",
  });
  const conversationPageCount = Math.max(1, Math.ceil(data.conversationTotal / data.conversationPageSize));

  function conversationPageHref(page: number) {
    const next = new URLSearchParams({ section: "conversations", page: String(page) });
    if (query) next.set("q", query);
    return `/platform/dashboard/admin/agents?${next.toString()}`;
  }

  return (
    <ManagementPage
      title="Agent 运营中心"
      description="查看学生真实提问、维护本地导航规则并追踪 Agent 的运行质量。仅平台负责人可访问。"
      icon={Bot}
      meta={<span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Activity size={14} aria-hidden="true" />UPLY 导航助手</span>}
    >
      <nav className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1" aria-label="Agent 运营中心栏目">
        {sections.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={`/platform/dashboard/admin/agents?section=${item.key}`}
              aria-current={section === item.key ? "page" : undefined}
              className={`inline-flex h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring sm:h-9 ${section === item.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            >
              <Icon size={15} aria-hidden="true" />{item.label}
            </Link>
          );
        })}
      </nav>

      {data.hasQueryError && <ManagementNotice tone="warning">部分 Agent 运营数据暂时无法读取。数据库迁移完成后刷新页面即可恢复。</ManagementNotice>}

      {section === "overview" && (
        <div className="grid gap-5">
          <ManagementMetricStrip label="Agent 运行指标" items={[
            { label: "会话", value: data.metrics.conversations, detail: "最近 100 个会话" },
            { label: "学生提问", value: data.metrics.studentQuestions, detail: "已保存的真实问题" },
            { label: "本地处理", value: data.metrics.localRuleReplies, detail: "无需等待模型" },
            { label: "模型回答", value: data.metrics.modelReplies, detail: "学习与咨询问题" },
            { label: "失败请求", value: data.metrics.failedRequests, detail: `模型失败率 ${data.metrics.failureRate}%` },
            { label: "平均首字", value: formatDuration(data.metrics.averageFirstTokenMs), detail: "有计时记录的模型回答" },
          ]} />
          <section className="grid gap-3 lg:grid-cols-2" aria-label="运行摘要">
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="flex items-center gap-2 text-base font-semibold"><ListChecks size={18} aria-hidden="true" />导航规则状态</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{data.rules.filter((rule) => rule.status === "enabled").length} 条规则已启用，{data.rules.filter((rule) => rule.status === "disabled").length} 条已停用。命中规则后由服务端直接回复并执行页面动作。</p>
              <Button nativeButton={false} render={<Link href="/platform/dashboard/admin/agents?section=rules" />} variant="outline" className="mt-4">管理导航规则</Button>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="flex items-center gap-2 text-base font-semibold"><Bot size={18} aria-hidden="true" />当前运行配置</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{data.modelConfig ? `${data.modelConfig.provider} / ${data.modelConfig.model}` : "暂时无法读取模型配置"}。未命中本地规则的问题会进入模型流式回答。</p>
              <Button nativeButton={false} render={<Link href="/platform/dashboard/admin/agents?section=settings" />} variant="outline" className="mt-4">查看 Agent 配置</Button>
            </div>
          </section>
          <section aria-labelledby="recent-conversations-title">
            <div className="mb-3 flex items-center justify-between gap-3"><h2 id="recent-conversations-title" className="text-base font-semibold">最近会话</h2><Link className="text-sm font-medium text-primary hover:underline" href="/platform/dashboard/admin/agents?section=conversations">查看全部</Link></div>
            <ConversationList conversations={data.conversations} />
          </section>
        </div>
      )}

      {section === "conversations" && (
        <div className="grid gap-4">
          <form method="get" className="flex items-end gap-2 rounded-xl border border-border bg-card p-3">
            <input type="hidden" name="section" value="conversations" />
            <label className="min-w-0 flex-1 text-xs font-medium text-muted-foreground">搜索学生、机构或对话内容<Input name="q" defaultValue={query} maxLength={100} className="mt-1.5" placeholder="输入关键词" /></label>
            <Button type="submit" variant="outline">搜索</Button>
          </form>
          <p className="text-sm text-muted-foreground">共 {data.conversationTotal} 个会话。学生问题保存在平台数据库，不会写入模型长期记忆；查看行为会进入操作日志。</p>
          <ConversationList conversations={data.conversations} />
          {data.conversationTotal > 0 && (
            <nav className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2" aria-label="会话分页">
              <p className="text-sm tabular-nums text-muted-foreground">第 {Math.min(data.conversationPage, conversationPageCount)} / {conversationPageCount} 页</p>
              <div className="flex gap-2">
                {data.conversationPage > 1 ? (
                  <Button nativeButton={false} render={<Link href={conversationPageHref(data.conversationPage - 1)} />} variant="outline" size="sm" className="h-11 sm:h-8"><ChevronLeft aria-hidden="true" />上一页</Button>
                ) : (
                  <Button type="button" variant="outline" size="sm" className="h-11 sm:h-8" disabled><ChevronLeft aria-hidden="true" />上一页</Button>
                )}
                {data.conversationPage < conversationPageCount ? (
                  <Button nativeButton={false} render={<Link href={conversationPageHref(data.conversationPage + 1)} />} variant="outline" size="sm" className="h-11 sm:h-8">下一页<ChevronRight aria-hidden="true" /></Button>
                ) : (
                  <Button type="button" variant="outline" size="sm" className="h-11 sm:h-8" disabled>下一页<ChevronRight aria-hidden="true" /></Button>
                )}
              </div>
            </nav>
          )}
        </div>
      )}

      {section === "rules" && <NavigationRulesManager rules={data.rules} deletedRules={data.deletedRules} />}

      {section === "settings" && (
        <div className="grid gap-4">
          <ManagementNotice>本地导航规则优先执行；未命中规则的问题才会发送给当前模型。API 密钥不会进入浏览器或本页面数据。</ManagementNotice>
          {data.modelConfig ? <LearningAgentModelSettings configs={[data.modelConfig]} /> : <ManagementNotice tone="warning">暂时无法读取 Agent 模型配置。</ManagementNotice>}
          {data.behaviorConfig ? <AgentBehaviorSettings {...data.behaviorConfig} /> : <ManagementNotice tone="warning">暂时无法读取 Agent 回答配置。</ManagementNotice>}
        </div>
      )}

      {section === "audit" && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>时间</TableHead><TableHead>操作人</TableHead><TableHead>操作</TableHead><TableHead>内容</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.auditLogs.length === 0 ? <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">还没有 Agent 操作记录。</TableCell></TableRow> : data.auditLogs.map((log) => (
                <TableRow key={log.id}><TableCell className="tabular-nums text-muted-foreground">{formatDate(log.createdAt)}</TableCell><TableCell>{log.actorName}</TableCell><TableCell>{log.action}</TableCell><TableCell className="max-w-xl whitespace-normal">{log.summary}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </ManagementPage>
  );
}
