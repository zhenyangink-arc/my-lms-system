# Korean grades

- Route: `/[space]/apps/korean/grades`
- Audience: Student
- Archetype: Progress and records
- Primary job: 回顾老师作业和正式考试的结果、趋势、能力证据与复核状态。
- Primary action: 查看一条原始成绩记录；对符合条件的成绩可发起复核。
- Information hierarchy: Student shell H1 → page H2 and category selector → summary metrics → six-dimension evidence → structured grade records → interpretation note.
- Layout and density: Desktop standard density; full-width summary and record list with readable evidence panels; category selection persists in URL and local storage.
- Special components: Shared `Button`, six-dimension radar with textual evidence, progressbar semantics, localized timestamps, review form and focusable quick links.
- Allowed deviations: Chapter-test results remain in their chapter context and are not duplicated in this top-level collection.
- Accessibility risks: URL/history state and visible category diverging, charts without text alternatives, score meaning conveyed only by color, review controls losing focus and shell/page duplicate H1 elements.
- Acceptance criteria: Page content starts at H2; category buttons expose `aria-pressed`; URL back/forward restores category; radar provides textual evidence or an empty explanation; score bars expose value semantics; error and empty states are distinct; all controls use shared interaction primitives.
