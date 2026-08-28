"use client";

import { type FormEvent, useActionState, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { BookOpenText, MessageCircleQuestion, Plus, Route, ScrollText, Trash2 } from "lucide-react";

import {
  saveTeachingScriptNodeAction,
  type TeachingScriptActionState,
} from "@/app/dashboard/admin/teaching-scripts/actions";
import type { TeachingScriptActivity, TeachingScriptNode } from "./types";

const initialState: TeachingScriptActionState = { status: "idle" };

function configuredText(node: TeachingScriptNode, key: string) {
  const value = node.configuration[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  return String((value as Record<string, unknown>)["zh-CN"] ?? "");
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

function displayLocalizedText(display: Record<string, unknown>, key: string) {
  return localizedConfigurationText(display, key);
}

function displayLocalizedItems(display: Record<string, unknown>) {
  const value = display.items;
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const items = (value as Record<string, unknown>)["zh-CN"];
  return Array.isArray(items)
    ? items.filter((item): item is string => typeof item === "string").join("\n")
    : "";
}

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <span className="text-xs text-[var(--status-danger)] md:col-start-2" role="alert">{errors[0]}</span>;
}

function TypewriterPreview({ text }: { text: string }) {
  const characters = Array.from(text || "请填写老师台词");
  const [visibleLength, setVisibleLength] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const timer = window.setTimeout(() => setVisibleLength(characters.length), 0);
      return () => window.clearTimeout(timer);
    }
    let length = 0;
    const timer = window.setInterval(() => {
      length += 1;
      setVisibleLength(length);
      if (length >= characters.length) window.clearInterval(timer);
    }, 35);
    return () => window.clearInterval(timer);
  }, [characters.length]);

  const fullText = characters.join("");
  return (
    <p className="mt-2 min-h-7 whitespace-pre-line text-sm leading-7 text-[var(--foreground-secondary)]">
      <span aria-hidden="true">{characters.slice(0, visibleLength).join("")}</span>
      <span className="sr-only">{fullText}</span>
    </p>
  );
}

type EditorSection = "script" | "content" | "interaction" | "flow";

type NodePreview = {
  title: string;
  items: string[];
  korean: string;
  translation: string;
  scriptLines: string[];
  interactionKind: string;
  interactionPrompt: string;
  interactionOptions: string[];
  nextNodeKey: string;
  terminal: boolean;
  characterKind: string;
  characterPosition: string;
};

type ScriptPerformance = {
  pose: "greeting" | "explaining" | "encouraging";
  voiceEnabled: boolean;
  voiceLanguage: "auto" | "zh-CN" | "ko-KR";
  voiceRate: number;
};

function scriptPerformanceConfiguration(value: unknown, fallback: Record<string, unknown>): ScriptPerformance {
  const performance = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : fallback;
  const pose = performance.pose === "greeting" || performance.pose === "encouraging"
    ? performance.pose
    : "explaining";
  const voiceLanguage = performance.voiceLanguage === "zh-CN" || performance.voiceLanguage === "ko-KR"
    ? performance.voiceLanguage
    : "auto";
  const voiceRate = Number(performance.voiceRate);
  return {
    pose,
    voiceEnabled: performance.voiceEnabled !== false,
    voiceLanguage,
    voiceRate: Number.isFinite(voiceRate) ? Math.max(0.75, Math.min(1.25, voiceRate)) : 1,
  };
}

const characterImages: Record<string, string> = {
  greeting: "/api/learning-agent/characters/greeting",
  explaining: "/api/learning-agent/characters/explaining",
  encouraging: "/api/learning-agent/characters/encouraging",
};

const editorSteps: Array<{
  id: EditorSection;
  label: string;
  description: string;
  icon: typeof ScrollText;
}> = [
  { id: "script", label: "老师台词", description: "先写这一小节怎么讲", icon: ScrollText },
  { id: "content", label: "教学内容", description: "再安排学生看到什么", icon: BookOpenText },
  { id: "interaction", label: "互动设置", description: "按需让学生参与", icon: MessageCircleQuestion },
  { id: "flow", label: "流程设置", description: "最后决定如何继续", icon: Route },
];

