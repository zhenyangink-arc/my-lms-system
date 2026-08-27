export type LocalizedText = {
  "zh-CN": string;
  "ko-KR": string;
};

export type TeachingScriptActivity = {
  id: string;
  key: string;
  type: string;
  prompt: LocalizedText;
};

export type TeachingScriptNode = {
  id: string;
  versionId: string;
  key: string;
  type: "opening" | "explanation" | "example" | "question" | "instruction" | "summary";
  order: number;
  title: LocalizedText;
  script: LocalizedText;
  configuration: Record<string, unknown>;
  referenceActivityId: string | null;
  actionType: "none" | "focus_activity" | "play_expression" | "complete_lesson";
  nextNodeKey: string | null;
  remediationNodeKey: string | null;
  required: boolean;
  interactionSecret: {
    correctOptionIndex: number;
    correctFeedback: LocalizedText;
    incorrectFeedback: LocalizedText;
  } | null;
};

export type TeachingScriptVersion = {
  id: string;
  lessonId: string;
  number: number;
  status: "draft" | "published" | "archived";
  title: LocalizedText;
  changeNote: string;
  publishedAt: string | null;
  nodes: TeachingScriptNode[];
};

export type TeachingScriptModule = {
  id: string;
  code: string;
  order: number;
  title: LocalizedText;
  chapterId: string;
  chapterNumber: number;
  chapterTitle: LocalizedText;
  textbookId: string;
  textbookTitle: LocalizedText;
  lessonId: string | null;
  activities: TeachingScriptActivity[];
  versions: TeachingScriptVersion[];
};

export type TeachingScriptStudioData = {
  appId: string;
  modules: TeachingScriptModule[];
};
