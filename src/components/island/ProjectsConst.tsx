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
  tagline: string;
  summary: string;
  tech: string[];
  date: string;
  cluster: string;
  magnitude: number;
  bullets?: string[];
  href?: string;
}

interface Props {
  projects: ProjectInput[];
  clusters: Record<string, { color: string }>;
}

interface Star {
  id: string;
  title: string;
  summary: string;
  date: string;
  tech: string[];
  href?: string;
  mass: number;
  x: number;
  y: number;
  color: string;
}

// Arrange cluster centers in visual space, then invert perspective so each
// group stays compact on the tilted field. Stable IDs keep refreshes repeatable.
function computeLayout(projects: ProjectInput[]): Map<string, { x: number; y: number }> {
  const groups = new Map<string, ProjectInput[]>();
  for (const project of [...projects].sort((a, b) => a.id.localeCompare(b.id))) {
    const key = project.cluster;
    const group = groups.get(key) ?? [];
    group.push(project);
    groups.set(key, group);
  }
  const keys = [...groups.keys()].sort();
  const positions = new Map<string, { x: number; y: number }>();
  const columns = Math.ceil(Math.sqrt(keys.length));
  const rows = Math.ceil(keys.length / columns);
  keys.forEach((key, groupIndex) => {
    const row = Math.floor(groupIndex / columns);
    const groupsInRow = Math.min(columns, keys.length - row * columns);
    const col = groupIndex % columns;
    const centerX = groupsInRow === 1 ? 46 : 24 + (col * 46) / (groupsInRow - 1);
    const centerY = rows === 1 ? 20 : 10 + (row * 23) / (rows - 1);
    const members = groups.get(key)!;
    members.forEach((project, index) => {
      // Vertical separation protects the two-line labels; lateral staggering
      // gives each group an organic shape without packing names into a ring.
      const spread = columns > 2 ? 3 : 4.5;
      const [x, y] = unpersp(
        centerX + (members.length === 1 ? 0 : Math.sin(index * 2.4) * spread),
        centerY + (index - (members.length - 1) / 2) * 3.4,
      );
      positions.set(project.id, { x, y });
    });
  });
  return positions;
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

export default function ProjectsConst({ projects, clusters }: Props) {
  const initialStars: Star[] = useMemo(() => {
    const posById = computeLayout(projects);

    return projects.map((p) => {
      const pos = posById.get(p.id)!;
      return {
        id: p.id,
        title: p.title,
        summary: p.tagline,
        date: p.date,
        tech: p.tech,
        href: p.href,
        x: pos.x,
        y: pos.y,
        mass: p.magnitude,
        color: clusters[p.cluster].color,
      };
    });
  }, [projects, clusters]);

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
              starmap · andromeda constellation
            </text>
            <text
              x="98.8"
              y="2.0"
              fontSize="1"
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
              plane 06 · 2026
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
                    strokeWidth: 0.05,
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
                    strokeWidth: 0.05,
                    transition: 'fill 200ms',
                  }}
                >
                  mag {s.mass.toFixed(1)} · {s.date}
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
          <div className={css.role}>{hovered.date}</div>
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
