"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { History, Pencil, Plus, Power, RotateCcw, TestTube2, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { GUIDE_AGENT_DESTINATIONS } from "@/lib/guide-agent-targets";
import {
  deleteAgentNavigationRule,
  getAgentNavigationRuleVersions,
  rollbackAgentNavigationRule,
  saveAgentNavigationRule,
  setAgentNavigationRuleStatus,
  testAgentNavigationRule,
  type AgentRuleActionResult,
} from "../actions";
import type { AgentDeletedRuleSummary, AgentNavigationRule, AgentRuleVersion } from "../types";

type RuleDraft = {
  id?: string;
  name: string;
  triggerPhrases: string;
  actionType: "navigate" | "highlight";
  targetPath: string;
  targetElementId: string;
  responseText: string;
  priority: number;
  status: "enabled" | "disabled";
};

const EMPTY_DRAFT: RuleDraft = {
  name: "",
  triggerPhrases: "",
  actionType: "navigate",
  targetPath: "/dashboard/courses",
  targetElementId: "",
  responseText: "好的，正在为你打开对应页面。",
  priority: 100,
  status: "enabled",
};

function toDraft(rule: AgentNavigationRule): RuleDraft {
  return {
    id: rule.id,
    name: rule.name,
    triggerPhrases: rule.triggerPhrases.join("\n"),
    actionType: rule.actionType,
    targetPath: rule.targetPath,
    targetElementId: rule.targetElementId ?? "",
    responseText: rule.responseText,
    priority: rule.priority,
    status: rule.status,
  };
}

function splitPhrases(value: string) {
  return value.split(/[\n,，]+/).map((item) => item.trim()).filter(Boolean);
}

const changeTypeLabels: Record<AgentRuleVersion["changeType"], string> = {
  created: "创建",
  updated: "编辑",
  enabled: "启用",
  disabled: "停用",
  deleted: "删除",
  rollback: "恢复",
};

function formatVersionDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function RuleEditor({
  draft,
  setDraft,
  onSaved,
}: {
  draft: RuleDraft;
  setDraft: (draft: RuleDraft) => void;
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<AgentRuleActionResult | null>(null);

  function submit() {
    setResult(null);
    startTransition(async () => {
      const next = await saveAgentNavigationRule({
        ...draft,
        triggerPhrases: splitPhrases(draft.triggerPhrases),
        targetElementId: draft.targetElementId.trim() || null,
      });
      setResult(next);
      if (next.ok) onSaved();
    });
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="agent-rule-name">规则名称</Label>
        <Input id="agent-rule-name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="例如：打开课程中心" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="agent-rule-phrases">学生可能使用的表达</Label>
        <textarea
          id="agent-rule-phrases"
          value={draft.triggerPhrases}
          onChange={(event) => setDraft({ ...draft, triggerPhrases: event.target.value })}
          rows={4}
          className="min-h-24 w-full resize-y rounded-[var(--control-radius)] border border-[var(--control-border)] bg-[var(--control-bg)] px-3 py-2 text-sm outline-none focus-visible:border-[var(--control-focus)] focus-visible:ring-3 focus-visible:ring-[color-mix(in_srgb,var(--control-focus)_50%,transparent)]"
          placeholder={'每行一个表达，例如：\n打开课程中心\n我的课程在哪里'}
        />
        <p className="text-xs text-muted-foreground">每行一个，也可以使用逗号分隔；最长 20 条。</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="agent-rule-action">执行动作</Label>
          <select id="agent-rule-action" value={draft.actionType} onChange={(event) => setDraft({ ...draft, actionType: event.target.value as RuleDraft["actionType"] })} className="h-[var(--control-height-compact)] rounded-[var(--control-radius)] border border-[var(--control-border)] bg-[var(--control-bg)] px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
            <option value="navigate">打开页面</option>
            <option value="highlight">打开并高亮</option>
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="agent-rule-target">目标页面</Label>
          <select id="agent-rule-target" value={draft.targetPath} onChange={(event) => setDraft({ ...draft, targetPath: event.target.value })} className="h-[var(--control-height-compact)] rounded-[var(--control-radius)] border border-[var(--control-border)] bg-[var(--control-bg)] px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
            {GUIDE_AGENT_DESTINATIONS.map((destination) => <option key={destination.path} value={destination.path}>{destination.label}</option>)}
          </select>
        </div>
      </div>
      {draft.actionType === "highlight" && (
        <div className="grid gap-1.5">
          <Label htmlFor="agent-rule-element">页面元素标识</Label>
          <Input id="agent-rule-element" value={draft.targetElementId} onChange={(event) => setDraft({ ...draft, targetElementId: event.target.value })} placeholder="例如：reminders" />
        </div>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor="agent-rule-response">即时回复</Label>
        <Input id="agent-rule-response" value={draft.responseText} onChange={(event) => setDraft({ ...draft, responseText: event.target.value })} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="agent-rule-priority">优先级</Label>
          <Input id="agent-rule-priority" type="number" min={0} max={1000} value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: Number(event.target.value) || 0 })} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="agent-rule-status">状态</Label>
          <select id="agent-rule-status" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as RuleDraft["status"] })} className="h-[var(--control-height-compact)] rounded-[var(--control-radius)] border border-[var(--control-border)] bg-[var(--control-bg)] px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
            <option value="enabled">启用</option>
            <option value="disabled">停用</option>
          </select>
        </div>
      </div>
      {result && <p role="status" className={result.ok ? "text-sm text-[var(--status-success)]" : "text-sm text-[var(--destructive)]"}>{result.message}</p>}
      <DialogFooter>
        <Button type="button" disabled={pending} onClick={submit}>{pending ? "正在保存" : "保存规则"}</Button>
      </DialogFooter>
    </div>
  );
}

