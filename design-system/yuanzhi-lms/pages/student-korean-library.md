# Korean resource library

- Route: `/[space]/apps/korean/library`
- Audience: Student
- Archetype: Course catalog / collection
- Primary job: 搜索、筛选、收藏并获取当前韩语应用范围内的已发布学习资料。
- Primary action: 打开链接或下载所选资料。
- Information hierarchy: Student shell H1 → read-error notice when needed → resource search and category/favorite filters → resource results → privacy and access note.
- Layout and density: Desktop standard density; labeled search and wrapping filters above a responsive resource-card grid.
- Special components: Korean app course scoping, library browser, favorite form, download links, semantic resource icons and route loading.
- Allowed deviations: Student-facing summary is omitted; staff preview may show curation metrics and a management link without changing the student collection.
- Accessibility risks: Search without a programmatic name, favorite icon button state not announced, external links not identified, filter state exposed only by color and file-query errors appearing as empty search results.
- Acceptance criteria: Page content starts at H2; resources are scoped to Korean courses; search and filters have accessible state; favorite controls expose name, pending and selected meaning; external resources are identified; loading, empty and error states are distinct; page-level colors use semantic tokens only.
