# Locked UI/UX standard for Module 2 and Module 3

## Absolute rules

1. `@pci/ui` is the single reusable design library. Future Module 3 should **import that package**, not copy colors, form styles, or page-level CSS.
2. Only `packages/ui/src/styles.css` aggregates stylesheet imports.
3. All brand decisions live in `packages/ui/src/styles/tokens.css`.
4. `base.css` defines global typography and focus styles; `layout.css` owns shell/navigation/grids; `components.css` owns tables/cards/buttons/forms/wall patterns; `responsive.css` owns breakpoints.
5. No `style={...}`, `<style>`, CSS modules, styled-components, Tailwind utility class sprawl, or new independently maintained page styles.
6. Shared components are exported from `packages/ui/src/index.tsx`. Module-specific views compose these components without changing their visual tokens.
7. Accessibility: real labels, keyboard focus, semantics, readable contrast, descriptive errors and reduced-motion handling.
8. Any new UI element must have one **named semantic CSS class**, not ad-hoc inline properties.
9. Visual changes must be made at the design-system layer once, not separately in public/admin applications.
10. Test enforcement: `tests/structure.test.mjs` rejects inline styles, raw HTML injection and duplicate CSS imports.

## Visual language

- Brand: evergreen-teal + midnight navy, muted gold highlight, soft light surfaces.
- System fonts: no externally hosted font scripts.
- Main container: `--max: 1220px` with responsive fluid gutter.
- Card radius: `--r-lg`; form radius: `--r-sm`; spacing: `--s1` through `--s8`.
- Shared elements: `Card`, `MetricCard`, `Badge`, `Notice`, `EmptyState`, `SectionHeading`, `PageHeading`, `Avatar`.
- Reusable classes: `.btn`, `.data-table`, `.filters`, `.field`, `.table-wrap`, `.page-head`, `.grid-*`, `.metric-grid`.
- For future admin panel, extend `layout.css` with one admin shell and `components.css` with needed admin controls. Keep the token system unchanged.

## Using the same package in Module 3

Keep the entire `packages/ui` directory as the single source in a monorepo, or publish it as a versioned private package when the public and admin projects move into separate repositories. Never duplicate the CSS source into the admin repository.

Module 3 app entry point should import `@pci/ui/styles.css` once, then use `@pci/ui` React primitives.
