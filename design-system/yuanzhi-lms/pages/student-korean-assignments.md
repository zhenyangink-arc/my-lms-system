# Korean learning task collection

- Route: `/[space]/apps/korean/assignments`
- Audience: Student
- Archetype: Progress and records / collection
- Primary job: 按优先级回顾待完成、需修改、待批改和已完成的章节测试、老师作业与考试。
- Primary action: 打开当前最需要处理且已解锁的学习任务。
- Information hierarchy: Student shell H1 → read-error notice when needed → task type/status controls → optional search/course filters → chapter-test route and teacher task records → empty result recovery.
- Layout and density: Desktop standard density; compact filter controls above structured task rows; timeline is limited to ordered chapter tests.
- Special components: `AssignmentBoard`, shared `Card` and `Input`, pressed-state filters, deadline/status labels, locked-task study link and route-level loading.
- Allowed deviations: Summary metrics are staff-preview-only; student collection prioritizes filters and records rather than duplicating a promotional overview.
- Accessibility risks: H1-to-H3 heading skips, small filter targets, status conveyed only by color, disabled-looking locked rows remaining interactive, truncated titles without a full-name path and partial query failures appearing complete.
- Acceptance criteria: No page-content H1; section headings follow the shell H1 without level skips; filters expose pressed state and labels; locked tasks are not actionable except for the explicit study route; error and empty states are distinct; clearing filters is keyboard operable; all data sources contribute to the read-error state.
