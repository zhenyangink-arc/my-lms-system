# Management collection pages

- Route: Management list routes such as accounts, tenants, schools, courses, records, grades and audit history
- Audience: Management
- Archetype: Collection
- Primary job: 搜索、筛选、比较并批量处理结构化业务数据。
- Primary action: Create/import when permitted; otherwise the highest-value collection action.
- Information hierarchy: Standard page header → search and filters → decision-useful summary → data table → pagination/audit note.
- Layout and density: Desktop compact/standard density; width up to the management 1500px container; wide tables scroll horizontally inside their own table container only.
- Special components: `ManagementPage`/`ManagementPageHeader`, shared `Button`, `Input`, `DataTable`, sortable `TableHead`, view options and pagination.
- Allowed deviations: KPI strip may be omitted when it does not affect a decision; inspector may use a right-side panel when it preserves the collection state.
- Accessibility risks: Sort state not announced, row actions visible only on hover, filters without labels, focus lost after data refresh, status represented only by color.
- Acceptance criteria: Exactly one H1; sortable columns expose `aria-sort`; every icon action has a name; loading/empty/error/retry states exist; dates and numbers are localized; primary and bulk actions are clearly separated.

