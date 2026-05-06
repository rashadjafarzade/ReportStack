# ReportStack branding rollout — handoff brief

This file is a baton-pass for Claude Code (run `claude` in the repo root) to
continue the brand rollout that Cowork started.

## Status

The logo and the first wave of UI changes are committed on `main`:

- `992b616` Add ReportStack logo: replace CRA placeholders with new mark
- `981207a` Apply ReportStack brand to UI: tokens + key surfaces

Run `git show 981207a --stat` to see exactly which files moved.

## Brand tokens (source of truth)

Defined in `frontend/src/styles/design-tokens.css`:

| Token                  | Value      | Use                                        |
|------------------------|------------|--------------------------------------------|
| `--color-primary`      | `#1e40af`  | Default CTA, links, breadcrumb, active nav |
| `--color-primary-hover`| `#1e3a8a`  | Hover state for primary                    |
| `--color-primary-active`| `#3b82f6` | Bright accent (sidebar stripe, focus ring) |
| `--color-primary-soft` | `#eff6ff`  | Hover row tints, badge backgrounds         |
| `--color-primary-light`| `#dbeafe`  | Soft surfaces, subtle borders              |
| `--gradient-brand`     | linear `#1e40af → #0b2e7c` | Logo tile, login top stripe |
| `--gradient-brand-soft`| linear `#eff6ff → #dbeafe` | Reserved for hero/empty states |

The semantic colors (`--color-passed`, `--color-failed`, etc.) and the dark
sidebar tokens are unchanged.

## What's already styled

- `frontend/src/App.tsx` sidebar logo block uses an inline 3-bar SVG inside
  a 36×36 brand-gradient tile. The active `.sidebar-link` gets a 3px bright
  blue stripe via a `::before` and a soft-tinted background.
- `frontend/src/pages/Login.tsx` imports `../logo.svg` (horizontal lockup)
  and renders it at 44px tall.
- `frontend/src/styles/extras.css` adds the radial-gradient login backdrop
  and a 3px brand-gradient stripe across the top of `.login-card`.
- `frontend/src/styles/components.css`: `.metric-card:hover`, `.btn-primary`
  hover shadow, `.page-title` letter-spacing, `.metric-card-icon.brand` variant.

## What's been completed (Wave 2 + Dark mode)

All items below were completed in the May 2026 CLI session:

1. **Dashboards.tsx** — Duration chart line color updated to brand `#1e40af`.
2. **Trends.tsx** — Duration chart line color updated to brand `#1e40af`.
3. **LaunchDetail.tsx** — Total tests metric card uses `var(--color-primary, #1e40af)`.
4. **extras.css** — `.ai-pill`, `.btn-ai`, `.attachment-thumb`, `.pm-role-admin`, focus rings all migrated to brand tokens. Full `[data-theme="dark"]` overrides added for login, cards, tables, inputs, code blocks, profile, API key rows, etc.
5. **components.css** — `.empty-state-icon` uses `--color-primary-soft` bg + `--color-primary` text.
6. **Dark mode** — Full implementation: `ThemeContext.tsx` provider, `design-tokens.css` dark token block, Profile page wired theme selector (light/dark/system), `matchMedia` system preference detection.

## Workflow completed

All branding wave 2 items and dark mode were implemented directly on `main` in a single session. No further branding work is queued.

## Quick reference

- Visual preview of the current state: `outputs/branding-preview.html` or
  the PNG snapshot beside it.
- Logo source files: `frontend/src/logo.svg` (horizontal lockup) and
  `frontend/public/{favicon.ico,logo192.png,logo512.png}` (PWA icons).
- The bot and backend were not touched.
