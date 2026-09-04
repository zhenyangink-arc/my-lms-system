export type ResolvedGuideAgentRule = {
  id: string;
  name: string;
  actionType: "navigate" | "highlight";
  targetPath: string;
  targetElementId: string | null;
  responseText: string;
};

export type GuideAgentRuleRow = {
  id: string;
  name: string;
  trigger_phrases: string[];
  action_type: string;
  target_path: string;
  target_element_id: string | null;
  response_text: string;
  priority: number;
};

// 分句边界字符：用它替换标点，而不是直接删除，这样否定词判断不会跨越句子边界误伤后面无关的分句。
const CLAUSE_BREAK = "";

function normalizeMessage(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[，。！？、,.!?;；:_#-]+/g, CLAUSE_BREAK);
}

const NEGATION_MARKERS = ["暂时不", "先不要", "不需要", "不想", "不要", "不用", "不能", "不是", "无需", "别", "取消"];
const TRAILING_CANCELLATIONS = ["算了", "不要了", "先不了", "取消"];

function hasPositivePhraseMatch(message: string, phrase: string) {
  let searchFrom = 0;
  while (searchFrom <= message.length - phrase.length) {
    const matchIndex = message.indexOf(phrase, searchFrom);
    if (matchIndex < 0) return false;
    const rawPrefix = message.slice(Math.max(0, matchIndex - 10), matchIndex);
    // 否定词只在同一分句内生效：截断到最近一个分句边界之后的部分。
    const clauseBoundary = rawPrefix.lastIndexOf(CLAUSE_BREAK);
    const prefix = clauseBoundary >= 0 ? rawPrefix.slice(clauseBoundary + 1) : rawPrefix;
    const suffix = message
      .slice(matchIndex + phrase.length, matchIndex + phrase.length + 5)
      .replace(new RegExp(`^${CLAUSE_BREAK}+`), "");
    const isNegated = NEGATION_MARKERS.some((marker) => prefix.includes(marker));
    const isCancelled = TRAILING_CANCELLATIONS.some((marker) => suffix.startsWith(marker));
    if (!isNegated && !isCancelled) return true;
    searchFrom = matchIndex + phrase.length;
  }
  return false;
}

export function matchGuideAgentRule(message: string, rows: GuideAgentRuleRow[]) {
  const normalizedMessage = normalizeMessage(message);
  if (!normalizedMessage) return null;

  const match = [...rows]
    .sort((left, right) => right.priority - left.priority)
    .find((row) => row.trigger_phrases.some((phrase) => {
      const normalizedPhrase = normalizeMessage(phrase);
      return normalizedPhrase.length > 0 && hasPositivePhraseMatch(normalizedMessage, normalizedPhrase);
    }));

  if (!match) return null;
  return {
    id: match.id,
    name: match.name,
    actionType: match.action_type === "highlight" ? "highlight" : "navigate",
    targetPath: match.target_path,
    targetElementId: match.target_element_id,
    responseText: match.response_text,
  } satisfies ResolvedGuideAgentRule;
}
