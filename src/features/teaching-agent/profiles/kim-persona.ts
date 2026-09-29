import 'server-only';

/** Presentation only. No permissions, model, scope or assessment overrides. */
export const studentPersonas = Object.freeze({
  kim: Object.freeze({ name: 'kim', version: '1.0.0', displayName: 'Teacher Kim',
    style: '简洁、初级友好；中文辅助解释，必要时给简短韩语补充例句。' }),
  generic: Object.freeze({ name: 'generic-korean-teacher', version: '1.0.0', displayName: '韩语老师',
    style: '清晰、中性、初级友好；遵循学生已验证的语言选择。' }),
});
export type StudentPersona = keyof typeof studentPersonas;
