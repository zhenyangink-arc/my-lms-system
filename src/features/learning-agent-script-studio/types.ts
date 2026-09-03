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

export type TeachingScriptSpeechAsset = {
  id: string;
  locale: "zh-CN" | "ko-KR";
  segmentIndex: number;
  contentHash: string;
  durationMs: number;
  voiceManifest: Record<string, unknown>;
  productionStatus: "pending" | "ready" | "failed";
  updatedAt: string;
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
  /** Server row's `updated_at`, echoed back on save as a compare-and-swap
   * token — see `nodeUpdatedAt` in saveTeachingScriptNodeAction. */
  updatedAt: string;
  speechAssets: TeachingScriptSpeechAsset[];
  speechAssetsFromPublishedVersion: boolean;
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
  learningTargets: SmartTextbookLearningTarget[];
  versions: TeachingScriptVersion[];
};

export type CharacterStyleTemplate = {
  id: string;
  name: string;
  virtualCharacterPosition: "left" | "right";
  characterX: number;
  characterY: number;
  characterScale: number;
  dialogueX: number;
  dialogueY: number;
  splitCharacterX: number;
  splitCharacterY: number;
  splitCharacterScale: number;
  splitDialogueX: number;
  splitDialogueY: number;
  narrowCharacterX: number;
  narrowCharacterY: number;
  narrowCharacterScale: number;
  blackboardX: number;
  blackboardY: number;
  blackboardScale: number;
};

export type BlackboardLayoutTemplateElement = {
  type: "text" | "bullets" | "expression";
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontWeight: 400 | 600 | 700;
  align: "left" | "center" | "right";
  tone: "default" | "primary" | "highlight" | "muted";
};

export type BlackboardLayoutTemplate = {
  id: string;
  name: string;
  background: "plain" | "warm" | "grid";
  elements: BlackboardLayoutTemplateElement[];
};

export type TeachingScriptStudioData = {
  appId: string;
  modules: TeachingScriptModule[];
  characterStyleTemplates: CharacterStyleTemplate[];
  blackboardLayoutTemplates: BlackboardLayoutTemplate[];
};
import type { SmartTextbookLearningTarget } from "@/lib/smart-textbook-learning-targets";
