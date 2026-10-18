# CLAUDE.md

Operational guide for Claude sessions working on this repo. Read this before touching code.

## Stack

- **Astro 7** static site generator, `output: 'static'`, 5 pages. Needs Node >=22.12; `.nvmrc` is 22 and all three workflows read it.
- **React 18** islands for interactive components, hydrated via Astro `client:*` directives.
- **Tailwind v4** via `@tailwindcss/vite`. Color/font tokens live in `src/styles/tokens.css`; the `@theme` block in `global.css` is a thin bridge that references those tokens via `var()`.
- **TypeScript 5.7**, strict via `astro/tsconfigs/strict`. Content collections typed with Zod schemas in `src/content.config.ts`. Direct YAML imports shimmed in `src/types/yaml.d.ts` and cast at the import site.
- **Vitest 5** for unit tests.
- **Prettier** with `prettier-plugin-astro`. Run `npm run format`. CI gates on `npm run format:check`.

## Key paths

- `src/layouts/Base.astro` — single source of layout chrome (Cosmos, AccentOrb, Meteor, TopNav inside `<header>`, Footer, the one `<main>`). Owns the `<html>` `data-accent` attribute.
- `src/pages/*.astro` — five route entries: `/`, `/about`, `/projects`, `/experience`, `/starmap`. Pages emit `<div class="page">` (or `<div class="starmap-page">`) — never `<main>`.
- `src/components/island/*.tsx` — interactive React components. Always require a hydration directive in the page that uses them.
- `src/components/static/*.astro` — server-only components (TopNav, Footer, OrreryBackdrop).
- `src/lib/orrery.ts` — build-time layout for the orrery (`/` and `/projects`). `src/lib/getOrrery.ts` loads the collections and runs it once per build.
- `src/lib/starmap.ts` — build-time layout for the starmap (`/starmap`), from `src/content/starmap.yaml`.
- `scripts/sync-starmap.ts` — regenerates `starmap.yaml` from Outline (`npm run sync:starmap`).
- `src/styles/tokens.css` — palette + type + spacing tokens. **Source of truth.**
- `src/styles/global.css` — Tailwind import + `@theme` bridge + base resets.
- `src/styles/portfolio.css` — barrel re-export for **global-only** CSS (`legacy-resets`, `cosmos`, `hero`, `sections`).
- `src/styles/portfolio/*.css` — global cross-cutting CSS: `cosmos`, `hero`, `sections`, `legacy-resets`.
- `src/components/island/*.module.css` — co-located CSS Modules for React islands. Import as `import s from './X.module.css'` and access via `s.camelCase`.
- `src/styles/pages.css` — sub-page (`/about`, `/projects`, `/experience`) wrapper rules + shared utilities (`.tag`, `.cta-secondary`).
- `src/styles/page-bg.css` — per-route accent washes + per-route cosmos tint variables, and the starmap's paper backdrop.
- `src/content.config.ts` — Zod schemas and `file()` loaders for content collections.
- `src/types/yaml.d.ts` — `*.yaml` module shim (`unknown`, cast at import site).
- `design-handoff/` — original prototype (gitignored).

## Hard rules — DO NOT VIOLATE

1. **One `<main>` per page.** `Base.astro` owns `<main id="main-content">`. Pages emit `<div class="page">`, never `<main class="page">`. Nested `<main>` is invalid HTML and breaks the skip-link.

2. **`<html data-accent="...">` is the single source of truth for accent.** Set by `<Base accent="...">`. CSS selectors key from `html[data-accent]`, not from the page wrapper. Do not put `data-accent` on the page wrapper.

3. **Cosmos var contract is load-bearing.** `src/styles/portfolio/cosmos.css` exposes three custom properties:

   - `--layer-hue` — `hue-rotate` for colored nebula layers.
   - `--layer-sat-mul` — saturation multiplier for colored layers.
   - `--layer-dim` — opacity multiplier for colored layers ONLY (not the wrap, so the star canvas inside stays bright).

   `page-bg.css` sets these per route via `html[data-accent="..."] .cosmos`. **Never reintroduce `.cosmos { opacity: ... }` on sub-pages — stars vanish.** Never overwrite a layer's `filter` with a raw value — the per-page tint stops working. Compose into the existing `filter` expression.

