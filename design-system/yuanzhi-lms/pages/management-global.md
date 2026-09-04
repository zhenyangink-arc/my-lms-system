# Management global pages

- Route: `/[space]/dashboard/admin`, `/platform/dashboard/admin`, and the global management destinations `/apps`, `/announcements`, `/help`, `/agents`, `/token-usage`, `/accounts`, `/tenants`, `/permissions`, `/library`
- Audience: Management
- Archetype: Operations overview for the management home; Collection for the remaining global destinations
- Primary job: Surface permission-scoped operational work on the home page, then let staff search, filter, compare, and act on one global management collection at a time.
- Primary action: Resolve the highest-priority visible queue on the home page; use the permission-appropriate create, upload, or collection action on collection pages.
- Information hierarchy: Operations overview uses header → decision-useful KPI summary → actionable queues and institution exceptions → common workspaces → scope note. Collections target header → search/filter/view settings → decision-useful summary → main table/workspace → pagination or scope note.
- Layout and density: Neutral Operations Workspace at standard/compact desktop density, up to the shared 1500px management container. Wide tables may scroll inside their own table viewport; page-level horizontal scrolling is not allowed.
- Special components: `ManagementPage`, `ManagementPageHeader`, `ManagementMetricStrip`, `ManagementNotice`, shared `DataTable`, and the application-section `ManagementPage` frame. The management home currently uses a dedicated legacy home shell; the embedded platform application overview inherits `ManagementPage` from its application workspace or section frame and must not add another page header.
- Allowed deviations: The operations overview may omit search/filter controls because it is a queue-and-summary workspace rather than a collection. KPI strips may be omitted when they do not change a decision. Permission Center may use multiple labeled workspaces after its summary. Platform Help may replace ticket/article workspaces with an institution-level overview. The embedded application overview may use a static summary table without interactive sorting when row order is not presented as user-controlled.
- Accessibility risks: A custom home shell can drift from the canonical page header; filters implemented inside child tables can appear after a page-level KPI strip; sortable table state may not reach `aria-sort`; decorative icons can be announced; query failures can be mistaken for valid empty data; status color can be used without text.
- Acceptance criteria: Exactly one H1 per destination; every standalone global collection reaches `ManagementPage`; embedded application summaries inherit one parent `ManagementPage`; authorized empty and error states remain distinguishable; unauthorized users are rejected or redirected by server-side access guards; sortable controls are keyboard operable and expose `aria-sort`; icon-only controls have accessible names; decorative icons are hidden; no page-owned raw hex, `rgb()`/`rgba()`, or `--app-*` tokens remain.

## Per-page composition

| Destination | Owned page shell | Composition and significant deviation |
|---|---|---|
| 管理首页 | `src/app/dashboard/admin/page-content.tsx` | Operations overview. Uses a dedicated `management-home` shell with one H1, live permission-scoped KPIs, work queues, institution attention, common workspaces, explicit empty states, and a data-sync status action. It does not yet use `ManagementPage`; migration depends on the shared `management-home-*` stylesheet and belongs with the broader management-shell convergence. |
| 应用中心 / platform application overview | `src/app/dashboard/admin/apps/ManagementPlatformApplicationOverviewPage.tsx` | Embedded collection summary. The parent application workspace/section owns the `ManagementPage` header. This component adds privacy context, error notice, decision-useful metrics, an institution summary table, and an error-aware empty row; it must not add an H1. |
| 通知公告管理 | `src/app/dashboard/admin/announcements/page-content.tsx` | Thin route adapter to `AnnouncementListing`, which owns `ManagementPage`, scope metadata, page actions, error notice, summary, announcement table, and the platform-only institution inspection. |
| 帮助中心管理 | `src/app/dashboard/admin/help/page-content.tsx` | Thin route adapter to `HelpCenterListing`. Platform scope uses an institution overview; tenant scope uses ticket and article collections. Both branches own exactly one `ManagementPage`. |
| 模型用量 | `src/app/dashboard/admin/token-usage/page-content.tsx` | Thin route adapter to a `ManagementPage` collection with scope metadata, query-error notice, filters/view settings in the table, and usage rows. |
| 账号管理 | `src/app/dashboard/admin/accounts/page-content.tsx` | Thin route adapter to a server-filtered `ManagementPage` collection. Creation and audit actions vary by platform/tenant role. |
| 租户管理 | `src/app/dashboard/admin/tenants/page-content.tsx` | Thin route adapter to a `ManagementPage` collection with lifecycle/schema notices, metrics, filters, and institution table. |
| 权限中心 | `src/app/dashboard/admin/permissions/page-content.tsx` | Thin route adapter to a `ManagementPage` governance workspace with query-string feedback, directory/matrix/grant controls, active grants, and audit records. |
| Agent 运营中心 | `src/app/dashboard/admin/agents/page-content.tsx` | Platform-owner-only operations workspace with runtime metrics, stored conversations, structured local navigation rules, model configuration and immutable audit history. |
| 资料库管理 | `src/app/dashboard/admin/library/page-content.tsx` | Thin route adapter to a `ManagementPage` collection with read-only notice when curation is unavailable, summary, filters, and resource table. |

## Access and state contract

- Sidebar visibility follows `NAVIGATION-AUDIT.md` §6.1–§6.2; every data service repeats the relevant server-side access check rather than trusting navigation visibility.
- A valid empty collection renders an explicit empty message. A failed read renders a warning/danger notice or the shared route error boundary; it must not be represented only as zero metrics or an ordinary empty collection.
- Page-shell loading is supplied by the route/server rendering boundary. Child dialogs, forms, row actions, table internals, and their mutation states are governed by the Management deep-page batch and do not define a second page shell here.

## Known migration boundary

- The management home is the only standalone owned destination that does not converge on `ManagementPage`. Its header, container, and responsive behavior are coupled to `src/app/dashboard/management-apple.css`; migrating only the TSX would regress the approved shell styling. Treat this as found-but-needs-broader-migration, not an approved page-level deviation.
- Several collection toolbars are implemented inside child table components, so their current runtime order is header → KPI → toolbar/table rather than the target header → toolbar → KPI → table. Correcting that requires a shared table/listing composition change outside this packet.
