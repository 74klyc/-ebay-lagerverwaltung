# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - 2026-03-26

### Added
- **Industrial UI Theme**: Complete overhaul of the interface with a dark, brushed-metal aesthetic, neon-blue highlights, and complex bevel effects. Integrated closely with shadcn/ui components (`Card`, `Button`, `Input`, `Textarea`, `Table`, `Tabs`, `Dialog`, `Select`, `Checkbox`, `DropdownMenu`).
- **Mobile Responsiveness**: Enforced a stricter mobile grid structure. `Sidebar` is now flawlessly integrated into a sweepable `Sheet` in mobile view. Re-spaced `TopBar` and main layouts (`AppLayout`) limiting them with `overflow-x-hidden` to avoid breaking out of small screens. Refactored titles and buttons in `InventoryListPage` and `ListingsPage` to stack securely on mobile.
- **Client-Side Data Aggregation for Finances/Taxes**: The tax overviews (`TaxOverviewPage` & `EuerPage`) now compute the Einnahme-Überschuss-Rechnung directly from standard `sales` and `expenses` tables on the frontend, fully omitting the need for often complex or error-prone Supabase views.

### Changed
- Extensive translation of previously English templates and Shadcn defaults entirely into German interface language.
- Replaced the Supabase-Sync-Status UI icon with clean status text within the Footer area.
- Empty states of `DashboardPage` are now actively showing messages instead of static hardcoded demonstration items.

### Fixed
- Fixed 404/Syntax errors pointing to an outdated `manifest.webmanifest`.
- Fixed `DialogTitle` missing accessibility warning in `Sheet` component for mobile sidebars.
- Purged an issue where a lingering `@vite-plugin-pwa` Service Worker tried picking up an undefined PWA entrypoint by forcefully unregistering old navigator Service Workers.
- Addressed Supabase `406 (Not Acceptable)` and `400 (Bad Request)` responses caused by unavailable specific `v_yearly...` PostgreSQL views.
