# Centralized shared UI standard

ONE source: `../Module_2_Public_Website/packages/ui/src/styles.css`.

- `tokens.css`: palette, fonts, dimensions, spacing, elevation.
- `base.css`: global type/reset/form defaults.
- `layout.css`: public website shells and grid.
- `components.css`: buttons, cards, tables, notices, forms, badges.
- `responsive.css`: public breakpoints.
- `admin.css`: administrative sidebar, header, forms, tables, responsive settings using the same tokens.
- `index.tsx`: shareable React components (`Card`, `Notice`, `MetricCard`, etc.).

Both applications import the **same** `@pci/ui/styles.css` entry point. This design avoids duplicate copies that drift apart.

Rules for future development: no `<style>` blocks; no `style={{...}}`; no CSS modules in pages; no individual page stylesheets; no Tailwind utility layers alongside centralized CSS. Add class names in the single UI package, then consume the named classes in either app. Adjust global branding in `tokens.css` only. Next.js page layouts may contain semantic JSX but cannot define visual constants independently.