4. **Sub-page wash opacity is `0.55` by design.** The handoff says `0.85`, but the pulse + AccentOrb stack pushes effective peak too high and text reads "off in color". If a page feels under-accented, increase the orb gradient alphas in `AccentOrb.tsx`, not the wash opacity.

5. **`Meteor.tsx` double-rAF + forced reflow stays.** Under React+Vite the single-rAF pattern collapses the initial+target style flush and the animation never plays. Don't simplify.

6. **The starmap is the one light page.** `<Base theme="light">` drops Cosmos and AccentOrb and sets `html[data-site-theme="light"]`; TopNav, Footer and Meteor carry light overrides keyed on that attribute. Its wrapper is `.starmap-page`, not `.page`, because `.page`'s wash and vignette assume the dark cosmos.

7. **The orrery and starmap layouts run at build time only.** `buildOrrery()` and `buildStarmap()` return rounded coordinates and link paths that `Orrery.tsx` and `Starmap.tsx` render as-is. Don't move the force simulation into the island: it costs hydration time and reintroduces server/client float drift in SVG attributes.

8. **`prefers-reduced-motion` is handled globally** in `global.css`. Don't re-add per-component opt-outs.

9. **Home cosmos drifts continuously**, NOT per-section. Daniel explicitly rejected per-section accent changes on the home — if you want section differentiation, do it via content/spacing, not backdrop palette.

10. **`Cosmos.tsx` scroll-parallax uses individual `translate`/`scale`/`rotate` properties**, not `transform`. Don't merge them — keyframe `transform` would clobber the scroll value.

11. **No `: any` annotations.** `npm run check` is at 0 errors. Type from `CollectionEntry<'name'>['data']` or a local named type; never `as any`.

12. **Below-fold home islands use `client:visible`**, not `client:idle`. Hydration cost on first idle should not be spent on sections the user may never scroll to (`Orrery`, `CareerList`). Above-fold islands stay `client:idle`.

## Component → CSS file map

CSS is split between **CSS Modules** (co-located `.module.css` per React island), **Astro scoped `<style>`** (for `.astro` components), and **global CSS** (cross-cutting systems). Vite is configured with `css.modules.localsConvention: 'camelCase'`.

### CSS Modules (import as `s` or `css`, access via `s.camelCase`)

| Component                               | Module file                    |
| --------------------------------------- | ------------------------------ |
| `Splash.tsx`                            | `island/Splash.module.css`     |
| `Meteor.tsx`                            | `island/Meteor.module.css`     |
| `Orbit.tsx`                             | `island/Orbit.module.css`      |
| `Orrery.tsx`                            | `island/Orrery.module.css`     |
| `CareerList.tsx`                        | `island/CareerList.module.css` |
| `Starmap.tsx`                           | `island/Starmap.module.css`    |
| `MapHud.tsx` (fullscreen for both maps) | `island/MapHud.module.css`     |

### Astro scoped styles (inline `<style>` block)

| Component              | Notes                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| `TopNav.astro`         | All topnav CSS in `<style>` block, JS class toggles work                                   |
| `Footer.astro`         | All footer CSS in `<style>` block, JS class toggles work                                   |
| `OrreryBackdrop.astro` | Rotating dial behind `/projects`; one `<svg>` per ring so rotation stays on the compositor |

### Global CSS (in `src/styles/`)

| Scope                                                | File                          |
| ---------------------------------------------------- | ----------------------------- |
| `Cosmos.tsx`, `AccentOrb.tsx`                        | `portfolio/cosmos.css`        |
| Hero on `/`                                          | `portfolio/hero.css`          |
| `.section`, `.section-head`, `.eyebrow`, `.orbiting` | `portfolio/sections.css`      |
| Old-starfield suppression, animation resets          | `portfolio/legacy-resets.css` |
| `/about`, `/projects`, `/experience` page wrappers   | `pages.css`                   |
| Per-route accent wash + cosmos tint vars             | `page-bg.css`                 |
| `.tag`, `.cta-secondary`, `.cosmic-card` (shared)    | `pages.css`                   |

