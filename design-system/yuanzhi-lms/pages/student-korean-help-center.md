# Korean help center

- Route: `/[space]/apps/korean/help`
- Audience: Student
- Archetype: Progress and records / support collection
- Primary job: 搜索自助帮助、提交求助并回顾自己的工单状态。
- Primary action: 先展开匹配的帮助文章；没有答案时提交求助。
- Information hierarchy: Student shell H1 → searchable help article collection → help request form → personal ticket records → empty/error feedback.
- Layout and density: Desktop standard density; full-width article collection followed by a two-column form and record layout at wide widths.
- Special components: Help article browser, native details/summary answers, labeled ticket form, shared form submission state, localized ticket timestamps and ticket deep links.
- Allowed deviations: Staff preview may show content metrics and a management link; students retain the article-first support path and personal records only.
- Accessibility risks: Search/category controls without state, details summaries lacking focus, form errors not announced or associated, pending submission allowing duplicates, urgent status relying on color and ticket links lacking focus indication.
- Acceptance criteria: Content headings begin at H2 and remain sequential; search, filters and form fields have persistent labels or accessible names; submission exposes pending and result feedback; ticket links have visible focus; urgent and workflow states include text; loading, empty and error states are distinct; only the current student's tickets are queried.