const panelClass = "divide-y divide-[var(--border)] border border-[var(--border)] bg-[var(--card)]";
const fieldClass = "grid gap-2 px-4 py-4 text-sm font-medium md:grid-cols-[10rem_minmax(0,1fr)]";
const inputClass = "app-input min-h-11 w-full border px-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-65";

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
  const display = objectConfiguration(node, "display");
  const studentTask = objectConfiguration(node, "studentTask");
  const visualCue = objectConfiguration(node, "visualCue");
  const virtualCharacter = objectConfiguration(node, "virtualCharacter");
  const interaction = objectConfiguration(node, "interaction");
  const interactionOptions = Array.isArray(interaction.options)
    ? interaction.options.filter((item): item is string => typeof item === "string").join("\n")
    : "";
  const [scriptLines, setScriptLines] = useState(() => {
    const lines = node.script["zh-CN"].split(/\n\s*\n/);
    return lines.length > 0 ? lines : [""];
  });
  const storedScriptPerformances = Array.isArray(node.configuration.scriptPerformances)
    ? node.configuration.scriptPerformances
    : [];
  const [scriptPerformances, setScriptPerformances] = useState<ScriptPerformance[]>(() =>
    scriptLines.map((_, index) => scriptPerformanceConfiguration(storedScriptPerformances[index], {
      ...virtualCharacter,
      pose: virtualCharacter.pose ?? (index === 0 ? "greeting" : "explaining"),
    })),
  );
  const [editorSection, setEditorSection] = useState<EditorSection>("script");
  const [previewScriptIndex, setPreviewScriptIndex] = useState(0);
  const [preview, setPreview] = useState<NodePreview>({
    title: displayLocalizedText(display, "title"),
    items: displayLocalizedItems(display).split("\n").filter(Boolean),
    korean: String(display.korean ?? ""),
    translation: displayLocalizedText(display, "translation"),
    scriptLines,
    interactionKind: String(interaction.kind ?? "none"),
    interactionPrompt: localizedConfigurationText(interaction, "prompt"),
    interactionOptions: interactionOptions.split("\n").filter(Boolean),
    nextNodeKey: node.nextNodeKey ?? "",
    terminal: node.configuration.terminal === true,
    characterKind: String(virtualCharacter.kind ?? "none"),
    characterPosition: String(virtualCharacter.position ?? "right"),
  });

  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [router, state.status]);

  function updatePreview(event: FormEvent<HTMLFormElement>) {
    const values = new FormData(event.currentTarget);
    setPreview({
      title: String(values.get("display_title_zh") ?? ""),
      items: String(values.get("display_items_zh") ?? "").split("\n").map((item) => item.trim()).filter(Boolean),
      korean: String(values.get("display_korean") ?? ""),
      translation: String(values.get("display_translation_zh") ?? ""),
      scriptLines: values.getAll("script_zh").map(String),
      interactionKind: String(values.get("interaction_kind") ?? "none"),
      interactionPrompt: String(values.get("interaction_prompt_zh") ?? ""),
      interactionOptions: String(values.get("interaction_options") ?? "").split("\n").map((item) => item.trim()).filter(Boolean),
      nextNodeKey: String(values.get("next_node_key") ?? ""),
      terminal: values.get("terminal") === "on",
      characterKind: String(values.get("virtual_character_kind") ?? "none"),
      characterPosition: String(values.get("virtual_character_position") ?? "right"),
    });
  }

  const nextNode = allNodes.find((item) => item.key === preview.nextNodeKey);

  return (
    <form action={action} onInput={updatePreview} className="space-y-4" key={node.id}>
      <input type="hidden" name="node_id" value={node.id} />
      <input type="hidden" name="return_to" value={returnTo} />
      <input type="hidden" name="display_kind" value={String(display.kind ?? "overview")} />

      <div className="grid gap-2 border-b border-[var(--border)] pb-4 sm:grid-cols-4" role="tablist" aria-label="教学小节编辑步骤">
        {editorSteps.map((step, index) => {
          const Icon = step.icon;
          const selected = editorSection === step.id;
          return (
            <button
              key={step.id}
              type="button"
              role="tab"
              aria-controls={`teaching-${step.id}-panel`}
              aria-selected={selected}
              onClick={() => setEditorSection(step.id)}
              className={`min-h-20 border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${selected ? "border-[var(--primary)] bg-[var(--accent)]" : "border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)]/50"}`}
            >
              <span className="flex items-center gap-2 text-xs font-bold">
                <span className="tabular-nums text-[var(--muted-foreground)]">{index + 1}</span>
                <Icon size={15} aria-hidden="true" />
                {step.label}
              </span>
              <span className="mt-1.5 block text-xs leading-5 text-[var(--muted-foreground)]">{step.description}</span>
            </button>
          );
        })}
      </div>

      <div className="grid items-start gap-4 2xl:grid-cols-[minmax(28rem,1fr)_minmax(26rem,30rem)]">
        <div className="min-w-0">
          <div id="teaching-script-panel" hidden={editorSection !== "script"} role="tabpanel" className={panelClass}>
            <div className="px-4 py-4">
              <h3 className="text-sm font-bold">先写清楚这一小节怎么讲</h3>
              <p className="app-muted-text mt-1 text-xs leading-5">小节名称和老师台词由你决定。提示与补充例子只在学生主动需要时出现。</p>
            </div>
            <label className={fieldClass}>
              <span className="pt-3">小节名称</span>
              <input name="title_zh" defaultValue={node.title["zh-CN"]} disabled={!editable} maxLength={80} className={inputClass} />
              <FieldError errors={state.fieldErrors?.titleZh} />
            </label>
            <div className="divide-y divide-[var(--border)]">
              {scriptLines.map((line, index) => (
                <div key={index} className={fieldClass}>
                  <label htmlFor={`script-line-${index}`} className="pt-3">台词 {index + 1}</label>
                  <div>
                    <textarea
                      id={`script-line-${index}`}
                      name="script_zh"
                      value={line}
                      onChange={(event) => setScriptLines((current) => current.map((item, lineIndex) => lineIndex === index ? event.target.value : item))}
                      onFocus={() => setPreviewScriptIndex(index)}
                      disabled={!editable}
                      rows={2}
                      maxLength={1600}
                      className={`${inputClass} resize-y overflow-y-hidden py-3 text-sm leading-7`}
                    />
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <label className="space-y-1.5 text-xs font-medium">
                        <span className="block text-[var(--muted-foreground)]">人物动作</span>
                        <select
                          name="script_pose"
                          value={scriptPerformances[index]?.pose ?? "explaining"}
                          onChange={(event) => setScriptPerformances((current) => current.map((item, performanceIndex) => performanceIndex === index ? { ...item, pose: event.target.value as ScriptPerformance["pose"] } : item))}
                          disabled={!editable}
                          className={inputClass}
                        >
                          <option value="greeting">问候</option>
                          <option value="explaining">讲解</option>
                          <option value="encouraging">鼓励</option>
                        </select>
                      </label>
                      <label className="space-y-1.5 text-xs font-medium">
                        <span className="block text-[var(--muted-foreground)]">语音</span>
                        <select
                          name="script_voice"
                          value={scriptPerformances[index]?.voiceEnabled === false ? "off" : "on"}
                          onChange={(event) => setScriptPerformances((current) => current.map((item, performanceIndex) => performanceIndex === index ? { ...item, voiceEnabled: event.target.value === "on" } : item))}
                          disabled={!editable}
                          className={inputClass}
                        >
                          <option value="on">朗读这句台词</option>
                          <option value="off">只显示文字</option>
                        </select>
                      </label>
                      <label className="space-y-1.5 text-xs font-medium">
                        <span className="block text-[var(--muted-foreground)]">朗读语言</span>
                        <select
                          name="script_voice_language"
                          value={scriptPerformances[index]?.voiceLanguage ?? "auto"}
                          onChange={(event) => setScriptPerformances((current) => current.map((item, performanceIndex) => performanceIndex === index ? { ...item, voiceLanguage: event.target.value as ScriptPerformance["voiceLanguage"] } : item))}
                          disabled={!editable}
                          className={inputClass}
                        >
                          <option value="auto">自动判断</option>
                          <option value="zh-CN">中文</option>
                          <option value="ko-KR">韩语</option>
                        </select>
                      </label>
                      <label className="space-y-1.5 text-xs font-medium">
                        <span className="block text-[var(--muted-foreground)]">语速</span>
                        <select
                          name="script_voice_rate"
                          value={String(scriptPerformances[index]?.voiceRate ?? 1)}
                          onChange={(event) => setScriptPerformances((current) => current.map((item, performanceIndex) => performanceIndex === index ? { ...item, voiceRate: Number(event.target.value) } : item))}
                          disabled={!editable}
                          className={inputClass}
                        >
                          <option value="0.85">慢速</option>
                          <option value="1">标准</option>
                          <option value="1.15">稍快</option>
                        </select>
                      </label>
                    </div>
                    {editable && scriptLines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const nextLines = scriptLines.filter((_, lineIndex) => lineIndex !== index);
                          setScriptLines(nextLines);
                          setScriptPerformances((current) => current.filter((_, performanceIndex) => performanceIndex !== index));
                          setPreview((current) => ({ ...current, scriptLines: nextLines }));
                          setPreviewScriptIndex((current) => Math.min(current, Math.max(0, nextLines.length - 1)));
                        }}
                        aria-label={`删除台词 ${index + 1}`}
                        className="mt-2 inline-flex min-h-11 items-center gap-1.5 px-3 text-sm font-semibold text-[var(--destructive)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--destructive)]"
                      >
                        <Trash2 size={15} aria-hidden="true" />删除
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {editable && (
                <div className="px-4 py-4 md:pl-[11.5rem]">
                  <button
                    type="button"
                    onClick={() => {
                      setScriptLines((current) => [...current, ""]);
                      setScriptPerformances((current) => [...current, scriptPerformanceConfiguration(null, {
                        ...virtualCharacter,
                        pose: virtualCharacter.pose ?? "explaining",
                      })]);
                    }}
                    className="inline-flex min-h-11 items-center gap-2 border border-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                  >
                    <Plus size={16} aria-hidden="true" />增加台词
                  </button>
                </div>
              )}
              {state.fieldErrors?.scriptZh?.length ? <div className="px-4 pb-4 text-xs text-[var(--status-danger)] md:pl-[11.5rem]" role="alert">{state.fieldErrors.scriptZh[0]}</div> : null}
            </div>
            <label className={fieldClass}>
              <span className="pt-3">没听懂时的提示</span>
              <textarea name="hint_zh" defaultValue={configuredText(node, "hint")} disabled={!editable} rows={3} maxLength={600} className={`${inputClass} resize-y py-3 text-sm leading-6`} />
            </label>
            <label className={fieldClass}>
              <span className="pt-3">再举一个例子</span>
              <textarea name="example_zh" defaultValue={configuredText(node, "example")} disabled={!editable} rows={3} maxLength={600} className={`${inputClass} resize-y py-3 text-sm leading-6`} />
            </label>
            <details className="px-4 py-4">
              <summary className="cursor-pointer text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">韩文标题与台词</summary>
              <div className="mt-4 grid gap-4">
                <label className="space-y-2 text-sm font-medium"><span className="block">韩文小节名称</span><input name="title_ko" defaultValue={node.title["ko-KR"]} disabled={!editable} maxLength={80} className={inputClass} /></label>
                <label className="space-y-2 text-sm font-medium"><span className="block">韩文老师台词</span><textarea name="script_ko" defaultValue={node.script["ko-KR"]} disabled={!editable} rows={5} maxLength={1600} className={`${inputClass} resize-y py-3 leading-6`} /></label>
              </div>
            </details>
          </div>

          <div id="teaching-content-panel" hidden={editorSection !== "content"} role="tabpanel" className={panelClass}>
            <div className="px-4 py-4">
              <h3 className="text-sm font-bold">安排学生此时看到和操作的内容</h3>
              <p className="app-muted-text mt-1 text-xs leading-5">没有额外展示时可以全部留空；老师台词仍会正常出现。</p>
            </div>
            <label className={fieldClass}><span className="pt-3">展示标题</span><input name="display_title_zh" defaultValue={displayLocalizedText(display, "title")} disabled={!editable} maxLength={80} className={inputClass} /></label>
            <label className={fieldClass}><span className="pt-3">展示要点</span><span><textarea name="display_items_zh" defaultValue={displayLocalizedItems(display)} disabled={!editable} rows={5} maxLength={1000} placeholder="每行填写一个要点" className={`${inputClass} resize-y py-3 leading-6`} /><span className="app-muted-text mt-1 block text-xs">每行一个要点，顺序就是学生看到的顺序。</span></span></label>
            <label className={fieldClass}><span className="pt-3">韩语内容</span><textarea name="display_korean" defaultValue={String(display.korean ?? "")} disabled={!editable} rows={4} maxLength={1000} className={`${inputClass} resize-y py-3 text-base leading-7`} /></label>
            <label className={fieldClass}><span className="pt-3">中文释义</span><textarea name="display_translation_zh" defaultValue={displayLocalizedText(display, "translation")} disabled={!editable} rows={3} maxLength={600} className={`${inputClass} resize-y py-3 leading-6`} /></label>

            <div className="px-4 py-4">
              <h4 className="text-sm font-bold">虚拟人物</h4>
              <p className="app-muted-text mt-1 text-xs leading-5">这里决定金老师是否出现；每句台词的动作和语音在“老师台词”中设置。</p>
            </div>
            <label className={fieldClass}><span className="pt-3">显示人物</span><select name="virtual_character_kind" defaultValue={String(virtualCharacter.kind ?? "none")} disabled={!editable} className={inputClass}><option value="none">不显示虚拟人物</option><option value="uply-teacher">韩语金老师</option></select></label>
            <label className={fieldClass}><span className="pt-3">出现位置</span><select name="virtual_character_position" defaultValue={String(virtualCharacter.position ?? "right")} disabled={!editable} className={inputClass}><option value="right">学习区右侧</option><option value="left">学习区左侧</option></select></label>

            <div className="px-4 py-4">
              <h4 className="text-sm font-bold">学习区联动</h4>
              <p className="app-muted-text mt-1 text-xs leading-5">需要学生看图或听右侧音频时再设置。</p>
            </div>
            <label className={fieldClass}><span className="pt-3">老师讲解指向</span><select name="visual_cue_target_key" defaultValue={String(visualCue.targetKey ?? "")} disabled={!editable} className={inputClass}><option value="">不突出学习区内容</option><option value="scene:image">当前步骤的情景图片</option></select></label>
            <div className="grid gap-4 px-4 py-4 md:grid-cols-3">
              <label className="space-y-2 text-sm font-medium"><span className="block">提示效果</span><select name="visual_cue_effect" defaultValue={String(visualCue.effect ?? "pulse")} disabled={!editable} className={inputClass}><option value="pulse">暖黄色轻柔闪动</option></select></label>
              <label className="space-y-2 text-sm font-medium"><span className="block">闪动次数</span><select name="visual_cue_pulse_count" defaultValue={String(visualCue.pulseCount ?? 2)} disabled={!editable} className={inputClass}><option value="1">1 次</option><option value="2">2 次</option><option value="3">3 次</option><option value="4">4 次</option></select></label>
              <label className="space-y-2 text-sm font-medium"><span className="block">单次时长</span><input name="visual_cue_duration_ms" type="number" min={400} max={2500} step={100} defaultValue={Number(visualCue.durationMs ?? 1000)} disabled={!editable} className={`${inputClass} tabular-nums`} /></label>
            </div>
            <label className={fieldClass}><span className="pt-3">学生操作</span><select name="student_task_kind" defaultValue={String(studentTask.kind ?? "none")} disabled={!editable} className={inputClass}><option value="none">不要求学习区操作</option><option value="play_expression_audio">完整听完指定表达音频</option></select></label>
            <label className={fieldClass}><span className="pt-3">操作说明</span><textarea name="student_task_instruction_zh" defaultValue={localizedConfigurationText(studentTask, "instruction")} disabled={!editable} rows={3} maxLength={300} className={`${inputClass} resize-y py-3 leading-6`} /></label>
            <label className={fieldClass}><span className="pt-3">目标名称</span><input name="student_task_target_label_zh" defaultValue={localizedConfigurationText(studentTask, "targetLabel")} disabled={!editable} maxLength={100} placeholder="例如：问候 · 안녕하세요?" className={inputClass} /></label>
            <label className={fieldClass}><span className="pt-3">学习区目标位置</span><input name="student_task_target_key" defaultValue={String(studentTask.targetKey ?? "")} disabled={!editable} maxLength={200} placeholder="例如：dialogue:greeting:0" className={`${inputClass} font-mono text-xs`} /></label>
          </div>

          <div id="teaching-interaction-panel" hidden={editorSection !== "interaction"} role="tabpanel" className={panelClass}>
            <div className="px-4 py-4">
              <h3 className="text-sm font-bold">决定这一小节是否轮到学生参与</h3>
              <p className="app-muted-text mt-1 text-xs leading-5">普通讲解选择“不要求学生回答”即可，不会自动弹出作答框。</p>
            </div>
            <label className={fieldClass}><span className="pt-3">回应方式</span><select name="interaction_kind" defaultValue={String(interaction.kind ?? "none")} disabled={!editable} className={inputClass}><option value="none">不要求学生回答</option><option value="single_choice">学生点击选择回答</option></select></label>
            <label className={fieldClass}><span className="pt-3">老师提出的问题</span><textarea name="interaction_prompt_zh" defaultValue={localizedConfigurationText(interaction, "prompt")} disabled={!editable} rows={3} maxLength={300} className={`${inputClass} resize-y py-3 leading-6`} /><FieldError errors={state.fieldErrors?.interactionPromptZh} /></label>
            <label className={fieldClass}><span className="pt-3">学生可选回答</span><span><textarea name="interaction_options" defaultValue={interactionOptions} disabled={!editable} rows={6} maxLength={800} placeholder={'안녕하세요?\n얼마예요?\n어디에 있어요?'} className={`${inputClass} resize-y py-3 leading-7`} /><span className="app-muted-text mt-1 block text-xs">每行一个选项，支持 2—6 个。</span></span><FieldError errors={state.fieldErrors?.interactionOptions} /></label>
            <div className="grid gap-4 px-4 py-4 md:grid-cols-3">
              <label className="space-y-2 text-sm font-medium"><span className="block">正确答案序号</span><input name="interaction_correct_option" type="number" min={1} max={6} defaultValue={(node.interactionSecret?.correctOptionIndex ?? 0) + 1} disabled={!editable} className={`${inputClass} tabular-nums`} /></label>
              <label className="space-y-2 text-sm font-medium"><span className="block">最多尝试次数</span><input name="interaction_max_attempts" type="number" min={1} max={5} defaultValue={Number(interaction.maxAttempts ?? 3)} disabled={!editable} className={`${inputClass} tabular-nums`} /></label>
              <label className="flex min-h-11 items-center gap-2 pt-7 text-sm font-medium"><input type="checkbox" name="interaction_required" defaultChecked={interaction.required !== false} disabled={!editable} className="size-4 accent-[var(--primary)]" />完成回答后才能继续</label>
            </div>
            <label className={fieldClass}><span className="pt-3">答对后的老师反馈</span><textarea name="interaction_correct_feedback_zh" defaultValue={node.interactionSecret?.correctFeedback["zh-CN"] ?? ""} disabled={!editable} rows={3} maxLength={600} className={`${inputClass} resize-y py-3 leading-6`} /></label>
            <label className={fieldClass}><span className="pt-3">答错后的老师提示</span><textarea name="interaction_incorrect_feedback_zh" defaultValue={node.interactionSecret?.incorrectFeedback["zh-CN"] ?? ""} disabled={!editable} rows={3} maxLength={600} className={`${inputClass} resize-y py-3 leading-6`} /></label>
          </div>

          <div id="teaching-flow-panel" hidden={editorSection !== "flow"} role="tabpanel" className={panelClass}>
            <div className="px-4 py-4">
              <h3 className="text-sm font-bold">决定完成后进入哪里</h3>
              <p className="app-muted-text mt-1 text-xs leading-5">默认按左侧小节顺序继续；只有分支教学时才指定跳转。</p>
            </div>
            <label className={fieldClass}><span className="pt-3">下一个小节</span><select name="next_node_key" defaultValue={node.nextNodeKey ?? ""} disabled={!editable} className={inputClass}><option value="">按左侧顺序进入下一小节</option>{allNodes.filter((item) => item.id !== node.id).map((item) => <option key={item.id} value={item.key}>{item.order}. {item.title["zh-CN"]}</option>)}</select></label>
            <label className={fieldClass}><span className="pt-3">答错后去哪里</span><select name="remediation_node_key" defaultValue={node.remediationNodeKey ?? ""} disabled={!editable} className={inputClass}><option value="">停留在当前小节</option>{allNodes.filter((item) => item.id !== node.id).map((item) => <option key={item.id} value={item.key}>{item.order}. {item.title["zh-CN"]}</option>)}</select></label>
            <label className={fieldClass}><span className="pt-3">引用教材活动</span><select name="reference_activity_id" defaultValue={node.referenceActivityId ?? ""} disabled={!editable} className={inputClass}><option value="">不引用活动</option>{activities.map((activity) => <option key={activity.id} value={activity.id}>{activity.prompt["zh-CN"] || activity.key}</option>)}</select></label>
            <label className={fieldClass}><span className="pt-3">页面动作</span><select name="action_type" defaultValue={node.actionType} disabled={!editable} className={inputClass}><option value="none">不执行页面动作</option><option value="focus_activity">定位教材活动</option><option value="play_expression">定位表达并等待播放完成</option><option value="complete_lesson">完成当前讲解</option></select></label>
            <label className={fieldClass}><span className="pt-3">继续按钮文案</span><input name="continue_label_zh" defaultValue={configuredText(node, "continueLabel")} disabled={!editable} maxLength={40} placeholder="默认：继续下一步" className={inputClass} /></label>
            <div className="grid gap-4 px-4 py-4 md:grid-cols-2">
              <label className="flex min-h-11 items-center gap-2 text-sm font-medium"><input type="checkbox" name="required" defaultChecked={node.required} disabled={!editable} className="size-4 accent-[var(--primary)]" />这是必经小节</label>
              <label className="flex min-h-11 items-center gap-2 text-sm font-medium"><input type="checkbox" name="terminal" defaultChecked={node.configuration.terminal === true} disabled={!editable} className="size-4 accent-[var(--primary)]" />这是当前学习步骤的最后一节</label>
            </div>
            <details className="px-4 py-4">
              <summary className="cursor-pointer text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">系统信息</summary>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm font-medium"><span className="block">小节类型</span><select name="node_type" defaultValue={node.type} disabled={!editable} className={inputClass}><option value="opening">课堂开场</option><option value="instruction">观察或操作引导</option><option value="explanation">知识讲解</option><option value="example">例句示范</option><option value="question">理解检查</option><option value="summary">课堂总结</option></select><FieldError errors={state.fieldErrors?.nodeType} /></label>
                <label className="space-y-2 text-sm font-medium"><span className="block">系统标识</span><input name="node_key" defaultValue={node.key} readOnly className={`${inputClass} font-mono text-xs opacity-75`} /></label>
              </div>
            </details>
          </div>
        </div>

        <aside aria-label="学生端实时预览" className="mx-auto w-full max-w-3xl border border-[var(--border)] bg-[var(--card)] 2xl:sticky 2xl:top-4 2xl:max-w-none">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <h3 className="text-sm font-bold">学生端预览</h3>
            <p className="app-muted-text mt-1 text-xs">输入内容时自动更新</p>
          </div>
          <div className="p-4">
            <p className="text-xs font-semibold text-[var(--muted-foreground)]">教学内容</p>
            {preview.characterKind === "uply-teacher" && (
              <div className={`mt-2 flex ${preview.characterPosition === "left" ? "justify-start" : "justify-end"}`}>
                <Image
                  src={characterImages[scriptPerformances[previewScriptIndex]?.pose ?? "explaining"] ?? characterImages.explaining}
                  alt={`韩语金老师，${scriptPerformances[previewScriptIndex]?.pose === "greeting" ? "问候" : scriptPerformances[previewScriptIndex]?.pose === "encouraging" ? "鼓励" : "讲解"}状态`}
                  width={512}
                  height={1024}
                  unoptimized
                  className="h-40 w-auto object-contain"
                />
              </div>
            )}
            <p className="mt-2 text-base font-bold">{preview.title || "当前没有额外展示"}</p>
            {preview.items.length > 0 && <ol className="mt-3 space-y-2">{preview.items.map((item, index) => <li key={`${item}-${index}`} className="flex items-start gap-2 text-sm leading-6"><span className="font-bold text-[var(--primary)]">{index + 1}</span><span>{item}</span></li>)}</ol>}
            {preview.korean && <div className="mt-4 border-l-2 border-[var(--primary)] pl-3"><p lang="ko" className="whitespace-pre-line text-base font-bold leading-7">{preview.korean}</p>{preview.translation && <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">{preview.translation}</p>}</div>}
          </div>
          <div className="border-t border-[var(--border)] p-4">
            <p className="text-xs font-semibold text-[var(--muted-foreground)]">韩语金老师</p>
            <TypewriterPreview key={`${previewScriptIndex}-${preview.scriptLines[previewScriptIndex] ?? ""}`} text={preview.scriptLines[previewScriptIndex] ?? ""} />
          </div>
          {preview.interactionKind === "single_choice" && (
            <div className="border-t border-[var(--border)] p-4">
              <p className="text-xs font-bold text-[var(--status-warning)]">轮到学生回答</p>
              <p className="mt-2 text-sm font-bold leading-6">{preview.interactionPrompt || "请填写互动问题"}</p>
              <div className="mt-3 grid gap-2">{preview.interactionOptions.map((option, index) => <span key={`${option}-${index}`} className="min-h-10 border border-[var(--border)] px-3 py-2 text-sm"><span className="mr-2 text-xs text-[var(--muted-foreground)]">{String.fromCharCode(65 + index)}</span><span lang="ko">{option}</span></span>)}</div>
            </div>
          )}
          <div className="border-t border-[var(--border)] px-4 py-3 text-xs leading-5 text-[var(--muted-foreground)]">
            {preview.terminal ? "完成后结束当前学习步骤" : nextNode ? `完成后进入：${nextNode.title["zh-CN"]}` : "完成后按左侧顺序继续"}
          </div>
        </aside>
      </div>

      {editable && (
        <div className="sticky bottom-0 z-10 flex min-h-16 items-center justify-between gap-4 border border-[var(--border)] bg-[var(--card)] px-4 py-3 shadow-[0_-8px_20px_color-mix(in_srgb,var(--background)_78%,transparent)]">
          <p className={state.status === "error" ? "text-sm text-[var(--status-danger)]" : "text-sm text-[var(--status-success)]"} role={state.status === "error" ? "alert" : "status"} aria-live="polite">{state.message || "修改会先保存到草稿，不会立即影响学生。"}</p>
          <button type="submit" disabled={pending} className="inline-flex min-h-11 shrink-0 items-center justify-center bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60">{pending ? "正在保存…" : "保存当前小节"}</button>
        </div>
      )}
    </form>
  );
}
