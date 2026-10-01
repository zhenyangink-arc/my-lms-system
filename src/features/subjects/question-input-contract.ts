import { createElement, type ComponentType, type ReactElement } from "react";

/**
 * 学科题型的学生作答输入。平台作答表单遇到学科题型时按题型键取对应组件，
 * 不为某个学科写分支；没有注册的题型沿用平台原有的输入。
 * 本文件与 question-inputs.ts 只含客户端安全的代码（学生作答表单是客户端组件）。
 */
export type QuestionInputProps = {
  /** 表单字段名（平台约定：answer_<题目ID>），组件必须原样用作 input 的 name。 */
  name: string;
  /** 已保存的上次作答（草稿或上次提交），用作初始值。 */
  previousAnswer?: string;
  /** 题型键，如 math.expression。 */
  kind: string;
};

export type QuestionInputRegistry = Readonly<Record<string, ComponentType<QuestionInputProps>>>;

export function resolveQuestionInput(
  registry: QuestionInputRegistry,
  kind: string,
): ComponentType<QuestionInputProps> | null {
  return Object.prototype.hasOwnProperty.call(registry, kind) ? registry[kind] : null;
}

/** 取题型输入并创建元素；没有注册时返回 null。调用方只持有元素，不在渲染中创建组件类型。 */
export function renderQuestionInput(
  registry: QuestionInputRegistry,
  kind: string,
  props: QuestionInputProps,
): ReactElement | null {
  const Component = resolveQuestionInput(registry, kind);
  return Component ? createElement(Component, props) : null;
}
