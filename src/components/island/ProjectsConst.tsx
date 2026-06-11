import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import css from './Constellation.module.css';

export interface ProjectInput {
  id: string;
  title: string;
  tagline?: string;
  summary: string;
  tech: string[];
  role: string;
  cluster: string;
  href?: string;
}

interface Props {
  projects: ProjectInput[];
}

interface VisualConfig {
  mass: number;
  color: string;
  spectralClass: string;
}

interface Star {
  id: string;
  title: string;
  summary: string;
  role: string;
  tech: string[];
  href?: string;
  mass: number;
  x: number;
  y: number;
  color: string;
  spectralClass: string;
}

// Ordered by priority: higher-priority projects get more mass (bigger star +
// wider gravity halo) and a more vibrant colour. Lower-priority ones fade toward
// muted, then slate-grey. Spectral classes track the same scale — luminous
// supergiants (O/B) at the top, dim dwarfs (K/M) at the bottom.
const VISUAL_BY_ID: Record<string, VisualConfig> = {
  nubenube: { mass: 4.2, color: '#22d3ee', spectralClass: 'O5 Ia' },
  odyssey: { mass: 3.7, color: '#fb923c', spectralClass: 'B0 Ia' },
  planear: { mass: 3.2, color: '#a78bfa', spectralClass: 'B3 II' },
  'attendance-bot': { mass: 2.8, color: '#34d399', spectralClass: 'A0 III' },
  'sheares-app': { mass: 2.4, color: '#fbbf24', spectralClass: 'A5 IV' },
  nocturnal: { mass: 2.1, color: '#facc15', spectralClass: 'F2 V' },
  'algebananazzzzz-com': { mass: 1.8, color: '#c4b5fd', spectralClass: 'G5 V' },
  nybble: { mass: 1.6, color: '#fca5a5', spectralClass: 'K2 V' },
  'quiz-bot': { mass: 1.4, color: '#94a3b8', spectralClass: 'M4 V' },
};

const CLUSTER_COLOR: Record<string, string> = {
  brewery: '#f472b6',
  llm: '#a78bfa',
  cloud: '#7dd3fc',
  reading: '#fda4af',
  general: '#fde047',
};

