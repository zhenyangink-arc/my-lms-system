# Korean course detail

- Route / pattern: `/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]`
- Route:
  `/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]`
- Navigation parent: `/dashboard/courses/[categorySlug]/[subcategorySlug]`; the canonical Korean learning-center view redirects Korean and service courses to `/dashboard/courses/[categorySlug]#course-[courseSlug]`.
- Audience and role: Student; platform course auditors and non-student staff may bypass the learning sequence for review.
- Audience: Student
- Status: Deep compatibility detail; Korean canonical navigation uses the learning-center course anchor.
- Archetype: Course catalog — learning-detail sub-view, not Lesson workspace.
- Primary job: Understand course context, progress, availability, and choose the next lesson.
- Primary action: Start, continue, or review an unlocked lesson.
- Entry paths: Course/stage catalog, saved deep links, and previous navigation state.
- Back / exit path: Keyboard-reachable links to stage, category, and My Courses.
- State preservation: Route links preserve the server-backed lesson progress; Korean canonical returns use stable course/stage anchors.
- Loading / empty / error / permission states: `src/app/dashboard/loading.tsx` supplies route loading feedback; `src/app/dashboard/error.tsx` supplies retry recovery; missing hierarchy records use `notFound()`; query failures throw to the error boundary; an empty published lesson list has explicit copy; locked courses redirect to their stage and locked lessons expose their reason in the list.
- Information hierarchy: Context navigation → course identity and progress → optional learning path → lesson list and actions.
- Layout and density: Comfortable student density; bounded 1500px shell for focus categories; descriptions remain at readable line length; cards are opaque.
- Special components: `HangulLessonLaunchLink`, semantic progress bars, course and lesson status badges.
- Shared components used: `app-card`, `app-empty-state`, `HangulLessonLaunchLink`, Lucide icons, Next.js `Link`.
- Raw styles or local design-system risks: Audited shell contains no raw hex/rgba values and no `--app-*` tokens. Dynamic accent choices resolve to shared semantic tokens.
- Allowed deviations: Korean and service course details may redirect to the canonical learning-center course anchor instead of presenting a duplicate detail page.
- Accessibility risks: Dynamic lock text must remain understandable without color; breadcrumb order and focus visibility must remain stable at zoom; progress bars require adjacent text values.
- Keyboard and focus risks: All context and lesson links remain native links with visible focus indicators; no action depends on hover.
- Desktop width and zoom risks: Verify long course/lesson titles, 200% zoom, and the 1500px focus-category layout without horizontal page scrolling.
- Acceptance criteria: Back paths are operable by keyboard; query failures are not presented as 404/empty content; empty and locked states explain recovery; course text uses opaque surfaces and semantic tokens; each lesson exposes status, progress, and one clear action.
- Review status: In review — Batch 3 changes complete, 2026-08-17.

# Korean lesson runner

- Route / pattern: `/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]`
- Route:
  `/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]`
- Navigation parent: Course directory or canonical Korean learning-center course anchor.
- Audience and role: Student; platform course auditors receive read-only/tracking-disabled behavior.
- Audience: Student
- Status: Deep
- Archetype: Lesson workspace.
- Primary job: Read, watch, and interact with lesson content, then complete or continue the learning sequence.
- Primary action: Complete the current learning step and advance to the next lesson or chapter test.
- Entry paths: Course lesson list, previous/next lesson links, and chapter deep links using `?chapter=`.
- Back / exit path: Persistent back-to-course action in generic, reader, flipbook, and smart-textbook shells; locked content also links to the prerequisite and full course route.
- State preservation: Server-backed lesson, chapter, and ebook progress are retained; chapter deep links preserve the requested chapter; local reader notes remain browser-local by design.
- Loading / empty / error / permission states: Dashboard loading/error boundaries cover the dynamic route; missing hierarchy records use `notFound()`; primary lesson/resource/navigation failures throw to the recovery boundary; locked sequence, membership preview, missing smart-textbook deployment, empty smart-textbook modules, unavailable media/resources, and first/last lesson boundaries all have explicit states.
- Information hierarchy: Context navigation → lesson title/status → lesson content → learning completion and previous/next actions.
- Layout and density: Comfortable, content-first workspace. Generic prose is limited to about 75 characters and uses 1.7 line height. Flipbook pages use bounded opaque paper surfaces; the smart textbook main reading surface is opaque. Glass/blur is limited to navigation chrome, popovers, modal scrims, and tool panels.
- Special components: `LessonVideoPlayer`, `LessonCollapsibleCard`, `LessonProgressStatusCard`, `LessonSupportSheet`, `KoreanLevelOneSmartTextbook`, reusable `KoreanLevelOneBookTemplate`, `KoreanLevelOneReader`, `KoreanLevelOneGuideBook`, `HangulBookOpening`, `VowelsConsonantsBook`, `BatchimReadingBook`, and `PronunciationRulesBook`.
- Shared components used: `app-card`, `app-soft-card`, `app-flat-row`, `app-empty-state`, Next.js `Link`, Lucide icons, and native form controls where the learning interaction requires them.
- Raw styles or local design-system risks: The runner shell and all eight named template files contain no raw hex/rgba values and no `--app-*` legacy tokens. Palette roles resolve through shared semantic tokens. Full interaction spot-checks covered the smart textbook, reusable Korean level-one book template, and pronunciation-rules flipbook; the Reader/Guide and the three other Hangul flipbooks received cross-template heading, token, and focus-boundary checks.
- Allowed deviations: Fixed-size ebook spreads may scale as a single reading canvas inside the runner; they may not make critical navigation pointer-only. Toolbars, popovers, and modal scrims may use blur; lesson prose and ebook paper may not.
- Accessibility risks: Fixed ebook scale at 200% zoom, focus containment in mobile panels/dialogs, speech controls when browser speech APIs are unavailable, and announcement of async activity feedback.
- Keyboard and focus risks: Previous/next controls, table-of-contents entries, reveal/speech controls, smart activities, settings, and mobile panels are native controls with visible focus. Icon-only controls have accessible names; Lucide hides undecorated icons by default. Smart free-response fields have explicit accessible labels and reorder buttons name their affected option.
- Desktop width and zoom risks: Verify ebook controls remain on-screen at 1024px and 200% zoom, smart-textbook side panels do not obscure focused controls, and generic prose avoids unintended double scrolling.
- Acceptance criteria: Context exit is always available; content surfaces are opaque; shell H2 is followed by template H3+ headings without skipped levels; all learning controls are keyboard operable with visible focus; empty/error/permission states provide a recovery path; prose remains readable; no raw palette or legacy app tokens remain in the audited files.
- Review status: In review — Batch 3 changes complete, 2026-08-17.
