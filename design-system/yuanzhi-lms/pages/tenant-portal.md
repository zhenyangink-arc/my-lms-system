# Tenant portal

- Route: `/[space]`
- Audience: Student
- Archetype: Learning overview / application launcher
- Primary job: 选择已开通的学习或服务应用，并在有最近学习记录时继续学习。
- Primary action: 继续最近的韩语课程；没有最近课程时，进入首个可用应用。
- Information hierarchy: Tenant portal topbar and account access → greeting and continuation action → recent-learning summary → authorized application catalog.
- Layout and density: Desktop comfortable density; fluid full-width canvas with adaptive gutters and a `max-w-7xl` content bound; application cards reflow from one to three columns without assuming a fixed canvas.
- Special components: Fixed portal topbar, application catalog cards, recent-course progress, guide-agent trigger, account menu, profile dialog and settings dialog.
- Allowed deviations: The neutral portal may use restrained translucent navigation and overview surfaces; profile and settings dialogs may use wider task-appropriate bounds while remaining viewport-constrained.
- Accessibility risks: Fixed topbar obscuring keyboard focus, account popover focus restoration, disabled application cards appearing interactive, progress conveyed only visually, and long tenant or account names compressing primary navigation.
- Acceptance criteria: Exactly one H1; a visible skip path reaches the focusable main region; header and application controls follow visual tab order; every icon-only control has an accessible name; account dialogs restore focus on close; application status includes text; all active cards and primary actions have visible focus; content remains usable from 1024px to 1920px without a fixed-width canvas.