## Content collections — how to add data

Collections defined in `src/content.config.ts` (type `'data'`, `file()` loaders, Zod schemas, YAML parsed with `js-yaml`):

| Collection        | File                            | Schema fields                                                                           |
| ----------------- | ------------------------------- | --------------------------------------------------------------------------------------- |
| `projects`        | `src/content/projects.yaml`     | id, cluster, name, title, tech, description, date?, href?                               |
| `projectClusters` | `src/content/projects.yaml`     | label, color (keyed by cluster id)                                                      |
| `technologies`    | `src/content/technologies.yaml` | label, tint, techs (keyed by domain id; `techs` maps tech id → label)                   |
| `experience`      | `src/content/experience.yaml`   | id, date, role, org, summary, bullets?, tags, star (`StarType` enum in the config file) |

`projects.yaml` has a `clusters` map (label + color) and a flat `projects` list where each project names its `cluster`. Every tech id in a project's `tech:` list must exist in `technologies.yaml`; `buildOrrery()` throws at build time on an unknown tech or cluster. Domains are laid out left to right in file order.

### Starmap — the Outline wiki

`src/content/starmap.yaml` is generated, never hand-edited. `npm run sync:starmap` reads the **Public** collection in Outline (needs `OUTLINE_API_TOKEN` in `.env`) and writes the page tree: `id` (the Outline slug), `title`, `description`, `links`, `children`, plus `color` on second-level pages. Conventions in Outline that the sync enforces, failing with the page names otherwise:

- Every page opens with a `>` blockquote; that quote is its description.
- Every second-level page (a branch, like Knowledge › Golang) has an icon colour; everything below inherits it.
- Every tip callout (`:::tip`) opens with a bold sentence, and that sentence is a quote; a page can have several. `src/lib/quotes.ts` collects them for the meteors and the hero and footer mottos, each linking to its page on the public share. With no quotes, those three render nothing.

Links point at the collection's public share (`<shareUrl>/doc/<id>`), because plain `/doc/` links need an Outline login. Cross-links to pages outside Public are dropped.

### Wiki manifest — orbiting topics

`src/content/wiki-manifest.json` (types in `src/types/wiki.ts`) now only feeds the home "currently orbiting" chips. Import it as `manifest as WikiManifest`.

To add a new project: append an entry to `projects:` in `src/content/projects.yaml` with its `cluster`, and add any new tech ids to `technologies.yaml`. To add a field: update the schema in `content.config.ts`, then add the field to existing entries (or mark `.optional()` in the schema if not always present).

Type-side: import `CollectionEntry` from `astro:content` and use `CollectionEntry<'projects'>['data']` etc. Don't try to import types from `content.config.ts` — schemas are inline.

Standalone YAML imports (not collections) — `site.yaml`, `about.yaml`, `now.yaml` — go through the `*.yaml` shim. Cast at the import site to a narrow named type:

```ts
import siteRaw from '@/content/site.yaml';
type SiteData = { name: string; title: string; description: string /* ... */ };
const siteData = siteRaw as SiteData;
```

## Workflows

| Command                | What it does                                                     |
| ---------------------- | ---------------------------------------------------------------- |
| `npm run dev`          | Astro dev server on `:4321`.                                     |
| `npm run build`        | Static build to `dist/`.                                         |
| `npm run preview`      | Serve the built `dist/`.                                         |
| `npm run check`        | `astro check` — TypeScript + Astro diagnostics. **Must exit 0.** |
| `npm test`             | Vitest single-run.                                               |
| `npm run test:watch`   | Vitest watch mode.                                               |
| `npm run format`       | Prettier write.                                                  |
| `npm run format:check` | Prettier check (CI gate).                                        |
| `npm run sync:starmap` | Regenerate `starmap.yaml` from Outline's Public collection.      |

