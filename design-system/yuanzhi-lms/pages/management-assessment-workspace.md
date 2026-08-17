# Management assessment workspace

- Route: `/dashboard/admin/assignments/chapter-tests`, `/dashboard/admin/assignments/homework`, `/dashboard/admin/assignments/exam`, and the matching embedded workspaces under `/dashboard/admin/assignments`
- Audience: Management
- Archetype: Assessment workspace / Form editor
- Primary job: Maintain chapter-test composition, create platform homework or exam papers, and publish complete papers to institution students without changing the underlying assessment rules.
- Primary action: Platform paper managers compose a standard paper; institution assignment managers select a published paper and release it to students.
- Information hierarchy: Shell H1 and workspace navigation → workspace summary and counts → recoverable read state → primary assessment workspace → publication history or supporting actions.
- Layout and density: Wide neutral operations workspace, maximum width `1500px`, compact tables, stable solid content surfaces, and horizontal overflow only where the assessment matrix cannot reflow safely.
- Special components: Curriculum-channel disclosure groups, chapter-test question viewer and random picker, standard-paper composer, paper question drawer, institution release catalog, duration editor, and status actions.
- Allowed deviations: Chapter-test rows preserve curriculum hierarchy instead of offering arbitrary column sorting. Paper and release lists preserve their database-backed newest-first order. Homework and exam share one composition because their structure and permissions are the same; labels, defaults, and `paperType`-scoped data are the only route-specific differences.
- Accessibility risks: Nested dialogs and drawers need focus return and an escape path; all composer fields need visible labels and field-adjacent errors; destructive status transitions need confirmation; disclosure controls and all publish/status actions need visible focus; status, correctness, and difficulty need text in addition to color; query failures must never collapse into legitimate empty states.
- Acceptance criteria: Exactly one shell-provided H1 with continuous H2/H3 structure; decorative icons are hidden and icon-only controls are named; all interactive controls are keyboard reachable with visible focus; loading, empty, error, and permission outcomes are distinct; fixed table ordering is described in captions and is not presented as interactive sorting; status and difficulty remain understandable without color; destructive actions confirm before submission; forms retain visible labels and local error recovery; no page-level raw hex, `rgb`/`rgba`, or legacy `--app-*` custom properties.

## Chapter-test composition

The chapter-test workspace is a curriculum matrix rather than a freely sortable collection. Course channels, courses, lessons, and chapters retain the canonical curriculum order so that changing a column sort cannot separate a test from its instructional context. Channel and course disclosures are native keyboard-operable controls. A failed curriculum or question query replaces the matrix with an explicit alert; a successful query with no rows shows the legitimate empty state.

Platform managers can inspect questions, change duration, or open the random picker from each chapter row. Published, draft, and archived states always include visible text. Difficulty totals are presented as labeled numeric values rather than color-only indicators.

## Homework and exam paper-type composition

Homework and exam are not different enough to require separate page contracts. Both use the same platform-paper table and institution release flow, with route-specific nouns, data filters, and default duration/resubmission values supplied by `paperType`.

For platform managers, the standard-paper list is newest-first and exposes composition, status, version, update time, and row actions. The composer is unavailable when its question-bank query fails, while existing papers remain inspectable. For institution managers, the release catalog and publication history are shown only when paper, course, student, and assignment data load successfully; a failed read produces a specific alert instead of a zero-count or empty-table message.

Authorization is enforced before the workspace renders: users without assessment-workspace permission are redirected by the shared access guard. Route-level loading UI belongs to the route boundary rather than these async server workspace components.
