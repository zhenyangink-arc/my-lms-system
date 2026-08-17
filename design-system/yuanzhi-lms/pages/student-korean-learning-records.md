# Korean learning records

- Route: `/[space]/apps/korean/records`
- Audience: Student
- Archetype: Progress and records
- Primary job: 回顾学习时长、完成事件、练习活动和老师反馈，并找到下一步。
- Primary action: 筛选到需要回顾的记录；有老师建议时优先查看反馈。
- Information hierarchy: Student shell H1 → page H2 and yearly summary → activity metrics → error/teacher recommendation → learning calendar → record filters → grouped records → explanatory note.
- Layout and density: Desktop standard density; summary cards and calendar precede a two-column record grid; date groups remain collapsible and keyboard operable.
- Special components: Shared `Button`, learning activity panel, pressed-state category controls, native details/summary groups, localized dates and event deep links.
- Allowed deviations: Summary and insight precede the record list because they directly support retrospective understanding; the page may show a teacher recommendation before filters.
- Accessibility risks: Calendar dates not keyboard operable, filter state not announced, collapsed groups hiding focus, status represented only by color and partial data failures appearing as a valid empty range.
- Acceptance criteria: Page content starts at H2; summary values use text and tabular figures; filters expose pressed state and accessible counts; details summaries have visible focus; errors use alert semantics and suppress misleading empty states; date and range filters can be cleared with the keyboard.
