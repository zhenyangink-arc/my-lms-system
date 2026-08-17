# Korean conversation practice collection

- Route: `/[space]/apps/korean/conversation-practice`
- Audience: Student
- Archetype: Course catalog
- Primary job: 选择开放的会话场景并继续口语练习。
- Primary action: 打开一个会话场景开始或继续练习。
- Information hierarchy: Student shell H1 → practice summary → AI/course supporting routes → error notice when needed → scenario results.
- Layout and density: Desktop comfortable density; two supporting navigation cards followed by a responsive scenario grid up to three columns.
- Special components: Permission redirect, route loading skeleton, semantic status metrics, focusable scenario cards and text-labeled difficulty/progress states.
- Allowed deviations: The list has no free-text search while the published scenario set remains small; AI experience and course routes remain secondary to scenario selection.
- Accessibility risks: Scenario titles skipping from H1 to H3, card links without visible focus, decorative icons announced repeatedly, progress conveyed only by color and permission redirects without a valid recovery destination.
- Acceptance criteria: Scenario titles are H2; every card link has visible focus; decorative icons are hidden; difficulty and progress have text labels; loading, empty and error states are distinct; unauthorized tiers are redirected according to feature policy.
