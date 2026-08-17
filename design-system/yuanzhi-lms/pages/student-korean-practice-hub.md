# Korean practice hub

- Route: `/[space]/apps/korean/practice`
- Audience: Student
- Archetype: Course catalog / hub navigation
- Primary job: 恢复学生上次使用的巩固分区，并保持课程巩固、专项训练、错题复习三个入口清晰可达。
- Primary action: 进入上次使用的巩固分区；无有效记忆时进入课程巩固。
- Information hierarchy: Student shell H1 → three-item secondary navigation → section introduction → selected practice collection.
- Layout and density: Desktop comfortable density; full-width secondary navigation within the Student shell content bound; the landing route itself is a short redirect state.
- Special components: `PracticeMemoryRedirect`, `PracticeHubNavigation`, `PracticeSectionIntro` and `StudentRouteLoading`.
- Allowed deviations: The landing route may render only an announced loading state while replacing the URL; storage failure must fall back deterministically rather than exposing a separate error page.
- Accessibility risks: Redirect loops, an unannounced loading state, active tabs exposed only by color, keyboard focus lost after replacement and invalid local-storage data selecting a nonexistent section.
- Acceptance criteria: Exactly three secondary entries are present; the selected entry exposes `aria-current`; all entries have visible focus; loading exposes `role=status` and `aria-busy`; invalid or unavailable storage falls back to course practice; app-level permission remains enforced before the redirect component renders.
