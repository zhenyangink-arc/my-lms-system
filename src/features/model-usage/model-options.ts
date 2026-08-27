export const LEARNING_AGENT_MODEL_OPTIONS = {
  qwen: [
    { value: "qwen3.7-plus", label: "Qwen 3.7 Plus" },
    { value: "qwen-plus", label: "Qwen Plus" },
    { value: "qwen-max", label: "Qwen Max" },
  ],
  deepseek: [
    { value: "deepseek-v4-flash", label: "DeepSeek V4 Flash" },
    { value: "deepseek-v4-pro", label: "DeepSeek V4 Pro" },
  ],
} as const;

export type LearningAgentProvider = keyof typeof LEARNING_AGENT_MODEL_OPTIONS;

export function isLearningAgentProvider(
  value: unknown,
): value is LearningAgentProvider {
  return value === "qwen" || value === "deepseek";
}

export function isSupportedLearningAgentModel(
  provider: LearningAgentProvider,
  model: string,
) {
  return LEARNING_AGENT_MODEL_OPTIONS[provider].some(
    (option) => option.value === model,
  );
}
