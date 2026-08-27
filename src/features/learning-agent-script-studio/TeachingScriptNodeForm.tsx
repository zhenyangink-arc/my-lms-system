"use client";

import { type FormEvent, useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  saveTeachingScriptNodeAction,
  type TeachingScriptActionState,
} from "@/app/dashboard/admin/teaching-scripts/actions";
import type {
  TeachingScriptActivity,
  TeachingScriptNode,
} from "./types";

const initialState: TeachingScriptActionState = { status: "idle" };

function configuredText(node: TeachingScriptNode, key: string) {
  const value = node.configuration[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  return String((value as Record<string, unknown>)["zh-CN"] ?? "");
}

function displayConfiguration(node: TeachingScriptNode) {
  const value = node.configuration.display;
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function displayLocalizedText(display: Record<string, unknown>, key: string) {
  const value = display[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  return String((value as Record<string, unknown>)["zh-CN"] ?? "");
}

function displayLocalizedItems(display: Record<string, unknown>) {
  const value = display.items;
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const items = (value as Record<string, unknown>)["zh-CN"];
  return Array.isArray(items) ? items.filter((item): item is string => typeof item === "string").join("\n") : "";
}

function objectConfiguration(node: TeachingScriptNode, key: string) {
  const value = node.configuration[key];
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function localizedConfigurationText(configuration: Record<string, unknown>, key: string) {
  const value = configuration[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  return String((value as Record<string, unknown>)["zh-CN"] ?? "");
}

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <span className="text-[11px] text-[var(--status-danger)] md:col-start-2" role="alert">{errors[0]}</span>;
}

type NodePreview = {
  title: string;
  body: string;
  items: string[];
  korean: string;
  translation: string;
  script: string;
  interactionKind: string;
  interactionPrompt: string;
  interactionOptions: string[];
};

export function TeachingScriptNodeForm({
  node,
  allNodes,
  activities,
  returnTo,
  editable,
}: {
  node: TeachingScriptNode;
  allNodes: TeachingScriptNode[];
  activities: TeachingScriptActivity[];
  returnTo: string;
  editable: boolean;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveTeachingScriptNodeAction, initialState);
  const display = displayConfiguration(node);
  const studentTask = objectConfiguration(node, "studentTask");
  const visualCue = objectConfiguration(node, "visualCue");
  const interaction = objectConfiguration(node, "interaction");
  const interactionOptions = Array.isArray(interaction.options)
    ? interaction.options.filter((item): item is string => typeof item === "string").join("\n")
    : "";
  const [editorSection, setEditorSection] = useState<"content" | "advanced">("content");
  const [preview, setPreview] = useState<NodePreview>({
    title: displayLocalizedText(display, "title"),
    body: displayLocalizedText(display, "body"),
    items: displayLocalizedItems(display).split("\n").filter(Boolean),
    korean: String(display.korean ?? ""),
    translation: displayLocalizedText(display, "translation"),
    script: node.script["zh-CN"],
    interactionKind: String(interaction.kind ?? "none"),
    interactionPrompt: localizedConfigurationText(interaction, "prompt"),
    interactionOptions: interactionOptions.split("\n").filter(Boolean),
  });

  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [router, state.status]);

  function updatePreview(event: FormEvent<HTMLFormElement>) {
    const values = new FormData(event.currentTarget);
    setPreview({
      title: String(values.get("display_title_zh") ?? ""),
      body: String(values.get("display_body_zh") ?? ""),
      items: String(values.get("display_items_zh") ?? "").split("\n").map((item) => item.trim()).filter(Boolean),
      korean: String(values.get("display_korean") ?? ""),
      translation: String(values.get("display_translation_zh") ?? ""),
      script: String(values.get("script_zh") ?? ""),
      interactionKind: String(values.get("interaction_kind") ?? "none"),
      interactionPrompt: String(values.get("interaction_prompt_zh") ?? ""),
      interactionOptions: String(values.get("interaction_options") ?? "").split("\n").map((item) => item.trim()).filter(Boolean),
    });
  }

  return (
    <form action={action} onInput={updatePreview} className="space-y-4 [&_.app-input]:rounded-none [&_textarea]:rounded-none" key={node.id}>
      <input type="hidden" name="node_id" value={node.id} />
      <input type="hidden" name="return_to" value={returnTo} />

      <div className="border-b border-[var(--border)] pb-4">
        <p className="text-sm font-semibold text-[var(--foreground)]">节点内容</p>
        <p className="app-muted-text mt-1 text-xs leading-5">依次编辑学生看到的教学展示和老师讲解；全部确认后再统一发布到学生端。</p>
      </div>

      <div className="flex min-h-12 items-center gap-1 border-b border-[var(--border)]" role="tablist" aria-label="节点编辑区域">
        <button type="button" role="tab" aria-controls="teaching-content-panel" aria-selected={editorSection === "content"} onClick={() => setEditorSection("content")} className={`min-h-11 border-b-2 px-4 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${editorSection === "content" ? "border-[var(--primary)] text-[var(--primary)]" : "border-transparent text-[var(--foreground-muted)] hover:text-[var(--foreground)]"}`}>教学内容与预览</button>
        <button type="button" role="tab" aria-controls="teaching-advanced-panel" aria-selected={editorSection === "advanced"} onClick={() => setEditorSection("advanced")} className={`min-h-11 border-b-2 px-4 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${editorSection === "advanced" ? "border-[var(--primary)] text-[var(--primary)]" : "border-transparent text-[var(--foreground-muted)] hover:text-[var(--foreground)]"}`}>互动与流程设置</button>
      </div>

      <details hidden={editorSection !== "advanced"} className="border-b border-[var(--border)] pb-4">
        <summary className="cursor-pointer text-xs font-semibold text-[var(--foreground-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]">节点基础设置（通常不需要修改）</summary>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <label className="space-y-1.5 text-xs font-medium">
            <span className="block">节点类型</span>
            <select name="node_type" defaultValue={node.type} disabled={!editable} className="app-input h-10 w-full border px-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-65">
              <option value="opening">课堂开场</option>
              <option value="instruction">观察或操作引导</option>
              <option value="explanation">知识讲解</option>
              <option value="example">例句示范</option>
              <option value="question">理解检查</option>
              <option value="summary">课堂总结</option>
            </select>
            <FieldError errors={state.fieldErrors?.nodeType} />
          </label>
          <label className="space-y-1.5 text-xs font-medium">
            <span className="block">节点标识</span>
            <input name="node_key" defaultValue={node.key} readOnly className="app-input h-10 w-full border px-3 font-mono text-[11px] opacity-75 outline-none" />
            <span className="app-muted-text block text-[11px] leading-4">用于系统定位，不需要手动修改。</span>
          </label>
        </div>
      </details>

      <div id="teaching-content-panel" hidden={editorSection !== "content"} role="tabpanel" className="grid items-start gap-0 border border-[var(--border)] 2xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="divide-y divide-[var(--border)] 2xl:border-r 2xl:border-[var(--border)]">
      <label className="grid min-h-14 items-center gap-2 px-4 py-3 text-xs font-medium md:grid-cols-[11rem_minmax(0,1fr)]">
        <span className="text-[var(--foreground-secondary)]">节点名称</span>
        <input name="title_zh" defaultValue={node.title["zh-CN"]} disabled={!editable} maxLength={80} className="app-input h-10 w-full border px-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-65" />
        <FieldError errors={state.fieldErrors?.titleZh} />
      </label>

      <fieldset className="divide-y divide-[var(--border)]">
        <legend className="w-full border-y border-[var(--border)] bg-[var(--muted)]/35 px-4 py-3 text-sm font-bold">01　当前教学展示</legend>
        <p className="app-muted-text px-4 py-2.5 text-[11px] leading-5">显示在学生端教学区上方。</p>
        <div className="divide-y divide-[var(--border)]">
          <label className="grid min-h-14 items-center gap-2 px-4 py-3 text-xs font-medium md:grid-cols-[11rem_minmax(0,1fr)]">
            <span className="text-[var(--foreground-secondary)]">展示类型</span>
            <select name="display_kind" defaultValue={String(display.kind ?? "overview")} disabled={!editable} className="app-input h-10 w-full border px-3">
              <option value="overview">目标概览</option>
              <option value="scene">情景观察</option>
              <option value="sequence">步骤或顺序</option>
              <option value="expression">表达与例句</option>
              <option value="question">理解检查</option>
              <option value="task">学习任务</option>
              <option value="summary">课堂总结</option>
            </select>
          </label>
          <label className="grid min-h-14 items-center gap-2 px-4 py-3 text-xs font-medium md:grid-cols-[11rem_minmax(0,1fr)]">
            <span className="text-[var(--foreground-secondary)]">展示标题</span>
            <input name="display_title_zh" defaultValue={displayLocalizedText(display, "title")} disabled={!editable} maxLength={80} className="app-input h-10 w-full border px-3" />
          </label>
        </div>
        <label className="grid gap-2 px-4 py-3 text-xs font-medium md:grid-cols-[11rem_minmax(0,1fr)]">
          <span className="pt-2 text-[var(--foreground-secondary)]">展示说明</span>
          <textarea name="display_body_zh" defaultValue={displayLocalizedText(display, "body")} disabled={!editable} rows={3} maxLength={600} className="app-input w-full resize-y border px-3 py-2 text-xs leading-5" />
        </label>
        <label className="grid gap-2 px-4 py-3 text-xs font-medium md:grid-cols-[11rem_minmax(0,1fr)]">
          <span className="pt-2 text-[var(--foreground-secondary)]">展示要点</span>
          <span><textarea name="display_items_zh" defaultValue={displayLocalizedItems(display)} disabled={!editable} rows={4} maxLength={1000} placeholder="每行填写一个要点" className="app-input w-full resize-y border px-3 py-2 text-xs leading-5" /><span className="app-muted-text mt-1 block text-[11px]">每行一个要点。</span></span>
        </label>
        <label className="grid gap-2 px-4 py-3 text-xs font-medium md:grid-cols-[11rem_minmax(0,1fr)]"><span className="pt-2 text-[var(--foreground-secondary)]">韩语展示内容</span><textarea name="display_korean" defaultValue={String(display.korean ?? "")} disabled={!editable} rows={3} maxLength={1000} className="app-input w-full resize-y border px-3 py-2 text-sm leading-6" /></label>
        <label className="grid gap-2 px-4 py-3 text-xs font-medium md:grid-cols-[11rem_minmax(0,1fr)]"><span className="pt-2 text-[var(--foreground-secondary)]">中文释义</span><textarea name="display_translation_zh" defaultValue={displayLocalizedText(display, "translation")} disabled={!editable} rows={3} maxLength={600} className="app-input w-full resize-y border px-3 py-2 text-xs leading-5" /></label>
      </fieldset>

      <fieldset className="divide-y divide-[var(--border)]">
        <legend className="w-full border-y border-[var(--border)] bg-[var(--muted)]/35 px-4 py-3 text-sm font-bold">02　UPLY 韩语老师讲解</legend>
        <p className="app-muted-text px-4 py-2.5 text-[11px] leading-5">显示在当前教学展示下方。</p>
      <label className="grid gap-2 px-4 py-3 text-xs font-medium md:grid-cols-[11rem_minmax(0,1fr)]">
        <span className="pt-2 text-[var(--foreground-secondary)]">老师固定台词</span>
        <textarea name="script_zh" defaultValue={node.script["zh-CN"]} disabled={!editable} rows={7} maxLength={1600} className="app-input w-full resize-y border px-3 py-2.5 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-65" />
        <FieldError errors={state.fieldErrors?.scriptZh} />
      </label>

      <div className="divide-y divide-[var(--border)]">
        <label className="grid gap-2 px-4 py-3 text-xs font-medium md:grid-cols-[11rem_minmax(0,1fr)]">
          <span className="pt-2 text-[var(--foreground-secondary)]">没听懂时的提示</span>
          <textarea name="hint_zh" defaultValue={configuredText(node, "hint")} disabled={!editable} rows={3} maxLength={600} className="app-input w-full resize-y border px-3 py-2 text-xs leading-5 outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-65" />
        </label>
        <label className="grid gap-2 px-4 py-3 text-xs font-medium md:grid-cols-[11rem_minmax(0,1fr)]">
          <span className="pt-2 text-[var(--foreground-secondary)]">再举一个例子</span>
          <textarea name="example_zh" defaultValue={configuredText(node, "example")} disabled={!editable} rows={3} maxLength={600} className="app-input w-full resize-y border px-3 py-2 text-xs leading-5 outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-65" />
        </label>
      </div>
      </fieldset>
      </div>

      <section aria-label="学生端实时预览" className="bg-[var(--card)] 2xl:sticky 2xl:top-0">
        <div className="flex items-center justify-between gap-3">
          <h3 className="px-4 py-3 text-sm font-bold text-[var(--foreground)]">学生端实时预览</h3>
          <span className="text-[10px] font-semibold text-[var(--foreground-muted)]">输入内容时自动更新</span>
        </div>
        <div className="border-t border-[var(--border)]">
          <div className="min-h-40 border-b border-[var(--border)] p-4">
            <p className="text-[10px] font-bold text-[var(--status-warning)]">上方：当前教学展示</p>
            <p className="mt-2 text-base font-bold text-[var(--foreground)]">{preview.title || "请填写展示标题"}</p>
            {preview.body && <p className="mt-2 text-xs leading-5 text-[var(--foreground-secondary)]">{preview.body}</p>}
            {preview.items.length > 0 && <ol className="mt-3 divide-y divide-[var(--border)] border-y border-[var(--border)]">{preview.items.map((item, index) => <li key={`${item}-${index}`} className="flex items-start gap-2 px-1 py-2 text-xs"><span className="font-bold text-[var(--status-warning)]">{index + 1}</span><span>{item}</span></li>)}</ol>}
            {preview.korean && <div className="mt-3 border-l-2 border-[var(--status-warning)] pl-3"><p lang="ko" className="whitespace-pre-line text-sm font-bold leading-6">{preview.korean}</p>{preview.translation && <p className="mt-1 text-[11px] text-[var(--foreground-muted)]">{preview.translation}</p>}</div>}
          </div>
          <div className="border-l-2 border-[color-mix(in_srgb,var(--status-warning)_45%,var(--border-subtle))] px-4 py-3">
            <p className="text-[10px] font-bold text-[var(--foreground-muted)]">下方：UPLY 韩语老师讲解</p>
            <p className="mt-2 whitespace-pre-line text-xs leading-6 text-[var(--foreground-secondary)]">{preview.script || "请填写老师固定台词"}</p>
            {preview.interactionKind === "single_choice" && preview.interactionOptions.length > 0 && (
              <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
                <p className="text-[10px] font-bold text-[var(--status-warning)]">现在轮到学生回答</p>
                <p className="mt-1.5 text-xs font-bold leading-5 text-[var(--foreground)]">{preview.interactionPrompt || "请填写互动问题"}</p>
                <div className="mt-2 grid gap-1.5">{preview.interactionOptions.map((option, index) => <span key={`${option}-${index}`} className="border border-[var(--border-subtle)] bg-[var(--card)] px-3 py-2 text-xs font-semibold"><span className="mr-2 text-[10px] text-[var(--foreground-muted)]">{String.fromCharCode(65 + index)}</span><span lang="ko">{option}</span></span>)}</div>
              </div>
            )}
          </div>
        </div>
      </section>
      </div>

      <div id="teaching-advanced-panel" hidden={editorSection !== "advanced"} role="tabpanel" className="divide-y divide-[var(--border)] border border-[var(--border)]">
      <div className="px-4 py-3">
        <p className="text-xs font-bold text-[var(--foreground)]">只有需要提问、跳转或联动教材活动时才修改这里</p>
        <p className="app-muted-text mt-1 text-[11px] leading-5">普通讲解节点保持默认设置即可，不会影响上方教学内容和老师台词。</p>
      </div>
      <fieldset className="divide-y divide-[var(--border)]">
        <legend className="w-full bg-[var(--muted)]/35 px-4 py-3 text-sm font-bold">学习区联动</legend>
        <p className="app-muted-text px-4 py-2.5 text-[11px] leading-5">用真实完成事件决定学生能否继续。</p>
        <label className="grid min-h-14 items-center gap-2 px-4 py-3 text-xs font-medium md:grid-cols-[11rem_minmax(0,1fr)]">
          <span className="text-[var(--foreground-secondary)]">老师讲解指向</span>
          <select name="visual_cue_target_key" defaultValue={String(visualCue.targetKey ?? "")} disabled={!editable} className="app-input h-10 w-full border px-3">
            <option value="">不突出学习区内容</option>
            <option value="scene:image">当前板块的情景图片</option>
          </select>
        </label>
        <div className="grid gap-0 md:grid-cols-3 md:divide-x md:divide-[var(--border)]">
          <label className="grid min-h-14 items-center gap-2 px-4 py-3 text-xs font-medium sm:grid-cols-[7rem_minmax(0,1fr)]">
            <span className="text-[var(--foreground-secondary)]">提示效果</span>
            <select name="visual_cue_effect" defaultValue={String(visualCue.effect ?? "pulse")} disabled={!editable} className="app-input h-10 w-full border px-3">
              <option value="pulse">暖黄色轻柔闪动</option>
            </select>
          </label>
          <label className="grid min-h-14 items-center gap-2 px-4 py-3 text-xs font-medium sm:grid-cols-[7rem_minmax(0,1fr)]">
            <span className="text-[var(--foreground-secondary)]">闪动次数</span>
            <select name="visual_cue_pulse_count" defaultValue={String(visualCue.pulseCount ?? 2)} disabled={!editable} className="app-input h-10 w-full border px-3">
              <option value="1">1 次</option>
              <option value="2">2 次</option>
              <option value="3">3 次</option>
              <option value="4">4 次</option>
            </select>
          </label>
          <label className="grid min-h-14 items-center gap-2 px-4 py-3 text-xs font-medium sm:grid-cols-[7rem_minmax(0,1fr)]">
            <span className="text-[var(--foreground-secondary)]">单次时长</span>
            <span className="flex items-center gap-2">
              <input name="visual_cue_duration_ms" type="number" min={400} max={2500} step={100} defaultValue={Number(visualCue.durationMs ?? 1000)} disabled={!editable} className="app-input h-10 min-w-0 flex-1 border px-3 tabular-nums" />
              <span className="shrink-0 text-[11px] text-[var(--foreground-muted)]">毫秒</span>
            </span>
          </label>
        </div>
        <label className="grid min-h-14 items-center gap-2 px-4 py-3 text-xs font-medium md:grid-cols-[11rem_minmax(0,1fr)]">
          <span className="text-[var(--foreground-secondary)]">操作类型</span>
          <select name="student_task_kind" defaultValue={String(studentTask.kind ?? "none")} disabled={!editable} className="app-input h-10 w-full border px-3">
            <option value="none">不要求学习区操作</option>
            <option value="play_expression_audio">完整听完指定表达音频</option>
          </select>
        </label>
        <label className="grid gap-2 px-4 py-3 text-xs font-medium md:grid-cols-[11rem_minmax(0,1fr)]"><span className="pt-2 text-[var(--foreground-secondary)]">给学生的操作说明</span><textarea name="student_task_instruction_zh" defaultValue={localizedConfigurationText(studentTask, "instruction")} disabled={!editable} rows={3} maxLength={300} className="app-input w-full resize-y border px-3 py-2 text-xs leading-5" /></label>
        <label className="grid min-h-14 items-center gap-2 px-4 py-3 text-xs font-medium md:grid-cols-[11rem_minmax(0,1fr)]"><span className="text-[var(--foreground-secondary)]">目标名称</span><input name="student_task_target_label_zh" defaultValue={localizedConfigurationText(studentTask, "targetLabel")} disabled={!editable} maxLength={100} placeholder="例如：问候 · 안녕하세요?" className="app-input h-10 w-full border px-3" /></label>
        <label className="grid min-h-14 items-center gap-2 px-4 py-3 text-xs font-medium md:grid-cols-[11rem_minmax(0,1fr)]"><span className="text-[var(--foreground-secondary)]">学习区目标位置</span><input name="student_task_target_key" defaultValue={String(studentTask.targetKey ?? "")} disabled={!editable} maxLength={200} placeholder="例如：dialogue:greeting:0" className="app-input h-10 w-full border px-3 font-mono text-[11px]" /></label>
      </fieldset>
      <fieldset className="divide-y divide-[var(--border)]">
        <legend className="w-full bg-[var(--muted)]/35 px-4 py-3 text-sm font-bold">学生互动</legend>
        <p className="app-muted-text px-4 py-2.5 text-[11px] leading-5">问题和选项显示在老师讲解下方；正确答案与判定反馈只保存在后端私有表。</p>
        <label className="grid min-h-14 items-center gap-2 px-4 py-3 text-xs font-medium md:grid-cols-[11rem_minmax(0,1fr)]">
          <span className="text-[var(--foreground-secondary)]">回应方式</span>
          <select name="interaction_kind" defaultValue={String(interaction.kind ?? "none")} disabled={!editable} className="app-input h-10 w-full border px-3">
            <option value="none">本节点不要求学生回答</option>
            <option value="single_choice">学生点击选择回答</option>
          </select>
        </label>
        <label className="grid gap-2 px-4 py-3 text-xs font-medium md:grid-cols-[11rem_minmax(0,1fr)]">
          <span className="pt-2 text-[var(--foreground-secondary)]">老师提出的问题</span>
          <textarea name="interaction_prompt_zh" defaultValue={localizedConfigurationText(interaction, "prompt")} disabled={!editable} rows={3} maxLength={300} placeholder="例如：第一次见面时，王明应该先说哪一句？" className="app-input w-full resize-y border px-3 py-2 text-xs leading-5" />
          <FieldError errors={state.fieldErrors?.interactionPromptZh} />
        </label>
        <label className="grid gap-2 px-4 py-3 text-xs font-medium md:grid-cols-[11rem_minmax(0,1fr)]">
          <span className="pt-2 text-[var(--foreground-secondary)]">学生可选回答</span>
          <span>
            <textarea name="interaction_options" defaultValue={interactionOptions} disabled={!editable} rows={5} maxLength={800} placeholder={'안녕하세요?\n얼마예요?\n어디에 있어요?'} className="app-input w-full resize-y border px-3 py-2 text-xs leading-6" />
            <span className="mt-1 block text-[10px] leading-4 text-[var(--foreground-muted)]">每行一个选项，支持 2—6 个；填写顺序就是学生看到的顺序。</span>
          </span>
          <FieldError errors={state.fieldErrors?.interactionOptions} />
        </label>
        <div className="grid gap-0 md:grid-cols-3 md:divide-x md:divide-[var(--border)]">
          <label className="grid min-h-14 items-center gap-2 px-4 py-3 text-xs font-medium sm:grid-cols-[7rem_minmax(0,1fr)]"><span className="text-[var(--foreground-secondary)]">正确答案</span><span className="flex items-center gap-2"><span className="shrink-0 text-[11px] text-[var(--foreground-muted)]">第</span><input name="interaction_correct_option" type="number" min={1} max={6} defaultValue={(node.interactionSecret?.correctOptionIndex ?? 0) + 1} disabled={!editable} className="app-input h-10 min-w-0 flex-1 border px-3 tabular-nums" /><span className="shrink-0 text-[11px] text-[var(--foreground-muted)]">项</span></span></label>
          <label className="grid min-h-14 items-center gap-2 px-4 py-3 text-xs font-medium sm:grid-cols-[7rem_minmax(0,1fr)]"><span className="text-[var(--foreground-secondary)]">最多尝试</span><span className="flex items-center gap-2"><input name="interaction_max_attempts" type="number" min={1} max={5} defaultValue={Number(interaction.maxAttempts ?? 3)} disabled={!editable} className="app-input h-10 min-w-0 flex-1 border px-3 tabular-nums" /><span className="shrink-0 text-[11px] text-[var(--foreground-muted)]">次</span></span></label>
          <label className="flex min-h-14 items-center gap-2 px-4 py-3 text-xs font-medium"><input type="checkbox" name="interaction_required" defaultChecked={interaction.required !== false} disabled={!editable} className="size-4 accent-[var(--primary)]" />答对后才能继续</label>
        </div>
        <label className="grid gap-2 px-4 py-3 text-xs font-medium md:grid-cols-[11rem_minmax(0,1fr)]"><span className="pt-2 text-[var(--foreground-secondary)]">答对后的老师反馈</span><textarea name="interaction_correct_feedback_zh" defaultValue={node.interactionSecret?.correctFeedback["zh-CN"] ?? ""} disabled={!editable} rows={3} maxLength={600} className="app-input w-full resize-y border px-3 py-2 text-xs leading-5" /></label>
        <label className="grid gap-2 px-4 py-3 text-xs font-medium md:grid-cols-[11rem_minmax(0,1fr)]"><span className="pt-2 text-[var(--foreground-secondary)]">答错后的老师提示</span><textarea name="interaction_incorrect_feedback_zh" defaultValue={node.interactionSecret?.incorrectFeedback["zh-CN"] ?? ""} disabled={!editable} rows={3} maxLength={600} className="app-input w-full resize-y border px-3 py-2 text-xs leading-5" /></label>
      </fieldset>
      <label className="grid min-h-14 items-center gap-2 px-4 py-3 text-xs font-medium md:grid-cols-[11rem_minmax(0,1fr)]">
        <span className="text-[var(--foreground-secondary)]">引用教材活动</span>
        <select name="reference_activity_id" defaultValue={node.referenceActivityId ?? ""} disabled={!editable} className="app-input h-10 w-full border px-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-65">
          <option value="">不引用活动</option>
          {activities.map((activity) => (
            <option key={activity.id} value={activity.id}>{activity.prompt["zh-CN"] || activity.key}</option>
          ))}
        </select>
      </label>

      <details>
        <summary className="cursor-pointer px-4 py-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]">更多设置：跳转、页面动作和韩文台词</summary>
        <div className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
          <div className="grid gap-4 xl:grid-cols-2">
            <label className="space-y-1.5 text-xs font-medium"><span className="block">下一个节点</span><select name="next_node_key" defaultValue={node.nextNodeKey ?? ""} disabled={!editable} className="app-input h-10 w-full border px-3"><option value="">按时间轴顺序</option>{allNodes.filter((item) => item.id !== node.id).map((item) => <option key={item.id} value={item.key}>{item.order}. {item.title["zh-CN"]}</option>)}</select></label>
            <label className="space-y-1.5 text-xs font-medium"><span className="block">答错后返回</span><select name="remediation_node_key" defaultValue={node.remediationNodeKey ?? ""} disabled={!editable} className="app-input h-10 w-full border px-3"><option value="">停留当前节点</option>{allNodes.filter((item) => item.id !== node.id).map((item) => <option key={item.id} value={item.key}>{item.order}. {item.title["zh-CN"]}</option>)}</select></label>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <label className="space-y-1.5 text-xs font-medium"><span className="block">页面动作</span><select name="action_type" defaultValue={node.actionType} disabled={!editable} className="app-input h-10 w-full border px-3"><option value="none">不执行页面动作</option><option value="focus_activity">定位教材活动</option><option value="play_expression">定位表达并等待播放完成</option></select></label>
            <label className="space-y-1.5 text-xs font-medium"><span className="block">继续按钮文案</span><input name="continue_label_zh" defaultValue={configuredText(node, "continueLabel")} disabled={!editable} maxLength={40} className="app-input h-10 w-full border px-3" /></label>
          </div>
          <label className="block space-y-1.5 text-xs font-medium"><span>韩文标题</span><input name="title_ko" defaultValue={node.title["ko-KR"]} disabled={!editable} maxLength={80} className="app-input h-10 w-full border px-3" /></label>
          <label className="block space-y-1.5 text-xs font-medium"><span>韩文老师台词</span><textarea name="script_ko" defaultValue={node.script["ko-KR"]} disabled={!editable} rows={5} maxLength={1600} className="app-input w-full resize-y border px-3 py-2.5 text-sm leading-6" /></label>
          <div className="flex flex-wrap gap-5">
            <label className="flex items-center gap-2 text-xs font-medium"><input type="checkbox" name="required" defaultChecked={node.required} disabled={!editable} className="size-4 accent-[var(--primary)]" />必经节点</label>
            <label className="flex items-center gap-2 text-xs font-medium"><input type="checkbox" name="terminal" defaultChecked={node.configuration.terminal === true} disabled={!editable} className="size-4 accent-[var(--primary)]" />本次讲解终点</label>
          </div>
        </div>
      </details>
      </div>

      {editable && (
        <div className="sticky bottom-0 z-10 flex items-center justify-between gap-4 border-t bg-[var(--card)] px-1 py-3">
          <p className={state.status === "error" ? "text-xs text-[var(--status-danger)]" : "text-xs text-[var(--status-success)]"} role={state.status === "error" ? "alert" : "status"} aria-live="polite">
            {state.message}
          </p>
          <button type="submit" disabled={pending} className="inline-flex min-h-10 shrink-0 items-center justify-center bg-[var(--primary)] px-4 text-xs font-semibold text-[var(--primary-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60">
            {pending ? "正在保存…" : "保存到草稿"}
          </button>
        </div>
      )}
    </form>
  );
}
