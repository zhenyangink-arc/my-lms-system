# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/yuanzhi-lms/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** Yuanzhi LMS
**Generated:** 2026-08-16
**Category:** LMS (Learning Management System) — desktop Web app; mobile adaptation is outside the current review scope
**Direction:** macOS-inspired minimalism — restrained, neutral, one accent color, hairline borders, glass reserved for chrome only

---

## Active visual architecture

The legacy five-theme switcher and its `data-app-theme` / `app-dashboard-theme`
runtime were removed on 2026-08-17. Do not restore them or treat their former
theme names as active design modes.

The active hierarchy is:

```text
PUFFY neutral baseline
├── Tenant portal and non-workspace pages: fixed neutral light tokens
├── Student applications: Student OS (`data-student-shell="system"`)
│   └── auto / morning / afternoon / night background modes
└── Management workspace: Management Apple (`data-management-workspace`)
```

Student OS background modes belong to one student design system; they are not
global themes. Management light/dark behavior is also independent from the
removed student theme switcher.

---

## Global Rules

### Neutral baseline color palette (`:root` in `globals.css`)

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Canvas background | `#ffffff` | `--app-bg` |
| Sidebar background | `#ffffff` | `--app-sidebar-bg` |
| Card background | `#ffffff` | `--app-card-bg` |
| Soft/muted surface | `#f7f7f8` | `--app-soft-bg` |
| Border | `#dadade` | `--app-border` |
| Border (soft) | `#e8e8eb` | `--app-border-soft` |
| Text (primary) | `#1d1d1f` | `--app-text` (this is Apple's own system-label gray, not pure black) |
| Text (soft) | `#3a3a3c` | `--app-text-soft` |
| Muted text | `#6e6e73` | `--app-muted` |
| Muted text (light) | `#8e8e93` | `--app-muted-light` |
| Input background | `#f7f7f8` | `--app-input-bg` |
| **Accent (primary action)** | `#1d1d1f` (near-black, not a bright brand color) | `--app-accent` |
| Accent — strong | `#000000` | `--app-accent-strong` |
| Accent — soft fill | `#eeeeef` | `--app-accent-soft` |
| Accent — on-accent text | `#ffffff` | `--app-accent-contrast` |
| Secondary (champagne gold) | `#9a6700` | `--app-secondary` |
| Secondary — soft fill | `#fff4ce` | `--app-secondary-soft` |
| Success | `#248a3d` | `--app-success` |
| Success — soft fill | `#e7f6eb` | `--app-success-soft` |
| Warm/warning | `#c66a00` | `--app-warm` |
| Warm — soft fill | `#fff1de` | `--app-warm-soft` |
| Hero gradient start | `#ffffff` | `--app-hero-start` |
| Hero gradient end | `#fff9ea` | `--app-hero-end` |
| Card shadow | `0 18px 48px rgba(154, 103, 0, 0.1)` | `--app-shadow` |
| Destructive | `#DC2626` | `--app-danger` |

**Palette philosophy (this is the point of "macOS style," not decoration):**
- The *accent* color is near-black, not a saturated brand hue — primary buttons and active states read as "the system," not "an ad." Saturated color (gold/success/warm) is reserved for **semantic meaning only** (in-progress, success, warning) — this directly fixes the "color semantics inconsistent" problem flagged in the page-review checklist ([[page-review-checklist]]), where `--app-warm` currently means different things on different pages.
- Backgrounds stay white-on-white with very light gray surfaces (`#f7f7f8`) for separation — never a tinted/colored page background.

### Typography

Use the **system font stack** — do not import a Google Font pairing for this direction. macOS renders San Francisco natively; a web font import would fight it and add a load waterfall the "Performance" section of `ui-ux-pro-max` explicitly warns against (`font-loading`, `font-preload`).

```css
font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC",
  "Helvetica Neue", "Segoe UI", Roboto, sans-serif;
```

| Token | Size | Weight | Usage |
|---|---|---|---|
| `--text-title` | 28-34px | 700 (bold) | Page-level H1 |
| `--text-heading` | 20-22px | 700 (bold) | Section H2 |
| `--text-subheading` | 15-16px | 600 (semibold) | Card titles, H3 |
| `--text-body` | 15-16px | 400 (regular) | Body copy — **never below 13px** |
| `--text-label` | 12-13px | 500 (medium) | Badges, metadata, timestamps |

This directly addresses the "font weight has no hierarchy, everything is `font-black`" finding from the page reviews — macOS type hierarchy comes from **size + a 3-step weight scale (regular/semibold/bold)**, not uniform maximum boldness everywhere.

### Spacing Variables

*Density: Standard — dashboards can go one notch denser, marketing/empty-states one notch looser.*

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` | Tight gaps (icon-to-label) |
| `--space-sm` | `8px` | Inline spacing, chip gaps |
| `--space-md` | `16px` | Standard padding |
| `--space-lg` | `24px` | Section padding |
| `--space-xl` | `32px` | Large gaps between sections |
| `--space-2xl` | `48px` | Section margins |
| `--space-3xl` | `64px` | Hero/page-top padding |

### Corner Radius — deliberately smaller than what's currently in the codebase

macOS controls use restrained, consistent corner radii — not the `rounded-[2rem]` → `rounded-3xl` → `rounded-2xl` stacking found across the reviewed pages (records, grades, courses). Standardize to **two levels only**:

| Token | Value | Usage |
|---|---|---|
| `--radius-control` | `8px` | Buttons, inputs, chips, small icon tiles |
| `--radius-surface` | `12px` | Cards, panels, modals |

Do not introduce a third radius level. If a component currently uses 16px/24px/32px rounding, flatten it to one of the two tokens above.

### Shadow Depths — flatter and more diffuse than typical Tailwind defaults

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.04)` | Hairline lift (list rows, inline controls) |
| `--shadow-md` | `0 4px 16px rgba(0,0,0,0.06)` | Cards |
| `--shadow-lg` | `0 12px 32px rgba(0,0,0,0.08)` | Popovers, dropdowns |
| `--shadow-xl` | `0 18px 48px rgba(154,103,0,0.10)` | Modals — matches the neutral baseline `--app-shadow` |

Border does more work than shadow in this direction: prefer a 1px `--app-border` hairline over a heavy shadow wherever a component just needs separation from its neighbor (list rows, table cells, sidebar items).

---

## Component Specs

### Buttons

```css
.btn-primary {
  background: var(--app-accent);       /* #1d1d1f — near-black, not brand color */
  color: var(--app-accent-contrast);   /* #ffffff */
  padding: 10px 20px;
  border-radius: var(--radius-control); /* 8px */
  font-weight: 600;
  font-size: 15px;
  transition: opacity 150ms ease, transform 150ms ease;
  cursor: pointer;
}
.btn-primary:hover { opacity: 0.85; }
.btn-primary:active { transform: scale(0.98); }

.btn-secondary {
  background: var(--app-soft-bg);
  color: var(--app-text);
  border: 1px solid var(--app-border);
  padding: 10px 20px;
  border-radius: var(--radius-control);
  font-weight: 600;
  font-size: 15px;
  transition: background-color 150ms ease;
  cursor: pointer;
}
.btn-secondary:hover { background: var(--app-border-soft); }
```

### Cards

```css
.card {
  background: var(--app-card-bg);   /* #ffffff — flat, not tinted */
  border: 1px solid var(--app-border-soft);
  border-radius: var(--radius-surface); /* 12px */
  padding: var(--space-lg);
  box-shadow: var(--shadow-md);
  transition: box-shadow 150ms ease;
}
.card:hover { box-shadow: var(--shadow-lg); }
/* No translateY hover-lift — macOS cards don't float on hover, only shadow deepens */
```

### Inputs

```css
.input {
  background: var(--app-input-bg);
  padding: 10px 14px;
  border: 1px solid var(--app-border);
  border-radius: var(--radius-control);
  font-size: 15px;
  transition: border-color 150ms ease, box-shadow 150ms ease;
}
.input:focus {
  border-color: var(--app-accent);
  outline: none;
  box-shadow: 0 0 0 3px rgba(29, 29, 31, 0.12);
}
```

### Glass / blur — reserved for navigation chrome only, never content

Apple's own **Liquid Glass** material (per `ui-ux-pro-max` style search, `--domain style "macOS native desktop"` → result `liquid-glass`) is explicitly scoped to *"navigation, controls, and system-aligned app chrome"* — not content surfaces. Apply this constraint on the web too:

```css
.chrome-glass {
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(20px) saturate(160%);
  -webkit-backdrop-filter: blur(20px) saturate(160%);
  border-bottom: 1px solid var(--app-border-soft);
}
```

- ✅ Use on: top bars, sticky sidebars, floating toolbars (this already exists partially in `student-system-*` classes used by the home page — extend that pattern, don't invent a second one).
- ❌ Do not use on: content cards, course cards, table rows — those stay flat `--app-card-bg` per the Cards spec above. Glass-everywhere reads as inconsistent, not premium.
- Always provide a `prefers-reduced-transparency`-safe fallback (opaque `--app-card-bg`) — the skill's own checklist requires testing "reduced transparency" for this material.

---

## Page Pattern Guidance (Dashboard, not Marketing)

This project is an authenticated LMS dashboard, not a marketing/landing page — ignore the generic "Hero + Features + CTA" pattern the search tool defaults to for unspecified queries. Use instead:

- **Section order:** Page title (small, not a hero) → primary content (table/grid/chart) → secondary panels → footer note.
- **One primary action per screen** (per `ui-ux-pro-max` `primary-action` rule) — e.g. "继续学习" on the home page, not multiple equally-weighted CTAs competing.
- Avoid the "hero gradient card at the very top, flat everywhere below" pattern found on the courses page — if a gradient/hero treatment is used, echo a lighter version of it at each section header instead of only once at the top.

---

## Motion

Keep motion **subtle and utilitarian** — this is a dashboard, not a showcase site.

```js
gsap.from('.grid-item', {
  opacity: 0, y: 8, duration: 0.25,
  stagger: { each: 0.04, from: 'start' },
  ease: 'power2.out'
});
```

- Duration: 150-300ms for UI feedback, up to 400ms for section entrances — never the `back.out` bounce/overshoot easing (reads as playful, wrong register for a dashboard).
- Respect `prefers-reduced-motion`: render the final state immediately, no exceptions.
- Hover feedback: opacity/shadow changes only — avoid `translateY`/`scale` hover-lifts on cards (see Cards spec above); reserve `scale: 0.98` for the *press* state on buttons only.

---

## Anti-Patterns (Do NOT Use)

- ❌ Mixed corner radii on nested cards (`rounded-[2rem]` containing `rounded-3xl` containing `rounded-2xl`/`rounded-xl`) — flatten to the two-token radius scale above.
- ❌ Saturated/branded color as the primary accent — keep `--app-accent` near-neutral; save color for semantic states only.
- ❌ `font-black` used uniformly on every text element regardless of hierarchy — use the 3-step weight scale.
- ❌ Glass/blur applied to content cards — reserve for chrome (nav/sidebar/toolbar) only.
- ❌ Hover states that translate/scale cards — shadow/opacity changes only, to avoid layout jitter.
- ❌ Emojis as icons — use SVG icons (Lucide, already the icon set in use across this codebase).
- ❌ Missing `cursor-pointer` on clickable elements.
- ❌ Instant state changes with no transition (use 150-300ms).
- ❌ Invisible focus states — focus rings must stay visible for keyboard nav.

---

## Pre-Delivery Checklist

- [ ] Colors pulled from `--app-*` tokens (this file's palette), not new hardcoded hex values
- [ ] Corner radius uses only `--radius-control` (8px) or `--radius-surface` (12px) — no third level
- [ ] Text weight follows the 3-step scale (regular/semibold/bold), not uniform bold
- [ ] Glass/blur only on chrome (nav/toolbar), never on content cards
- [ ] No emojis used as icons (Lucide SVG only)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states use opacity/shadow, not translate/scale, on cards
- [ ] Light mode text contrast ≥4.5:1 (verify `--app-muted` #6e6e73 against `--app-bg` #ffffff — passes; verify custom combinations individually)
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Desktop widths verified at 1024px, 1280px, 1440px, and 1920px
- [ ] Browser zoom verified at 100%, 125%, 150%, and 200%

---

## See also

- [[page_review_checklist]] — the 7-point checklist this project's page reviews follow; item 5 (recurring visual defects) and item 7 (UI/UX suggestions) both reference this Master file as the ground truth for "what macOS-direction correct looks like."
- `.agents/skills/ui-ux-pro-max/` — the local design-intelligence dataset this file's non-color/typography sections (spacing rhythm, motion tokens, anti-pattern checklist) were sourced from. Re-run targeted `--domain` searches for anything not covered here rather than guessing.