export function NavigationRulesManager({
  rules,
  deletedRules,
}: {
  rules: AgentNavigationRule[];
  deletedRules: AgentDeletedRuleSummary[];
}) {
  const router = useRouter();
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<RuleDraft>(EMPTY_DRAFT);
  const [pending, startTransition] = useTransition();
  const [statusMessage, setStatusMessage] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [testResult, setTestResult] = useState<AgentRuleActionResult | null>(null);
  const [historyRuleId, setHistoryRuleId] = useState<string | null>(null);
  const [historyVersions, setHistoryVersions] = useState<AgentRuleVersion[]>([]);
  const [historyLoading, startHistoryTransition] = useTransition();
  // 记录最近一次请求的规则，防止连续点开不同规则时，先发出但后返回的旧请求覆盖新请求的结果。
  const historyRequestRuleIdRef = useRef<string | null>(null);

  function finishMutation(result: AgentRuleActionResult) {
    setStatusMessage(result.message);
    if (result.ok) router.refresh();
  }

  function openCreate() {
    setDraft(EMPTY_DRAFT);
    setEditorOpen(true);
  }

  function openEdit(rule: AgentNavigationRule) {
    setDraft(toDraft(rule));
    setEditorOpen(true);
  }

  function openHistory(ruleId: string) {
    setHistoryRuleId(ruleId);
    setHistoryVersions([]);
    historyRequestRuleIdRef.current = ruleId;
    startHistoryTransition(async () => {
      const versions = await getAgentNavigationRuleVersions(ruleId);
      if (historyRequestRuleIdRef.current === ruleId) setHistoryVersions(versions);
    });
  }

  const currentRuleIds = new Set(rules.map((rule) => rule.id));
  const selectedRuleName = rules.find((rule) => rule.id === historyRuleId)?.name
    ?? deletedRules.find((rule) => rule.ruleId === historyRuleId)?.name
    ?? "导航规则";

  return (
    <div className="grid gap-4">
      <section className="rounded-xl border border-border bg-card p-4" aria-labelledby="navigation-rule-test-title">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-64 flex-1">
            <Label id="navigation-rule-test-title" htmlFor="navigation-rule-test">规则测试</Label>
            <Input id="navigation-rule-test" className="mt-1.5" value={testMessage} onChange={(event) => setTestMessage(event.target.value)} placeholder="输入一句学生可能会说的话" />
          </div>
          <Button type="button" variant="outline" disabled={pending} onClick={() => startTransition(async () => setTestResult(await testAgentNavigationRule(testMessage)))}>
            <TestTube2 aria-hidden="true" />测试命中
          </Button>
        </div>
        {testResult && <p role="status" className="mt-3 text-sm text-foreground">{testResult.message}{testResult.targetLabel ? ` 目标：${testResult.targetLabel}` : ""}</p>}
      </section>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">已配置 {rules.length} 条规则，优先级较高的规则先匹配。</p>
        <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
          <DialogTrigger type="button" onClick={openCreate} className="inline-flex h-11 items-center gap-1.5 rounded-[var(--control-radius)] bg-primary px-3 text-sm font-medium text-primary-foreground outline-none hover:bg-[var(--primary-hover)] focus-visible:ring-2 focus-visible:ring-ring sm:h-9">
            <Plus size={16} aria-hidden="true" />新增规则
          </DialogTrigger>
          <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{draft.id ? "编辑导航规则" : "新增导航规则"}</DialogTitle>
              <DialogDescription>规则在服务端匹配，目标页面只能从允许列表中选择。</DialogDescription>
            </DialogHeader>
            <RuleEditor draft={draft} setDraft={setDraft} onSaved={() => { setEditorOpen(false); router.refresh(); }} />
          </DialogContent>
        </Dialog>
      </div>

      {statusMessage && <p role="status" className="text-sm text-foreground">{statusMessage}</p>}

      <div className="grid gap-3 md:hidden" aria-label="导航规则列表">
        {rules.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">还没有导航规则。</div>
        ) : rules.map((rule) => (
          <article key={rule.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-medium text-foreground">{rule.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">目标：{GUIDE_AGENT_DESTINATIONS.find((item) => item.path === rule.targetPath)?.label ?? rule.targetPath}</p>
              </div>
              <span className={`shrink-0 text-sm ${rule.status === "enabled" ? "text-[var(--status-success)]" : "text-muted-foreground"}`}>{rule.status === "enabled" ? "已启用" : "已停用"}</span>
            </div>
            <p className="mt-3 break-words text-sm leading-6 text-muted-foreground">{rule.triggerPhrases.join("、")}</p>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
              <span className="text-xs tabular-nums text-muted-foreground">优先级 {rule.priority}</span>
              <div className="flex gap-1">
                <Button type="button" size="icon" variant="ghost" className="size-11" aria-label={`编辑${rule.name}`} onClick={() => openEdit(rule)}><Pencil aria-hidden="true" /></Button>
                <Button type="button" size="icon" variant="ghost" className="size-11" aria-label={`查看${rule.name}的版本历史`} onClick={() => openHistory(rule.id)}><History aria-hidden="true" /></Button>
                <Button type="button" size="icon" variant="ghost" className="size-11" aria-label={`${rule.status === "enabled" ? "停用" : "启用"}${rule.name}`} disabled={pending} onClick={() => startTransition(async () => finishMutation(await setAgentNavigationRuleStatus(rule.id, rule.status === "enabled" ? "disabled" : "enabled")))}><Power aria-hidden="true" /></Button>
                <AlertDialog>
                  <AlertDialogTrigger render={<Button type="button" size="icon" variant="ghost" className="size-11" aria-label={`删除${rule.name}`} />}><Trash2 aria-hidden="true" /></AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>删除“{rule.name}”？</AlertDialogTitle><AlertDialogDescription>删除后学生表达将不再命中这条本地规则，此操作会写入审计记录，仍可从版本历史恢复。</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => startTransition(async () => finishMutation(await deleteAgentNavigationRule(rule.id)))}>确认删除</AlertDialogAction></AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>规则</TableHead>
              <TableHead>学生表达</TableHead>
              <TableHead>目标</TableHead>
              <TableHead>优先级</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">还没有导航规则。</TableCell></TableRow>
            ) : rules.map((rule) => (
              <TableRow key={rule.id}>
                <TableCell className="font-medium">{rule.name}</TableCell>
                <TableCell className="max-w-80 whitespace-normal text-muted-foreground">{rule.triggerPhrases.join("、")}</TableCell>
                <TableCell className="max-w-56 whitespace-normal">{GUIDE_AGENT_DESTINATIONS.find((item) => item.path === rule.targetPath)?.label ?? rule.targetPath}</TableCell>
                <TableCell className="tabular-nums">{rule.priority}</TableCell>
                <TableCell><span className={rule.status === "enabled" ? "text-[var(--status-success)]" : "text-muted-foreground"}>{rule.status === "enabled" ? "已启用" : "已停用"}</span></TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button type="button" size="icon" variant="ghost" aria-label={`编辑${rule.name}`} onClick={() => openEdit(rule)}><Pencil aria-hidden="true" /></Button>
                    <Button type="button" size="icon" variant="ghost" aria-label={`查看${rule.name}的版本历史`} onClick={() => openHistory(rule.id)}><History aria-hidden="true" /></Button>
                    <Button type="button" size="icon" variant="ghost" aria-label={`${rule.status === "enabled" ? "停用" : "启用"}${rule.name}`} disabled={pending} onClick={() => startTransition(async () => finishMutation(await setAgentNavigationRuleStatus(rule.id, rule.status === "enabled" ? "disabled" : "enabled")))}><Power aria-hidden="true" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger render={<Button type="button" size="icon" variant="ghost" aria-label={`删除${rule.name}`} />}><Trash2 aria-hidden="true" /></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>删除“{rule.name}”？</AlertDialogTitle><AlertDialogDescription>删除后学生表达将不再命中这条本地规则，此操作会写入审计记录。</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => startTransition(async () => finishMutation(await deleteAgentNavigationRule(rule.id)))}>确认删除</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {deletedRules.length > 0 && (
        <section className="rounded-xl border border-dashed border-border bg-card p-4" aria-labelledby="deleted-agent-rules-title">
          <h2 id="deleted-agent-rules-title" className="text-sm font-semibold text-foreground">可恢复的已删除规则</h2>
          <div className="mt-3 grid gap-2">
            {deletedRules.map((deletedRule) => (
              <div key={deletedRule.ruleId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/55 px-3 py-2">
                <div><p className="text-sm font-medium text-foreground">{deletedRule.name}</p><p className="mt-0.5 text-xs text-muted-foreground">删除于 {formatVersionDate(deletedRule.deletedAt)}，历史版本仍完整保留。</p></div>
                <Button type="button" variant="outline" size="sm" onClick={() => openHistory(deletedRule.ruleId)}><History aria-hidden="true" />查看与恢复</Button>
              </div>
            ))}
          </div>
        </section>
      )}

      <Dialog open={historyRuleId !== null} onOpenChange={(open) => { if (!open) { setHistoryRuleId(null); setHistoryVersions([]); } }}>
        <DialogContent className="max-h-[82vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>“{selectedRuleName}”的版本历史</DialogTitle>
            <DialogDescription>每次编辑、启停、删除和恢复都会产生不可修改的新版本。恢复操作本身也会保留记录。</DialogDescription>
          </DialogHeader>
          {historyLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">正在加载版本历史…</p>
          ) : historyVersions.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">没有找到版本历史。</p>
          ) : (
            <div className="grid gap-2">
              {historyVersions.map((version, index) => {
                const currentExists = currentRuleIds.has(version.ruleId);
                const isCurrent = currentExists && index === 0;
                return (
                  <div key={version.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/35 px-3 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">版本 {version.versionNumber} · {changeTypeLabels[version.changeType]}{isCurrent ? " · 当前使用" : ""}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatVersionDate(version.createdAt)} · {version.actorName}{version.sourceVersionNumber ? ` · 来源版本 ${version.sourceVersionNumber}` : ""}</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pending || isCurrent}
                      onClick={() => startTransition(async () => {
                        const result = await rollbackAgentNavigationRule(version.ruleId, version.versionNumber);
                        finishMutation(result);
                        if (result.ok) { setHistoryRuleId(null); setHistoryVersions([]); }
                      })}
                    >
                      <RotateCcw aria-hidden="true" />{isCurrent ? "当前版本" : "恢复此版本"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
