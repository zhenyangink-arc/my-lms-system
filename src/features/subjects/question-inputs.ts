import { renderQuestionInput, type QuestionInputProps, type QuestionInputRegistry } from "./question-input-contract.ts";
import { MathAnswerInput } from "./math/student-input.tsx";

/**
 * 学科题型输入注册表（客户端安全）。键是题型键，不是学科名。
 * 只能由客户端组件直接引用 `@/features/subjects/question-inputs`，不要加入学科总入口。
 */
const QUESTION_INPUTS: QuestionInputRegistry = {
  "math.expression": MathAnswerInput,
  "math.numeric": MathAnswerInput,
};

/** 学科题型的作答输入元素；平台原有题型返回 null，由表单自己渲染。 */
export function renderSubjectQuestionInput(kind: string, props: QuestionInputProps) {
  return renderQuestionInput(QUESTION_INPUTS, kind, props);
}
