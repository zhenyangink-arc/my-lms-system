export type BufferPresetLocale = "zh-CN" | "ko-KR";

/** Sentinel `bufferPresetId` meaning "this node has no buffer line at all" —
 * distinct from an unconfigured node, which must still pick a real preset. */
export const LEARNING_AGENT_BUFFER_PRESET_NONE_ID = "none";

export type LearningAgentBufferPreset = {
  id: string;
  text: Record<BufferPresetLocale, string>;
};

export const LEARNING_AGENT_BUFFER_PRESETS: readonly LearningAgentBufferPreset[] = [
  { id: "opening-greeting", text: { "zh-CN": "你好，欢迎来上课，我们准备好就开始吧。", "ko-KR": "안녕하세요, 수업에 오신 걸 환영해요. 준비되면 바로 시작할게요." } },
  { id: "teacher-introduction", text: { "zh-CN": "你好，我是你们的韩语老师，金老师。接下来由我陪伴你们学习韩语。", "ko-KR": "안녕하세요, 여러분의 한국어 선생님 김 선생님이에요. 앞으로 여러분의 한국어 학습을 함께할게요." } },
  { id: "steady-look", text: { "zh-CN": "稍等一下，我看看这里怎么讲。", "ko-KR": "잠시만요, 이 부분을 어떻게 설명할지 볼게요." } },
  { id: "continue", text: { "zh-CN": "好，我们接着往下看。", "ko-KR": "좋아요, 계속해서 살펴볼게요." } },
  { id: "new-content", text: { "zh-CN": "接下来，我们看一个新的内容。", "ko-KR": "이어서 새로운 내용을 살펴볼게요." } },
  { id: "step-by-step", text: { "zh-CN": "先别着急，我们一步一步来看。", "ko-KR": "서두르지 말고, 하나씩 살펴볼게요." } },
  { id: "next-part", text: { "zh-CN": "很好，下面看看这个部分。", "ko-KR": "좋아요, 이제 이 부분을 살펴볼게요." } },
  { id: "another-angle", text: { "zh-CN": "我们换个角度，再来看一下。", "ko-KR": "다른 관점에서 다시 한번 살펴볼게요." } },
  { id: "focus-learning", text: { "zh-CN": "接下来，请把注意力放到学习区。", "ko-KR": "이제 학습 영역에 집중해 주세요." } },
  { id: "look-right", text: { "zh-CN": "好，现在来看右侧的内容。", "ko-KR": "좋아요, 이제 오른쪽 내용을 살펴볼게요." } },
  { id: "remember-continue", text: { "zh-CN": "前面的内容先记住，我们继续。", "ko-KR": "앞에서 본 내용을 기억하면서 계속할게요." } },
  { id: "next-step", text: { "zh-CN": "准备好了吗？我们开始下一步。", "ko-KR": "준비됐나요? 다음 단계로 넘어갈게요." } },
] as const;

export function learningAgentBufferPreset(id: string) {
  return LEARNING_AGENT_BUFFER_PRESETS.find((preset) => preset.id === id) ?? null;
}

export function learningAgentBufferPresetForText(locale: BufferPresetLocale, text: string) {
  const normalized = text.trim();
  return LEARNING_AGENT_BUFFER_PRESETS.find((preset) => preset.text[locale] === normalized) ?? null;
}

export function learningAgentBufferPresetAssetRef(locale: BufferPresetLocale, text: string) {
  const preset = learningAgentBufferPresetForText(locale, text);
  return preset ? `buffer-preset:${preset.id}:${locale}` : null;
}

export function learningAgentBufferPresetObjectKey(id: string, locale: BufferPresetLocale) {
  return learningAgentBufferPreset(id)
    ? `learning-agent/speech/teacher-kim/buffer-presets/v1/${id}/${locale}.mp3`
    : null;
}
