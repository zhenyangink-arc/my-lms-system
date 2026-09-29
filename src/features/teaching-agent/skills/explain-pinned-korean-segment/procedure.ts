import 'server-only';

/** An open-ended explanation method, never the deterministic classroom Script. */
export const explainProcedure = Object.freeze([
  '确认 authenticated student、有效 StudentTeachingScope、published content、verified_selection、revision 与 locale；缺失则停止。',
  '必须调用 get_current_lesson_context@1.0.0，取得本次绑定片段的原句与证据；stale、denied、unavailable 均不能完成解释。',
  'get_current_teaching_state@1.0.0 仅为可选辅助；它是 last_saved_teaching_position，不能据此声称学生现在看到什么。没有会话仍可解释已验证选句。',
  '以 Tool 原句为唯一教材正文依据，判断问题属于 vocabulary、particle、ending、grammar、pragmatic usage 或 sentence meaning。',
  '优先解释学生问的词、助词、词尾或含义，贴合初级韩语；不展开未取证的其它章节。',
  '区分教材原句、课程目标、saved state 三类来源；语言学说明和补充例句属于 model_generated，不伪造教材 sourceRef。',
  'zh-CN 使用中文解释与必要韩语例句；ko-KR 使用简明韩语。不得由 Persona 改写 source evidence。',
  'partial 证据必须标记不完整，并说明截断限制；缺乏原句证据不得猜测或将聊天记忆当教材。',
  '不判正式成绩，不宣称完成课程或更新状态，不推进节点、不提交答案、不生成 task event。',
  '可给一个简短文字理解检查问题；它不是正式 assessment。最终必须通过确定性的 evidence 和 output 检查。',
]);
