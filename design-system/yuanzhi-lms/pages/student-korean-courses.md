# Korean course catalog

- Route: `/[space]/apps/korean/courses`
- Audience: Student
- Archetype: Course catalog
- Primary job: 发现、筛选并进入适合当前进度的韩语课程。
- Primary action: 开始、继续或复习所选课程。
- Information hierarchy: Student shell H1 → catalog orientation and summary → category navigation → search/status filters → categorized course results.
- Layout and density: Desktop comfortable density; fluid content up to 1500px; result cards reflow from one to three columns while filters remain keyboard reachable.
- Special components: `StudentPageHeader`, route loading skeleton, Korean course catalog browser, labeled search input, pressed-state filters, progress indicators and course links.
- Allowed deviations: A compact summary may precede search because it helps students understand catalog scope; progress appears within result cards but does not replace the catalog task.
- Accessibility risks: Duplicating the shell H1, nested main landmarks, unlabeled filters, progress conveyed only by color, filtered results not announced and read failures appearing as empty results.
- Acceptance criteria: Page content starts at H2; search and status controls have accessible names and visible focus; status includes text; filtered counts are announced politely; loading, empty and error states are distinct; permission is enforced by the Korean student app layout; no `--app-*` tokens or page-level color system are used.
