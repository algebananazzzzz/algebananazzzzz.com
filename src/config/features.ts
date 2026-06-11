// Build-time feature flags.
//
// Toggle via environment variables (locally in `.env`, in CI via the deploy
// workflow). Vite inlines `import.meta.env.*` at build time, so flipping a flag
// requires a rebuild — these are not runtime toggles.
//
// `PUBLIC_`-prefixed vars are also readable inside client islands, so a single
// source of truth covers both the Astro server render and hydrated React.

function flagFromEnv(value: unknown, fallback = false): boolean {
  if (value === undefined || value === null || value === '') return fallback;
  const v = String(value).toLowerCase();
  return v === 'true' || v === '1';
}

export const features = {
  /**
   * The Milky Way digital-garden / blog (`/milky-way`, its nav pill, and the
   * home preview). Not ready for production — off unless
   * `PUBLIC_FEATURE_MILKY_WAY=true` is set at build time.
   */
  milkyWay: flagFromEnv(import.meta.env.PUBLIC_FEATURE_MILKY_WAY, false),
} as const;
