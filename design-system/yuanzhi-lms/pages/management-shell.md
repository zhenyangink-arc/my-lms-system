# Management shell

- Route: `/[space]/dashboard/admin/*` and `/platform/dashboard/admin/*`
- Audience: Management
- Archetype: Neutral operations workspace shell
- Primary job: Keep authorized global management navigation, current location and account access consistently reachable around each management task.
- Primary action: The primary action belongs to the rendered management page; shell controls remain secondary navigation and workspace utilities.
- Information hierarchy: Skip link → global sidebar navigation → workspace topbar and breadcrumbs → one page-level header → page toolbar/content → account access.
- Layout and density: Desktop standard/compact density; collapsible fixed sidebar plus a fluid, shrinkable main inset; governed page content may grow to the 1500px maximum while tables manage their own horizontal overflow.
- Special components: Collapsible role-filtered sidebar, active-route state, mobile dialog retained but out of this desktop audit, sticky management topbar, breadcrumbs, skip link and focusable main region.
- Allowed deviations: Platform and tenant workspaces may change labels and authorized entries; application modules may add contextual secondary navigation after NAV-006 is approved, but must not duplicate the global sidebar or page header.
- Accessibility risks: Collapsed navigation losing accessible names, focus outlines clipped by the floating sidebar, visual-only active state, sticky topbar obscuring focus, and shell/page compositions producing duplicate H1 elements.
- Acceptance criteria: Global entries follow the documented visual and DOM order after role filtering; current navigation exposes `aria-current`; every icon-only shell control has an accessible name; focus indicators remain visible inside floating chrome; the skip link reaches the focusable main region; each rendered page supplies exactly one H1 through the standard page skeleton; content remains fluid and usable from 1024px to 1920px without a single fixed canvas.
