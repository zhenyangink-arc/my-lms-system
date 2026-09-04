"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { CardTitleWithHint } from "@/components/ui/card-title-with-hint";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveAgentBehaviorConfig } from "../actions";

export function AgentBehaviorSettings({
  systemPrompt,
  maxOutputCharacters,
}: {
  systemPrompt: string;
  maxOutputCharacters: number;
}) {
  const [prompt, setPrompt] = useState(systemPrompt);
  const [maxCharacters, setMaxCharacters] = useState(maxOutputCharacters);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="max-w-4xl">
        <CardTitleWithHint
          title="回答行为"
          description="控制未命中本地规则时的回答边界。修改内容只在服务端读取。"
          headingLevel={2}
          titleClassName="text-base font-semibold text-foreground"
        />
        <div className="mt-4 grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="agent-system-prompt">系统提示词</Label>
            <textarea
              id="agent-system-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={7}
              className="w-full resize-y rounded-[var(--control-radius)] border border-[var(--control-border)] bg-[var(--control-bg)] px-3 py-2 text-sm leading-6 outline-none focus-visible:border-[var(--control-focus)] focus-visible:ring-3 focus-visible:ring-[color-mix(in_srgb,var(--control-focus)_50%,transparent)]"
            />
          </div>
          <div className="grid max-w-64 gap-1.5">
            <Label htmlFor="agent-max-characters">单次回复字数上限</Label>
            <Input id="agent-max-characters" type="number" min={120} max={1000} value={maxCharacters} onChange={(event) => setMaxCharacters(Number(event.target.value) || 120)} />
            <p className="text-xs text-muted-foreground">可设置 120～1000 字。</p>
          </div>
          {result && <p role="status" className={result.ok ? "text-sm text-[var(--status-success)]" : "text-sm text-[var(--destructive)]"}>{result.message}</p>}
          <div><Button type="button" disabled={pending} onClick={() => startTransition(async () => setResult(await saveAgentBehaviorConfig({ systemPrompt: prompt, maxOutputCharacters: maxCharacters })))}>{pending ? "正在保存" : "保存回答配置"}</Button></div>
        </div>
      </div>
    </section>
  );
}
