# System states

- Route: Cross-cutting App Router boundaries (`loading.tsx`, `error.tsx`, and `not-found.tsx`)
- Audience: Student | Management
- Archetype: Shared loading, error, and not-found system states
- Primary job: Confirm that navigation is progressing, explain when rendering or routing fails, and give every user a reliable way to recover.
- Primary action: Loading has no action; error states retry the failed boundary; not-found states return to a valid route.
- Information hierarchy: State label or loading announcement → concise explanation → primary recovery action → safe-location link when applicable.
- Layout and density: Loading skeletons preserve the approximate content density and responsive width of the destination shell; error and not-found messages use a compact, centered reading measure.
- Special components: App Router Suspense fallbacks, route error boundaries, semantic loading status regions, decorative skeleton blocks, retry controls, and safe-location links.
- Allowed deviations: Student and Management skeletons may reflect their shell density and surface treatment; route-specific skeleton geometry may vary when the destination structure is stable and known.
- Accessibility risks: Unannounced loading, continuous pulse or shimmer under reduced-motion preferences, decorative placeholders entering the accessibility tree, vague errors, and recovery links that return users to the same failing segment.
- Acceptance criteria: Loading states expose one polite busy status, keep visual placeholders decorative, use semantic color tokens, and disable pulse or shimmer under `prefers-reduced-motion`; errors clearly describe the failure and provide a working retry plus a safe-location path where the shell is unavailable; not-found states explain that the resource is missing and link to a valid location; decorative icons are `aria-hidden`; no boundary uses legacy `--app-*` tokens or raw hex/RGB color values.