## CI & Deployment

Three workflows in `.github/workflows/`, plus Terraform in `infra/`. The repo is `algebananazzzzz/algebananazzzzz.com`; the only other repo named after the account is `algebananazzzzz` (the profile README).

- `1-feature-branch-ci.yml` — runs on PRs to `main`. Gates: `format:check`, `astro check`, `vitest run`, `astro build`.
- `2-preprod-deploy.yml` — runs on push to `main` and on `v*-beta` tags. On a push it auto-tags `vx.x.x-beta`, runs checks, applies Terraform only when `infra/` changed (always on a beta tag), builds with `SITE_URL=https://beta.algebananazzzzz.com`, and deploys to `preprod-web-pages-algebananazzzzz` with `--branch=main`. On success it creates the `vx.x.x` production tag but does not deploy it.
- `3-prd-deploy.yml` — runs on production tags (`v*` without `-`) and on `workflow_dispatch`. Production is deployed by hand: run it via `workflow_dispatch` with the `vx.x.x` tag as the ref (`gh workflow run 3-prd-deploy.yml --ref vx.x.x`). Applies Terraform, builds with `SITE_URL=https://algebananazzzzz.com`, and deploys to `prd-web-pages-algebananazzzzz` with `--branch=main`. Production is served at the apex; beta at `beta.algebananazzzzz.com`. Both come from `custom_domain` in the tfvars.

Gotchas seen in real runs:

- `wrangler pages deploy` needs `--branch=main`. On a tag checkout it otherwise deploys as a Preview and the domain shows "Deployment Not Found".
- Tags created with `GITHUB_TOKEN` do not fire push workflows, so the production tag workflow 2 creates never starts workflow 3 on its own.
- The beta tag version is computed from the last production tag plus conventional-commit types. If `vx.x.x-beta` already exists, the run fails at "Push beta tag"; delete the stale tag and re-run.

Terraform resources live in `infra/`. Per-env config in `infra/config/preprod.tfvars` and `infra/config/prd.tfvars`. State stored in Cloudflare R2 (`com-infra-tfstate-cloudflare`) with separate keys per environment.

Secrets required as GitHub repo secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`. The `preprod` and `prd` environments exist but hold no secrets of their own.

## Where the design handoff lives

`design-handoff/algebananazzzzz-2-0/project/` — original prototype HTML/CSS/JSX from Claude Design. **Gitignored.** Serve via local static server when doing visual-parity comparisons. Key files:

- The home page prototype and its component sources (HTML/JSX); file names there still carry the original version suffix, so list the folder to find them.
- `assets/ds-tokens.css` — original tokens (already ported to `src/styles/tokens.css`).

For any new visual work, render both prototype and dev build side-by-side via Playwright. Visual parity is the success criterion, not Lighthouse scores.

## Anti-patterns observed in past sessions

- Claiming "polish complete" without page-by-page Playwright comparison.
- Adding `.cosmos { opacity: ... }` rules on sub-pages (kills stars).
- Reintroducing `<main class="page">` wrappers on pages (nested `<main>`).
- Putting `data-accent` on the page wrapper as well as `<html>` (two sources of truth).
- Mock-fixing TS errors with `as any` instead of fixing schemas / casts.
- Putting new CSS rules into the barrel `portfolio.css` instead of the themed file.
- Adding new ESLint or formatter tooling without checking if Prettier already covers the case.
- Unhashed class names (Astro scoped styles, global CSS) that match a Tailwind utility. Tailwind scans every source file, so a class named `ring` picked up a 1px box-shadow.
- Writing `-webkit-backdrop-filter` after `backdrop-filter`. The minifier merges the pair and keeps the last one, so Chromium gets no blur. Put the unprefixed property last.

## Specs and plans

- `docs/superpowers/specs/` — design specs for past and current work.
- `docs/superpowers/plans/` — implementation plans.
- Latest audit: `docs/superpowers/plans/2026-05-20-astro-structure-audit.md`.
