# Management learning application modules

- Route / pattern: `/[space]/dashboard/admin/apps`, `/[space]/dashboard/admin/apps/[appSlug]`, and `/[space]/dashboard/admin/apps/[appSlug]/[section]`
- Navigation parent: Management sidebar → 应用中心 → learning application workspace
- Audience and role: Management staff with application assignment plus the capability required by the destination
- Status: Application center is Conditional; workspace is Deep; modules are Secondary
- Archetype: Application catalog (Collection), module hub, module collections (Collection ×4), and application settings (Form editor ×1)
- Primary job: Enter one authorized learning application, review data isolated to that application and tenant, then manage students, content, assessments, analytics/records/tools, or availability without crossing application boundaries.
- Primary action: Open an application/module from the catalog or hub; within a collection, perform the highest-value capability-allowed operation; within settings, save the institution-specific availability configuration.
- Entry paths: Global management sidebar → 应用中心; direct deep links matching the canonical pattern; module cards in the application workspace.
- Back / exit path: Every module frame exposes a keyboard-reachable “返回[应用名称]” link; the workspace exposes “返回应用中心”. Persistent sibling-module navigation is intentionally not added while `NAV-006` remains deferred.
- State preservation: Deep module query state is owned by each route adapter/child collection. The shared frame preserves canonical route boundaries but does not invent cross-module filter persistence.
- Loading / empty / error / permission states: The dynamic `[appSlug]` route supplies `loading.tsx`; owned catalog/workspace metric failures render warning notices; people and assessment collections distinguish failed reads from valid empty results; invalid sections return not found; missing section capability redirects to the authorized application workspace. Child collection state remains governed by the child component named below.
- Keyboard and focus risks: Module and return links require visible focus and transition feedback. Row-level people forms require explicit accessible names. Sort controls, batch selection, and filter focus are child-collection responsibilities and must not be inferred from the shared frame.
- Desktop width and zoom risks: Standard/compact management density within the shared management container. Wide tables scroll inside their own overflow viewport; cards reflow from one to multiple columns. No page-level horizontal scrolling is allowed.
- Shared components used: `ManagementPage`, `ManagementNotice`, `ManagementMetricStrip`, `RouteLinkStatus`, application access helpers, and the section-specific child collections described below.
- Raw styles or local design-system risks: Owned files use semantic management tokens and contain no raw hex/RGB or `--app-*` references. Imported legacy collection components may still contain page-local raw colors and incomplete table controls; those remain outside this packet.
- Acceptance criteria: Exactly one H1 from `ManagementPage`; accessible named module/return links with visible focus; decorative icons hidden; capability checks execute server-side for every section; tenant and application identifiers constrain data reads; valid empty and failed reads are distinguishable; people controls are named; settings retain visible labels, field-adjacent errors, pending state, and success/error feedback; no owned raw colors or legacy application tokens.
- Review status: Approved with documented out-of-scope collection-control follow-up

## Shared-template coverage

Korean, English, Math, and University all use these same implementations through the `appSlug` parameter. Per `NAVIGATION-AUDIT.md` §6.3, the full template audit recorded here therefore covers all four learning applications; no per-application page duplication is required. Runtime access resolves the application identity, title, accent, availability, assignment, tenant scope, and capabilities before rendering any workspace or section.

## Composition by owned implementation

| Owned implementation | Route role / archetype | Required composition and verified behavior |
|---|---|---|
| `ManagementApplicationCatalogPage.tsx` | `/admin/apps`; application catalog / Collection | One `ManagementPage` header → error-aware application metrics → named application cards → explicit no-permission empty state. Each card is a keyboard link to an isolated application workspace. This file is the application center, not the `/content` module. |
| `ManagementApplicationWorkspacePage.tsx` | `/admin/apps/[appSlug]`; module hub | One application header with return link → error-aware application metrics → capability-filtered module card grid. Authorized cards expose explicit accessible names; unavailable cards remain non-interactive and include visible permission text rather than color-only meaning. |
| `ManagementApplicationPeoplePage.tsx` | `/students`; Collection 1 | Error notice → membership metrics → optional employee-permission table → student authorization/teacher-assignment table. Row forms have named selects/actions, explicit empty/error text, and application/tenant hidden scope fields. Search/filter/sort migration requires the out-of-scope route adapter and a client table boundary. |
| Content route through `ManagementApplicationSectionPage.tsx` | `/content`; Collection 2 | Shared page frame and capability guard wrap the imported course catalog. The route adapter forwards application ID and selection query state to the child catalog. Toolbar, tree selection, collection states, and any sorting belong to that imported component. |
| `ManagementApplicationAssessmentPage.tsx` | `/assessments`; Collection 3 | Error notice → assessment metrics → standard-paper, institution-assignment, and chapter-test tables. Each table has a caption and distinct error/empty copy; assignment detail links have visible focus. The current database order is fixed, not user-presented sorting, so no misleading `aria-sort` is applied. Interactive sorting/filtering requires the out-of-scope route adapter/client table boundary. |
| Generic routes through `ManagementApplicationSectionPage.tsx` | `/textbooks`, `/grades`, `/records`, `/toolbox`, `/conversation`; Collection 4 | One shared `ManagementPage` header and return link wrap the section child. The frame maps `manageContent`, `viewAnalytics`, or `manageAssessments` before rendering and passes application identity to the route-selected child. Search/filter/toolbar, table sorting, batch actions, and child loading/empty/error UI remain responsibilities of those imported collections. |
| `ManagementApplicationSettingsPage.tsx` | `/settings`; Form editor ×1 | One shared page header → grouped, persistently labeled institution fields → availability explanation → submit action → data-retention context. The form disables repeat submission, announces pending/success/error results, and places recognized title/status errors beside their fields. The server action repeats tenant, application, `manageStudents`, and `manageTenantAvailability` checks. |

## Capability and isolation map

| Section | Server capability | Isolation evidence |
|---|---|---|
| `students` | `manageStudents` | Section guard plus tenant ID and app ID on enrollment/staff/teacher-assignment reads and mutations. |
| `content`, `textbooks`, `toolbox` | `manageContent` | Section guard; application ID is forwarded to each content collection. |
| `assessments`, `conversation` | `manageAssessments` | Section guard; assessment queries filter `student_app_id`, tenant assignments additionally filter `tenant_id`; conversation receives application ID. |
| `grades`, `records` | `viewAnalytics` | Section guard; application ID is forwarded to analytics/record services. |
| `settings` | `manageTenantAvailability` | Section guard plus mutation-time tenant/application access check and explicit `manageTenantAvailability` verification. |

## Known boundaries

- `NAV-006` is unchanged: sibling module navigation remains deferred. Existing return paths are complete and keyboard reachable.
- The `/students`, `/assessments`, and several imported generic collections do not yet expose the full target search/filter/sort/batch toolbar. Adding URL-backed query state requires changes to their route adapters and/or imported client table components, which are outside the six-file ownership boundary. Static database ordering is not announced as interactive sorting.
- Imported grade and learning-record listings contain raw amber utility colors in their error notices (`grade-listing.tsx` and `learning-record-listing.tsx`). They are found-but-out-of-scope and should converge on `ManagementNotice` in their owning batch.
- Imported conversation progress and other child tables render fixed, non-interactive columns without `aria-sort`; any collection-wide sorting control must be implemented in those owning components rather than the shared section frame.
