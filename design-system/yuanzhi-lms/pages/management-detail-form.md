# Management detail and form pages

- Route: Management object detail, create and edit routes
- Audience: Management
- Archetype: Detail / inspector or Form editor
- Primary job: 理解当前对象、修改结构化信息并安全保存。
- Primary action: Save changes; destructive actions remain visually and spatially separate.
- Information hierarchy: Standard page header and identity → grouped fields/sections → validation and contextual history → save actions.
- Layout and density: Desktop standard density; readable form measure; related fields grouped without card nesting for decoration.
- Special components: `ManagementPage`/`ManagementPageHeader`, shared form controls, field-level errors, error summary, confirmation dialog and audit history.
- Allowed deviations: A split inspector is allowed for read-heavy detail pages; long editors may use sticky save actions if they do not obscure focus.
- Accessibility risks: Placeholder-only labels, read-only and disabled states looking identical, errors shown only in a toast, unsaved changes dismissed silently.
- Acceptance criteria: Persistent labels; field errors linked with `aria-describedby`; multi-error submission focuses a linked summary; unsaved dismissal is confirmed; save feedback is perceptible; destructive actions require confirmation or provide undo.

