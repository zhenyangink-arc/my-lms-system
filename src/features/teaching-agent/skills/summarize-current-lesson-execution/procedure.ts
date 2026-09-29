import 'server-only';
export const executionSummaryProcedure = [
 'Verify the server-issued subject, tenant, lesson/version and Activity snapshot context.',
 'Select get_current_lesson_execution_facts@1.0.0 with strict empty input; no facts come from memory or user claims.',
 'Require a fresh executor-owned receipt for this Skill and context; failed reads invalidate earlier evidence.',
 'Project only validated safe Tool facts; do not infer current position from source or execution nodes.',
 'Fail closed on missing evidence. Never submit answers, modify progress, or fall back to another source.',
] as const;
