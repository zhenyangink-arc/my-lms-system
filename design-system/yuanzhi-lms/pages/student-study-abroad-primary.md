# Study-abroad primary

- Route: `/[space]/apps/study-abroad`, `/[space]/apps/study-abroad/universities`, `/[space]/apps/study-abroad/documents`, `/[space]/apps/study-abroad/visa`
- Audience: Student
- Archetype: Learning overview (service home); Course catalog / collection (target universities); Progress and records / collection (application materials); Progress and records (visa case tracking)
- Primary job: Make the next study-abroad service step clear, then let students manage target schools, application materials, and visa work without crossing into the Korean-learning domain.
- Primary action: Home — manage target universities; Universities — enter the relevant target, library, or comparison workspace; Documents — open the selected application checklist; Visa — open the active visa case and complete its next task.
- Information hierarchy: Student shell H1 → page H2 → next step or summary → due/actionable work → current services or structured records → progress and supporting resources. The service home uses next step → due-task guidance → current services → secondary learning resources; documents and visa put state and progress before detailed records.
- Layout and density: Desktop comfortable density with a fluid content width up to 1500px. Home and collection cards reflow without horizontal page scrolling; the university filter rail may become sticky at desktop widths; records use stable opaque or high-opacity content surfaces.
- Special components: `StudentApplicationHome`, `UniversityLibrary`, `DashboardTitleWithHint`, university search and pressed-state filters, comparison slots, accessible progress bars, `ApplicationDocumentChecklist`, `ApplicationStageTimeline`, `CourierInfoCard`, `CollapsibleVisaCaseCard`, and visa workspace forms.
- Allowed deviations: The universities primary route is an orientation collection that links to target, library, and comparison workspaces; the shared `UniversityLibrary` browser is audited here at component level, while its deep route wrapper remains governed by the future deep-page packet. The home does not invent aggregate deadlines or progress data that the current data contract does not expose; it points students to the authoritative materials and visa states instead.
- Accessibility risks: Duplicate shell headings; promotional hero patterns; several competing primary actions; search without a persistent label; filters without pressed or expanded state; database errors rendered as valid empty states; status or progress represented by color alone; decorative icons exposed to assistive technology; missing focus indicators; sticky filters obscuring focus; and excluded child forms retaining local focus, icon, error-announcement, or raw-style debt.
- Acceptance criteria: Page content starts at H2 beneath the shell H1; the service home has one visually primary action and no marketing/testimonial composition; search is labeled and result counts are announced; filters expose pressed/expanded state; loading, empty, error, and permission states remain distinct; status includes text and progress exposes an accessible value; owned interactive controls have visible keyboard focus; owned decorative icons are hidden; route loading is supplied by the study-abroad app boundary; route permission is enforced by the student app layout; no owned page uses raw hex/RGB(A) values or the removed `--app-*` namespace.

## Per-page notes

### Service home

Next-step orientation precedes due-task guidance. Target universities is the single primary CTA; application materials and visa are current services, and courses are a subordinate learning resource. No marketing hero, testimonial, feature-grid claim, or fabricated progress total is allowed.

### Target universities

The primary route summarizes targets, published universities, and comparison selection, then shows recent target progress with explicit empty and data-error states. The shared library browser provides a persistent search label, expandable filter groups, pressed filter states, polite result counts, a distinct no-data state, and card actions whose status is conveyed in text.

### Application materials

The list view separates unreadable data from a legitimate absence of application forms. Each application exposes text labels for lock, stage, counts, deadline, and completion. The selected checklist view exposes an accessible completion value and suppresses a misleading empty checklist when its query fails.

### Visa preparation

The list view distinguishes a locked/unavailable workflow from query failure. The case view presents case status, notification text, permission messaging, task status labels, and accessible progress before detailed task actions. The horizontal stage tracker may scroll inside its own region rather than forcing page-level horizontal scrolling.