function mulberry32(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// FNV-1a over alphabetically-sorted IDs → stable regardless of array order.
// Adding a new project changes the seed (and thus the layout), but an identical
// set of projects always produces an identical layout.
function hashSeed(ids: string[]): number {
  const sorted = [...ids].sort();
  let h = 0x811c9dc5;
  for (const id of sorted) {
    for (let i = 0; i < id.length; i++) {
      h ^= id.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    h ^= 0x5f; // separator
  }
  return h >>> 0;
}

// Mitchell's Best Candidate in visual-y space.
//
// The perspective transform maps flat y → visual y via pow(t, 1.55), which
// compresses the top and stretches the bottom. Sampling flat-y uniformly would
// pack all stars into the lower visual half. Instead we sample uniformly in
// *visual* y, convert candidates back to flat-y for storage, and score all
// distances in visual coordinates so separation is even as the viewer sees it.
// O(n·K) — trivially fast for n ≤ ~50.
function computeLayout(n: number, seed: number): { x: number; y: number }[] {
  if (n === 0) return [];
  if (n === 1) return [{ x: 50, y: 30 }];

  // Safe zone.
  // X: flat (perspective x-scale is mild, ~±15% at extremes).
  // Y: the warp simulation uses depth/pull constants tuned for flat y ∈ [20, 46].
  //    Placing stars above flat y≈20 creates line-crossings in the grid.
  //    We derive VY bounds from those flat limits so visual-space sampling
  //    stays within the simulation's safe range.
  // perspective constants (defined below in module scope but safe to read here at call-time)
  const FH = 56.25; // FIELD_H
  const POW = 1.55; // PERSP_VERT_POW

  const X_MIN = 16,
    X_MAX = 82;
  const FY_MIN = 12,
    FY_MAX = 46; // flat-y pre-warp range
  const VY_MIN = Math.pow(FY_MIN / FH, POW) * FH; // ≈ 11.4 visual y
  const VY_MAX = Math.pow(FY_MAX / FH, POW) * FH; // ≈ 41.3 visual y
  const VW = X_MAX - X_MIN;
  const VH = VY_MAX - VY_MIN;
  const AR = VW / VH; // aspect-ratio normalisation in visual space

  const toFlatY = (vy: number) => Math.pow(vy / FH, 1 / POW) * FH;
  const toVisualY = (fy: number) => Math.pow(fy / FH, POW) * FH;

  const rnd = mulberry32(seed);
  const K = 40;

  const pts: { x: number; y: number }[] = []; // stored as flat coords

  for (let i = 0; i < n; i++) {
    let best = { x: (X_MIN + X_MAX) / 2, y: toFlatY((VY_MIN + VY_MAX) / 2) };
    let bestScore = -Infinity;

    for (let c = 0; c < K; c++) {
      const cx = X_MIN + rnd() * VW;
      const vcy = VY_MIN + rnd() * VH; // uniform in visual y
      const cy = toFlatY(vcy); // convert to flat y for storage

      // Score in visual space: min distance to all existing points and borders
      let score = Math.min(cx - X_MIN, X_MAX - cx, (vcy - VY_MIN) * AR, (VY_MAX - vcy) * AR);
      for (const p of pts) {
        const dx = cx - p.x;
        const dvy = (vcy - toVisualY(p.y)) * AR;
        const d = Math.sqrt(dx * dx + dvy * dvy);
        if (d < score) score = d;
      }

      if (score > bestScore) {
        bestScore = score;
        best = { x: cx, y: cy };
      }
    }

    pts.push(best);
  }

  return pts;
}

const FIELD_W = 100;
const FIELD_H = 56.25;
const PERSP_TOP_WIDTH = 0.58;
const PERSP_VERT_POW = 1.55;

function persp(x: number, y: number): [number, number] {
  const t = Math.max(0, Math.min(1, y / FIELD_H));
  const newY = Math.pow(t, PERSP_VERT_POW) * FIELD_H;
  const xScale = PERSP_TOP_WIDTH + (1 - PERSP_TOP_WIDTH) * t;
  const newX = 50 + (x - 50) * xScale;
  return [newX, newY];
}

function unpersp(svgX: number, svgY: number): [number, number] {
  const t = Math.pow(Math.max(0, svgY) / FIELD_H, 1 / PERSP_VERT_POW);
  const xScale = PERSP_TOP_WIDTH + (1 - PERSP_TOP_WIDTH) * t;
  const flatY = t * FIELD_H;
  const flatX = 50 + (svgX - 50) / xScale;
  return [flatX, flatY];
}

function warpPoint(px: number, py: number, stars: Star[]): [number, number] {
  let dx = 0;
  let dy = 0;
  for (const s of stars) {
    const ddx = px - s.x;
    const ddy = py - s.y;
    const d2 = ddx * ddx + ddy * ddy;
    const R = s.mass * 6.0;
    const R2 = R * R;
    const falloff = R2 / (R2 + d2);
    // Reduced depth (1.2 vs 1.9) keeps total displacement below FIELD_H for ≤10 stars.
    // Universal push + gentle radial pull recreates the "rubber-sheet at an angle" look.
    const depth = s.mass * 1.2 * falloff;
    dy += depth * 0.75;
    const dist = Math.sqrt(d2) + 0.0001;
    const pull = depth * 0.22;
    dx -= (ddx / dist) * pull;
    dy -= (ddy / dist) * pull;
  }
  return [px + dx, py + dy];
}

function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

function nearStar(x: number, y: number, stars: Star[], threshold: number): boolean {
  for (const s of stars) {
    const dx = x - s.x;
    const dy = y - s.y;
    if (dx * dx + dy * dy < threshold * threshold) return true;
  }
  return false;
}

function pathH(y: number, stars: Star[]): string {
  let d = '';
  let penDown = false;
  for (let x = -2; x <= FIELD_W + 2; x += 1.5) {
    if (nearStar(x, y, stars, 8)) {
      penDown = false;
      continue;
    }
    const [wx, wy] = warpPoint(x, y, stars);
    const [px, py] = persp(wx, wy);
    d += (penDown ? ' L' : ' M') + ' ' + px.toFixed(2) + ' ' + py.toFixed(2);
    penDown = true;
  }
  return d.trim();
}

function pathV(x: number, stars: Star[]): string {
  let d = '';
  let penDown = false;
  for (let y = -2; y <= FIELD_H + 2; y += 1.0) {
    if (nearStar(x, y, stars, 8)) {
      penDown = false;
      continue;
    }
    const [wx, wy] = warpPoint(x, y, stars);
    const [px, py] = persp(wx, wy);
    d += (penDown ? ' L' : ' M') + ' ' + px.toFixed(2) + ' ' + py.toFixed(2);
    penDown = true;
  }
  return d.trim();
}

export default function ProjectsConst({ projects }: Props) {
  const initialStars: Star[] = useMemo(() => {
    // Sort by ID so the seed — and therefore the layout — is independent of
    // the order projects arrive in. Same set of IDs → same positions always.
    const sorted = [...projects].sort((a, b) => a.id.localeCompare(b.id));
    const positions = computeLayout(sorted.length, hashSeed(sorted.map((p) => p.id)));
    const posById = new Map(sorted.map((p, i) => [p.id, positions[i]]));

    return projects.map((p) => {
      const vis = VISUAL_BY_ID[p.id];
      const pos = posById.get(p.id)!;
      return {
        id: p.id,
        title: p.title,
        summary: p.tagline ?? p.summary,
        role: p.role,
        tech: p.tech,
        href: p.href,
        x: pos.x,
        y: pos.y,
        mass: vis?.mass ?? 2.2,
        color: vis?.color ?? CLUSTER_COLOR[p.cluster] ?? '#fde047',
        spectralClass: vis?.spectralClass ?? 'G2 V',
      };
    });
  }, [projects]);

  const [stars, setStars] = useState<Star[]>(initialStars);
  const [hover, setHover] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const offsetRef = useRef({ dx: 0, dy: 0 });
  const pointerRef = useRef({ clientX: 0, clientY: 0 });
  const rafRef = useRef<number | null>(null);
  const hasDraggedRef = useRef(false);
  const clickTargetRef = useRef<{ id: string; href?: string } | null>(null);

  const hLines = useMemo(() => {
    const out: number[] = [];
    // Stop at FIELD_H-8 so no line gets pushed off-screen by gravity displacement.
    for (let y = 8; y <= FIELD_H - 8; y += 8) out.push(y);
    return out;
  }, []);
  const vLines = useMemo(() => {
    const out: number[] = [];
    for (let x = 0; x <= FIELD_W; x += 8) out.push(x);
    return out;
  }, []);

  const starById = useCallback(
    (id: string | null) => (id ? stars.find((s) => s.id === id) : undefined),
    [stars],
  );

  const eventToFieldCoords = (ev: { clientX: number; clientY: number }) => {
    const wrap = wrapRef.current;
    if (!wrap) return null;
    const rect = wrap.getBoundingClientRect();
    const svgX = ((ev.clientX - rect.left) / rect.width) * FIELD_W;
    const svgY = ((ev.clientY - rect.top) / rect.height) * FIELD_H;
    const [px, py] = unpersp(svgX, svgY);
    return { px, py };
  };

  const onStarPointerDown = (
    id: string,
    href: string | undefined,
    e: ReactPointerEvent<SVGGElement>,
  ) => {
    e.stopPropagation();
    const pt = eventToFieldCoords(e);
    if (!pt) return;
    const s = stars.find((x) => x.id === id);
    if (!s) return;
    offsetRef.current = { dx: pt.px - s.x, dy: pt.py - s.y };
    hasDraggedRef.current = false;
    clickTargetRef.current = { id, href };
    setDragId(id);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore — some browsers throw if capture isn't supported on the target
    }
  };

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!dragId) return;
    hasDraggedRef.current = true;
    pointerRef.current = { clientX: e.clientX, clientY: e.clientY };
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const pt = eventToFieldCoords(pointerRef.current);
      if (!pt) return;
      const newX = Math.max(3, Math.min(FIELD_W - 3, pt.px - offsetRef.current.dx));
      const newY = Math.max(3, Math.min(FIELD_H - 3, pt.py - offsetRef.current.dy));
      setStars((prev) => prev.map((s) => (s.id === dragId ? { ...s, x: newX, y: newY } : s)));
    });
  };

  const onPointerUp = () => {
    const wasDragged = hasDraggedRef.current;
    const target = clickTargetRef.current;
    setDragId(null);
    clickTargetRef.current = null;
    if (!wasDragged && target) {
      window.location.href = target.href ?? '/projects';
    }
  };

  const detailStyle: CSSProperties = (() => {
    if (!hover) return { display: 'none' };
    const s = starById(hover);
    const wrap = wrapRef.current;
    if (!s || !wrap) return { display: 'none' };
    const rect = wrap.getBoundingClientRect();
    const cardW = 320;
    const cardH = 150;
    const [wx, wy] = warpPoint(s.x, s.y, stars);
    const [vx, vy] = persp(wx, wy);
    const px = (vx / FIELD_W) * rect.width;
    const py = (vy / FIELD_H) * rect.height;
    let left = px + 24;
    let top = py - 12;
    if (left + cardW > rect.width - 16) left = px - cardW - 24;
    if (left < 16) left = 16;
    if (left + cardW > rect.width - 16) left = rect.width - cardW - 16;
    if (top + cardH > rect.height - 16) top = rect.height - cardH - 16;
    if (top < 16) top = 16;
    return { left, top };
  })();

  const hovered = hover && !dragId ? starById(hover) : undefined;

  return (
    <div className={`${css.projConstWrap} ${css.gravityWrap}`} ref={wrapRef}>
      <div className={`${css.projConst} ${css.gravity}`}>
        <svg
          viewBox={`0 0 ${FIELD_W} ${FIELD_H}`}
          preserveAspectRatio="xMidYMid meet"
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          style={{ touchAction: 'none', userSelect: 'none' }}
        >
          <defs>
            {stars.map((s) => (
              <radialGradient key={s.id} id={`grav-halo-${s.id}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                <stop offset="22%" stopColor={s.color} stopOpacity="0.95" />
                <stop offset="55%" stopColor={s.color} stopOpacity="0.2" />
                <stop offset="80%" stopColor={s.color} stopOpacity="0.04" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0" />
              </radialGradient>
            ))}
          </defs>

          <g className="grav-grid" pointerEvents="none">
            {vLines.map((x) => (
              <path
                key={`v-${x}`}
                d={pathV(x, stars)}
                stroke="rgba(167, 139, 250, 0.07)"
                strokeWidth="0.12"
                fill="none"
              />
            ))}
            {hLines.map((y) => (
              <path
                key={`h-${y}`}
                d={pathH(y, stars)}
                stroke="rgba(167, 139, 250, 0.07)"
                strokeWidth="0.12"
                fill="none"
              />
            ))}
          </g>

          <g pointerEvents="none">
            <text
              x="1.2"
              y="2.0"
              fontSize="0.85"
              fill="rgba(229,231,235,0.40)"
              fontFamily="var(--font-mono)"
              letterSpacing="0.06em"
            >
              spacetime · workbench-1
            </text>
            <text
              x="98.8"
              y="2.0"
              fontSize="0.85"
              fill="rgba(229,231,235,0.40)"
              fontFamily="var(--font-mono)"
              letterSpacing="0.06em"
              textAnchor="end"
            >
              drag the stars to warp the space
            </text>
            <text
              x="1.2"
              y={FIELD_H - 0.8}
              fontSize="0.85"
              fill="rgba(229,231,235,0.40)"
              fontFamily="var(--font-mono)"
              letterSpacing="0.06em"
            >
              {stars.length} masses tracked
            </text>
            <text
              x="98.8"
              y={FIELD_H - 0.8}
              fontSize="0.85"
              fill="rgba(229,231,235,0.40)"
              fontFamily="var(--font-mono)"
              letterSpacing="0.06em"
              textAnchor="end"
            >
              plate 06 · 2026
            </text>
          </g>

          {stars.map((s) => {
            const [swx, swy] = warpPoint(s.x, s.y, stars);
            const [dxRaw, dyRaw] = persp(swx, swy);
            const persFactor = 0.55 + 0.45 * (s.y / FIELD_H);
            const rRaw = (0.36 + s.mass * 0.26) * persFactor;
            // Round float outputs so SSR (Node) and client (V8) emit identical
            // attributes — otherwise React flags last-digit drift as a hydration mismatch.
            const dx = round4(dxRaw);
            const dy = round4(dyRaw);
            const r = round4(rRaw);
            const isHover = hover === s.id || dragId === s.id;
            const isDrag = dragId === s.id;
            return (
              <g
                key={s.id}
                className={`${css.gravStar} ${isDrag ? css.isDragging : ''}`}
                style={{ cursor: isDrag ? 'grabbing' : 'grab' }}
                onPointerDown={(e) => onStarPointerDown(s.id, s.href, e)}
                onMouseEnter={() => {
                  if (!dragId) setHover(s.id);
                }}
                onMouseLeave={() => {
                  if (!dragId) setHover(null);
                }}
              >
                <circle
                  cx={dx}
                  cy={dy}
                  r={r * (isHover ? 6.8 : 5.4)}
                  fill={`url(#grav-halo-${s.id})`}
                  style={{ transition: 'r 240ms cubic-bezier(0.34, 1.56, 0.64, 1)' }}
                />
                <circle
                  cx={dx}
                  cy={dy}
                  r={r}
                  fill="#ffffff"
                  style={{
                    filter: `drop-shadow(0 0 3px ${s.color}) drop-shadow(0 0 1px #ffffff)`,
                  }}
                  pointerEvents="none"
                />
                <text
                  x={dx + r + 1.0}
                  y={dy - r - 0.3}
                  fontSize="1.05"
                  fill={isHover ? '#f8fafc' : 'rgba(229,231,235,0.92)'}
                  fontFamily="var(--font-mono)"
                  letterSpacing="0.02em"
                  pointerEvents="none"
                  style={{
                    paintOrder: 'stroke',
                    stroke: 'rgba(2,3,10,0.55)',
                    strokeWidth: 0.18,
                    transition: 'fill 200ms',
                  }}
                >
                  {s.title.toLowerCase()}
                </text>
                <text
                  x={dx + r + 1.0}
                  y={dy - r - 0.3 + 1.4}
                  fontSize="0.75"
                  fill={isHover ? 'rgba(241,245,249,0.85)' : 'rgba(229,231,235,0.6)'}
                  fontFamily="var(--font-mono)"
                  letterSpacing="0.06em"
                  pointerEvents="none"
                  style={{
                    paintOrder: 'stroke',
                    stroke: 'rgba(2,3,10,0.55)',
                    strokeWidth: 0.14,
                    transition: 'fill 200ms',
                  }}
                >
                  mag {s.mass.toFixed(1)} · {s.spectralClass}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {hovered && (
        <div className={css.projDetail} style={detailStyle}>
          <div className={css.title}>{hovered.title}</div>
          <div className={css.summary}>{hovered.summary}</div>
          <div className={css.role}>{hovered.role}</div>
          <div className={css.techRow}>
            {hovered.tech.map((t) => (
              <span key={t} className="tag">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
