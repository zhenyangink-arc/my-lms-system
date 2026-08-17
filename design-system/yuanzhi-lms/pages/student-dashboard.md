# Student dashboard

- Route: `/dashboard` and tenant-scoped student dashboard equivalents
- Audience: Student
- Archetype: Learning overview
- Primary job: 让学生立即看见下一步学习任务并继续学习。
- Primary action: 继续最近课程或开始最紧急的待办。
- Information hierarchy: Continue learning → due tasks → current courses → progress and recent feedback → secondary resources.
- Layout and density: Desktop comfortable density; one main content column with supporting summary regions; maximum readable content width follows the Student shell.
- Special components: Student OS chrome, task alerts, course cards, progress summaries, reminder dialog.
- Allowed deviations: Lightweight overview summaries may use Student dashboard glass; course content, long text, forms and structured records remain opaque.
- Accessibility risks: Background imagery reducing contrast, several equally prominent actions, notices conveyed only by color, keyboard focus hidden by the fixed shell.
- Acceptance criteria: One obvious primary action; morning/afternoon/night do not change action or status semantics; content surfaces remain readable at 1024–1920px and 100–200% zoom; reduced-transparency mode removes blur without losing hierarchy.

