# Korean announcements

- Route: `/[space]/apps/korean/announcements`
- Audience: Student
- Archetype: Progress and records / collection
- Primary job: 按优先级回顾平台和本机构已经发布的通知。
- Primary action: 阅读当前置顶或高优先级公告。
- Information hierarchy: Student shell H1 → collection summary → read-error notice when needed → pinned/priority-ordered announcement records → empty state.
- Layout and density: Desktop comfortable density; single readable announcement column within the Student shell content bound.
- Special components: Announcement read tracker, localized publish time, textual source/category/priority labels and route loading.
- Allowed deviations: Staff preview may show management access and summary context; student view remains a read-only collection without extra actions.
- Accessibility risks: Priority conveyed only by color, decorative icons repeated by screen readers, tenant-name lookup failures hidden, long announcement text losing readable measure and multiple article titles using the wrong heading level.
- Acceptance criteria: Announcement titles are H2 under the shell H1; source, category and priority are written as text; decorative icons are hidden; both announcement and tenant-name query failures produce an alert with recovery guidance; empty and error states are not conflated; no hardcoded page palette remains.
