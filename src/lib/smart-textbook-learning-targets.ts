export type SmartTextbookLearningTargetScope = "page" | "region" | "element";

export type SmartTextbookLearningTarget = {
  key: string;
  pageKey: string;
  pageLabel: string;
  regionKey: string;
  regionLabel: string;
  label: string;
  scope: SmartTextbookLearningTargetScope;
  kind: "layout" | "tab" | "status" | "image" | "title" | "button" | "expression" | "activity";
  supportsStudentAction?: boolean;
};

type ActivityTargetInput = {
  id: string;
  type: string;
  prompt: { "zh-CN": string };
};

type OrientationTargetInput = {
  content?: Record<string, unknown>;
  activities?: ActivityTargetInput[];
};

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function localizedText(value: unknown, fallback: string) {
  const record = objectValue(value);
  return String(record["zh-CN"] ?? record["ko-KR"] ?? value ?? fallback).trim() || fallback;
}

function activityTypeLabel(type: string) {
  if (type === "single_choice") return "单选题";
  if (type === "multiple_choice") return "多选题";
  if (type === "ordering") return "排序练习";
  if (type === "listening") return "听力任务";
  if (type === "speaking") return "口语任务";
  if (type === "writing") return "写作任务";
  if (type === "self_check") return "自我检查";
  return "学习任务";
}

function target(
  key: string,
  pageKey: string,
  pageLabel: string,
  regionKey: string,
  regionLabel: string,
  label: string,
  scope: SmartTextbookLearningTargetScope,
  kind: SmartTextbookLearningTarget["kind"],
  supportsStudentAction = false,
): SmartTextbookLearningTarget {
  return { key, pageKey, pageLabel, regionKey, regionLabel, label, scope, kind, supportsStudentAction };
}

export function buildOrientationLearningTargets({
  content = {},
  activities = [],
}: OrientationTargetInput = {}): SmartTextbookLearningTarget[] {
  const targets: SmartTextbookLearningTarget[] = [
    target("orientation:header", "header", "固定顶部栏", "header", "顶部栏", "整个顶部栏", "region", "layout"),
    target("orientation:header:hide", "header", "固定顶部栏", "header", "顶部栏", "按钮1 · 隐藏学习区", "element", "button"),
    target("orientation:header:tab:scene", "header", "固定顶部栏", "header", "顶部栏", "页签1 · 情景与表达", "element", "tab"),
    target("orientation:header:tab:diagnosis", "header", "固定顶部栏", "header", "顶部栏", "页签2 · 情景诊断", "element", "tab"),
    target("orientation:header:progress", "header", "固定顶部栏", "header", "顶部栏", "信息1 · 学习完成度", "element", "status"),
    target("orientation:header:goal", "header", "固定顶部栏", "header", "顶部栏", "信息2 · 当前目标序号", "element", "status"),

    target("orientation:page:scene", "scene", "第1页 · 情景与表达", "page", "整个页面", "整个“情景与表达”页面", "page", "layout"),
    target("orientation:scene", "scene", "第1页 · 情景与表达", "scene", "区域1 · 主情景图", "整个主情景图片区", "region", "layout"),
    target("scene:image", "scene", "第1页 · 情景与表达", "scene", "区域1 · 主情景图", "图片1 · 第一次见面情景图", "element", "image"),
    target("orientation:scene:audio", "scene", "第1页 · 情景与表达", "scene", "区域1 · 主情景图", "按钮1 · 播放情景对话", "element", "button", true),
    target("orientation:scene:title", "scene", "第1页 · 情景与表达", "scene", "区域1 · 主情景图", "标题1 · 情景名称", "element", "title"),
    target("orientation:scene:meta", "scene", "第1页 · 情景与表达", "scene", "区域1 · 主情景图", "信息1 · 学习时长与交流功能", "element", "status"),

    target("orientation:phrases", "scene", "第1页 · 情景与表达", "phrases", "区域2 · 本课可调用表达", "整个表达区", "region", "layout"),
    target("orientation:phrases:follow", "scene", "第1页 · 情景与表达", "phrases", "区域2 · 本课可调用表达", "按钮1 · 逐句跟读", "element", "button", true),
    target("orientation:phrases:play-all", "scene", "第1页 · 情景与表达", "phrases", "区域2 · 本课可调用表达", "按钮2 · 整组播放", "element", "button", true),

    target("orientation:page:diagnosis", "diagnosis", "第2页 · 情景诊断", "page", "整个页面", "整个“情景诊断”页面", "page", "layout"),
  ];

  const configuredGroups = Array.isArray(content.dialogueGroups)
    ? content.dialogueGroups.map(objectValue)
    : [];
  const fallbackLines = Array.isArray(content.targets) ? content.targets.map(objectValue) : [];
  const groups = configuredGroups.length > 0
    ? configuredGroups
    : [{ id: "expressions", title: { "zh-CN": "核心表达" }, lines: fallbackLines }];

  groups.forEach((group, groupIndex) => {
    const groupId = String(group.id ?? groupIndex);
    const groupTitle = localizedText(group.title, `表达组 ${groupIndex + 1}`);
    targets.push(target(
      `orientation:phrases:group:${groupId}`,
      "scene",
      "第1页 · 情景与表达",
      "phrases",
      "区域2 · 本课可调用表达",
      `分类${groupIndex + 1} · ${groupTitle}`,
      "element",
      "tab",
    ));
    const lines = Array.isArray(group.lines) ? group.lines.map(objectValue) : [];
    lines.forEach((line, lineIndex) => {
      const korean = String(line.ko ?? "").trim();
      const speaker = String(line.speaker ?? `表达${lineIndex + 1}`).trim();
      targets.push(target(
        `dialogue:${groupId}:${lineIndex}`,
        "scene",
        "第1页 · 情景与表达",
        "phrases",
        "区域2 · 本课可调用表达",
        `表达${lineIndex + 1} · ${speaker}${korean ? `：${korean}` : ""}`,
        "element",
        "expression",
        true,
      ));
    });
  });

  activities.forEach((activity, activityIndex) => {
    targets.push(target(
      `activity:${activity.id}`,
      "diagnosis",
      "第2页 · 情景诊断",
      "diagnosis",
      "区域1 · 诊断任务",
      `${activityTypeLabel(activity.type)} ${activityIndex + 1} · ${activity.prompt["zh-CN"] || "未填写题目"}`,
      activityIndex === 0 ? "region" : "element",
      "activity",
    ));
  });

  return targets;
}

export function findLearningTarget(
  targets: SmartTextbookLearningTarget[],
  targetKey: string,
) {
  return targets.find((item) => item.key === targetKey);
}
