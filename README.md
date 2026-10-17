# algebananazzzzz.com

Instead of building my portfolio from a generic template, I wanted a unique design that captures my innate character and vision. As someone who's genuinely curious and explorative, I chose the theme of the cosmos, something we look up to in the night sky with admiration and vision. I'm really proud to have come up with such a cool design concept myself, like representing my projects as stars in a celestial orrery. Built with Astro and React islands on Tailwind, deployed on Cloudflare Pages.

My corner of the internet. Go visit it at [algebananazzzzz.com](https://algebananazzzzz.com).

A preview of whatever is on `main` lives at [beta.algebananazzzzz.com](https://beta.algebananazzzzz.com). Every push to `main` deploys there. Production is deployed by hand once beta looks right.

## Tech stack

- [Astro 7](https://astro.build): static site generator
- [React 18](https://react.dev): interactive islands
- [Tailwind v4](https://tailwindcss.com): utility CSS
- [TypeScript 5.7](https://www.typescriptlang.org)
- [Vitest](https://vitest.dev): unit tests
- [Prettier](https://prettier.io) with `prettier-plugin-astro`
- [Cloudflare Pages](https://pages.cloudflare.com): hosting, deployed via GitHub Actions, infrastructure in Terraform

## Local development

```bash
git clone https://github.com/algebananazzzzz/algebananazzzzz.com.git
cd algebananazzzzz.com

# node version (uses .nvmrc)
nvm use

npm install
npm run dev   # http://localhost:4321
```

## Scripts

| Command                | Description                      |
| ---------------------- | -------------------------------- |
| `npm run dev`          | Astro dev server with HMR.       |
| `npm run build`        | Static build to `dist/`.         |
| `npm run preview`      | Serve the built `dist/`.         |
| `npm run check`        | TypeScript + Astro diagnostics.  |
| `npm test`             | Vitest single-run.               |
| `npm run test:watch`   | Vitest watch mode.               |
| `npm run format`       | Prettier write across all files. |
| `npm run format:check` | Prettier check (CI gate).        |

## Project structure

```
src/
├── components/
│   ├── island/        React components, hydrated on the client
│   └── static/        Astro components, server-only (TopNav, Footer)
├── content/           YAML data and the wiki manifest (projects, technologies, experience, now, about)
├── content.config.ts  Zod schemas for the content collections
├── layouts/           Base.astro, the page chrome
├── lib/               Orrery layout, magnitude, stardate, routes
├── pages/             Route entries (5 routes)
├── styles/
│   ├── tokens.css     Palette + type tokens (source of truth)
│   ├── global.css     Tailwind + @theme bridge + base resets
│   ├── portfolio.css  Barrel re-export
│   ├── portfolio/     Global CSS (cosmos, hero, sections, legacy-resets)
│   ├── pages.css      Sub-page wrappers
│   └── page-bg.css    Per-route accent washes
└── types/             *.yaml module shim, wiki manifest types
```

## Deployment

Workflows are in `.github/workflows/`:

- `1-feature-branch-ci.yml`: PR checks (format, type check, tests, build).
- `2-preprod-deploy.yml`: pushes to `main` deploy to beta, then create the `vx.x.x` production tag.
- `3-prd-deploy.yml`: production deploy, run by hand on a `vx.x.x` tag.

Terraform lives in `infra/`.

## License

Code is MIT. The words, notes and project write-ups are mine, so please don't reuse them.
