import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { LINK_SCALE } from '@/lib/orrery';
import { STARMAP_H, STARMAP_W, type StarmapData, type StarmapNode } from '@/lib/starmap';
import MapHud, { useMapFullscreen } from './MapHud';
import s from './Starmap.module.css';

type Cam = { x: number; y: number; k: number };
type State = 'norm' | 'hi' | 'rel' | 'dim';

const INK = '#1b2238';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const round2 = (v: number) => Math.round(v * 100) / 100;

const camTf = (c: Cam, vw: number) =>
  `translate(${vw / 2} ${STARMAP_H / 2}) scale(${c.k}) translate(${-c.x} ${-c.y})`;
// The band moves at a fraction of the camera for parallax depth.
const dustTf = (c: Cam, vw: number) => {
  const par = 0.35;
  const pk = 1 + (c.k - 1) * par;
  const x = STARMAP_W / 2 + (c.x - STARMAP_W / 2) * par;
  const y = STARMAP_H / 2 + (c.y - STARMAP_H / 2) * par;
  return `translate(${vw / 2} ${STARMAP_H / 2}) scale(${pk}) translate(${-x} ${-y})`;
};

const parseHash = (hash: string) => {
  const m = /^#page\/(.+)$/.exec(hash);
  return m ? decodeURIComponent(m[1]) : null;
};

const GRID = (() => {
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let x = -40; x <= 200; x += 10) lines.push({ x1: x, y1: -40, x2: x, y2: 140 });
  for (let y = -40; y <= 140; y += 10) lines.push({ x1: -40, y1: y, x2: 200, y2: y });
  return lines;
})();

const related = (n: StarmapNode) =>
  [n.parent, ...n.kids, ...n.out, ...n.inn].filter((id): id is string => id !== null);

function Dot({ color, size = 8 }: { color: string | null; size?: number }) {
  return <span className={s.dot} style={{ width: size, height: size, background: color ?? INK }} />;
}

export default function Starmap({ data }: { data: StarmapData }) {
  const byId = useMemo(() => new Map(data.nodes.map((n) => [n.id, n])), [data]);

  const restCam = (vw: number): Cam => {
    const b = data.bounds;
    const k = Math.min(vw / (b.maxX - b.minX), STARMAP_H / (b.maxY - b.minY)) * 0.96;
    return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2, k };
  };

  const [isFs, toggleFs] = useMapFullscreen();
  const [stack, setStack] = useState<string[]>([]);
  const [hover, setHover] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(() => new Set(data.roots));
  const [vw, setVw] = useState(STARMAP_W);
  // Camera is written straight to the DOM each frame; React only re-renders
  // when zoom settles, because label sizes depend on it.
  const [k, setK] = useState(() => restCam(STARMAP_W).k);

  const rootRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const camGRef = useRef<SVGGElement>(null);
  const dustGRef = useRef<SVGGElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const vwRef = useRef(STARMAP_W);
  const camRef = useRef<Cam>(restCam(STARMAP_W));
  const tweenRef = useRef(0);
  const dragRef = useRef<{ sx: number; sy: number; cx: number; cy: number; upp: number } | null>(
    null,
  );
  const draggedRef = useRef(false);
  const stackRef = useRef(stack);
  stackRef.current = stack;

  const focus = stack[stack.length - 1] ?? null;

  const setCamNow = (c: Cam) => {
    camRef.current = c;
    camGRef.current?.setAttribute('transform', camTf(c, vwRef.current));
    dustGRef.current?.setAttribute('transform', dustTf(c, vwRef.current));
  };
  const settle = () => setK(round2(camRef.current.k));
  const animateTo = (to: Cam) => {
    cancelAnimationFrame(tweenRef.current);
    const from = { ...camRef.current };
    const t0 = performance.now();
    const step = (t: number) => {
      const u = Math.min(1, (t - t0) / 750);
      const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      setCamNow({
        x: from.x + (to.x - from.x) * e,
        y: from.y + (to.y - from.y) * e,
        k: from.k * Math.pow(to.k / from.k, e),
      });
      if (u < 1) tweenRef.current = requestAnimationFrame(step);
      else settle();
    };
    tweenRef.current = requestAnimationFrame(step);
  };

  const frameFocus = (id: string | null) => {
    if (!id) return animateTo(restCam(vwRef.current));
    const pts = [id, ...related(byId.get(id)!)].map((i) => byId.get(i)!);
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const bw = Math.max(maxX - minX, 24) + 26;
    const bh = Math.max(maxY - minY, 16) + 20;
    const kk = clamp(Math.min(vwRef.current / bw, STARMAP_H / bh), restCam(vwRef.current).k, 3);
    animateTo({ x: (minX + maxX) / 2, y: (minY + maxY) / 2, k: kk });
  };
  const setHash = (id: string | null) => {
    const url = id ? `#page/${encodeURIComponent(id)}` : location.pathname + location.search;
    history.replaceState(null, '', url);
  };
  const reveal = (id: string) => setOpen((prev) => new Set([...prev, ...byId.get(id)!.path]));
  const select = (id: string) => {
    if (!byId.has(id)) return;
    setStack((st) => (st[st.length - 1] === id ? st : [...st, id].slice(-10)));
    setHover(null);
    reveal(id);
    setHash(id);
    frameFocus(id);
  };
  const back = () => {
    const next = stack.slice(0, -1);
    const id = next[next.length - 1] ?? null;
    setStack(next);
    setHover(null);
    setHash(id);
    frameFocus(id);
  };
  const clear = () => {
    setStack([]);
    setHover(null);
    setHash(null);
    frameFocus(null);
  };
  const zoomBy = (f: number) =>
    animateTo({ ...camRef.current, k: clamp(camRef.current.k * f, 0.8, 4) });
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectRef = useRef(select);
  selectRef.current = select;

  useEffect(() => () => cancelAnimationFrame(tweenRef.current), []);

  // Match the viewBox to the container's aspect so the field fills it.
  useEffect(() => {
    const el = mapRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const next = clamp((STARMAP_H * r.width) / r.height, 90, 280);
      if (Math.abs(next - vwRef.current) < 0.5) return;
      vwRef.current = next;
      setVw(next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!stackRef.current.length) {
      cancelAnimationFrame(tweenRef.current);
      setCamNow(restCam(vw));
      settle();
    } else {
      setCamNow(camRef.current);
    }
    // restCam and setCamNow only read refs and static data, so vw is the only trigger.
  }, [vw]);

  // CSS animations pause while the map is off-screen.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      el.dataset.paused = e.isIntersecting ? 'false' : 'true';
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Deep links: #page/<id> opens that page on load or when the hash changes.
  useEffect(() => {
    const initial = parseHash(location.hash);
    const timer = initial ? setTimeout(() => selectRef.current(initial), 250) : undefined;
    const onHash = () => {
      const id = parseHash(location.hash);
      if (id) selectRef.current(id);
    };
    window.addEventListener('hashchange', onHash);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('hashchange', onHash);
    };
  }, []);

  // Keep the focused row in view inside the panel.
  useEffect(() => {
    const pnl = panelRef.current;
    if (!pnl || !focus) return;
    const row = pnl.querySelector(`[data-row="${CSS.escape(focus)}"]`);
    if (!row) return;
    const pr = pnl.getBoundingClientRect();
    const rr = row.getBoundingClientRect();
    if (rr.top < pr.top + 40 || rr.bottom > pr.bottom - 20) {
      pnl.scrollTop += rr.top - pr.top - pr.height / 2;
    }
  }, [focus, open]);

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    cancelAnimationFrame(tweenRef.current);
    draggedRef.current = false;
    const r = svgRef.current!.getBoundingClientRect();
    dragRef.current = {
      sx: e.clientX,
      sy: e.clientY,
      cx: camRef.current.x,
      cy: camRef.current.y,
      upp: Math.max(vwRef.current / r.width, STARMAP_H / r.height),
    };
  };
  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!draggedRef.current && Math.hypot(dx, dy) > 4) {
      draggedRef.current = true;
      svgRef.current!.setPointerCapture(e.pointerId);
    }
    if (draggedRef.current) {
      const ck = camRef.current.k;
      setCamNow({
        k: ck,
        x: clamp(d.cx - (dx * d.upp) / ck, 0, STARMAP_W),
        y: clamp(d.cy - (dy * d.upp) / ck, 0, STARMAP_H),
      });
    }
  };
  const endDrag = () => {
    dragRef.current = null;
  };
  const onNodeClick = (e: ReactMouseEvent, id: string) => {
    e.preventDefault();
    if (!draggedRef.current) select(id);
  };
  const onBackgroundClick = (e: ReactMouseEvent) => {
    if (draggedRef.current || (e.target as Element).closest('a')) return;
    if (stack.length) clear();
  };

  const active = hover ?? focus;
  const rel = active ? new Set([active, ...related(byId.get(active)!)]) : null;
  const q = query.trim().toLowerCase();
  const match = q
    ? new Set(data.nodes.filter((n) => n.title.toLowerCase().includes(q)).map((n) => n.id))
    : null;
  const stateOf = (id: string): State =>
    rel
      ? id === active
        ? 'hi'
        : rel.has(id)
          ? 'rel'
          : 'dim'
      : match
        ? match.has(id)
          ? 'hi'
          : 'dim'
        : 'norm';

  const fs = (base: number) => base / Math.pow(k, 0.65);
  const sk = Math.sqrt(k);

  let orbit: { x: number; y: number; r: number; color: string | null } | null = null;
  if (focus) {
    const c = byId.get(focus)!;
    const ds = related(c).map((id) => {
      const n = byId.get(id)!;
      return Math.hypot(n.x - c.x, n.y - c.y);
    });
    if (ds.length) orbit = { x: c.x, y: c.y, r: Math.max(...ds) + 3, color: c.color };
  }

  const grid = useMemo(() => GRID.map((l, i) => <line key={i} {...l} />), []);

  const fn = focus ? byId.get(focus)! : null;
  const prev = stack[stack.length - 2];
  const backLabel = prev ? byId.get(prev)!.title : 'the whole sky';

  // Search narrows the tree to matches and their ancestors, all expanded.
  const visible = match ? new Set([...match].flatMap((id) => byId.get(id)!.path)) : null;
  const rows: StarmapNode[] = [];
  const walk = (id: string) => {
    const n = byId.get(id)!;
    if (visible && !visible.has(id)) return;
    rows.push(n);
    if (n.kids.length && (visible || open.has(id))) n.kids.forEach(walk);
  };
  data.roots.forEach(walk);

  const hoverProps = (id: string) => ({
    onMouseEnter: () => setHover(id),
    onMouseLeave: () => setHover(null),
  });

  const relGroup = (label: string, ids: string[], owner: string) => (
    <div className={s.group}>
      <div className={s.eyebrow}>
        {label}
        <span>{ids.length}</span>
      </div>
      <div className={s.rlist}>
        {ids.map((id) => {
          const n = byId.get(id)!;
          const par = n.parent ? byId.get(n.parent)! : null;
          return (
            <button
              key={id}
              type="button"
              className={s.rrow}
              onClick={() => select(id)}
              {...hoverProps(id)}
            >
              <Dot color={n.color} />
              <span className={s.rrowTitle}>{n.title}</span>
              {par && par.id !== owner && <span className={s.rrowPar}>{par.title}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className={s.frame} ref={rootRef} data-fs={isFs ? 'true' : 'false'}>
      <div className={s.map} ref={mapRef}>
        <svg
          ref={svgRef}
          className={s.svg}
          viewBox={`0 0 ${vw} ${STARMAP_H}`}
          preserveAspectRatio="xMidYMid meet"
          aria-label="The wiki as a star chart: pages are stars, folders draw the constellations"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onClick={onBackgroundClick}
        >
          <defs>
            <radialGradient id="sm-band">
              <stop offset="0%" stopColor="#8f9cc4" stopOpacity="0.3" />
              <stop offset="60%" stopColor="#a9b3d3" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#a9b3d3" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="sm-bulge">
              <stop offset="0%" stopColor="#c7a9d9" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#c7a9d9" stopOpacity="0" />
            </radialGradient>
          </defs>

          <g ref={dustGRef} transform={dustTf(camRef.current, vw)} pointerEvents="none">
            <ellipse
              cx="80"
              cy="50"
              rx="150"
              ry="22"
              fill="url(#sm-band)"
              transform="rotate(-16 80 50)"
            />
            <ellipse
              cx="96"
              cy="46"
              rx="44"
              ry="13"
              fill="url(#sm-bulge)"
              transform="rotate(-16 96 46)"
            />
          </g>

          <g ref={camGRef} transform={camTf(camRef.current, vw)}>
            <g className={s.grid} pointerEvents="none">
              {grid}
            </g>
            <g pointerEvents="none">
              {data.roots.map((id) => {
                const n = byId.get(id)!;
                return (
                  <text
                    key={id}
                    className={s.conlabel}
                    x={n.x}
                    y={n.y - 6.5}
                    textAnchor="middle"
                    fontSize={fs(1.25)}
                    fill={INK}
                  >
                    {n.title}
                  </text>
                );
              })}
            </g>

            <g pointerEvents="none" transform={`scale(${1 / LINK_SCALE})`}>
              {data.cross.map((e) => {
                const on = !!rel && (e.a === active || e.b === active);
                return (
                  <path
                    key={`${e.a}-${e.b}`}
                    d={e.d}
                    fill="none"
                    className={s.xlink}
                    stroke={on ? (byId.get(active!)!.color ?? INK) : INK}
                    strokeWidth={((on ? 0.16 : 0.08) * LINK_SCALE) / sk}
                    strokeDasharray={`${(0.7 * LINK_SCALE) / sk} ${(0.6 * LINK_SCALE) / sk}`}
                    opacity={on ? 0.85 : rel || match ? 0.06 : 0.2}
                  />
                );
              })}
            </g>
            <g pointerEvents="none">
              {data.nodes
                .filter((n) => n.parent)
                .map((n) => {
                  const p = byId.get(n.parent!)!;
                  const on = !!rel && (n.id === active || p.id === active);
                  return (
                    <line
                      key={n.id}
                      x1={p.x}
                      y1={p.y}
                      x2={n.x}
                      y2={n.y}
                      className={s.tlink}
                      stroke={n.color ?? INK}
                      strokeWidth={(on ? 0.22 : 0.13) / sk}
                      opacity={on ? 0.95 : rel || match ? 0.14 : 0.55}
                    />
                  );
                })}
            </g>

            {orbit && (
              <circle
                className={s.orbit}
                cx={orbit.x}
                cy={orbit.y}
                r={orbit.r}
                fill="none"
                pointerEvents="none"
                stroke={orbit.color ?? INK}
                strokeOpacity="0.5"
                strokeWidth={0.08}
                strokeDasharray="0.5 1.1"
              />
            )}

            {data.nodes.map((n) => {
              const st = stateOf(n.id);
              const hub = n.kids.length > 0;
              // Branches are always named, even the ones without pages under them yet.
              const major = hub || n.depth === 1;
              const col = n.color ?? INK;
              const showLabel = major || st === 'hi' || st === 'rel' || k > 1.3;
              // The label sits on the side facing away from the parent star.
              let lp: { x: number; y: number; a: 'start' | 'end' | 'middle' } | null = null;
              if (n.parent) {
                const pp = byId.get(n.parent)!;
                const dx = n.x - pp.x;
                const dy = n.y - pp.y;
                const fsz = major ? 1.45 : 1.6;
                const gap = n.r + (major ? 1.1 : 0.9);
                lp =
                  Math.abs(dx) > Math.abs(dy) * 0.8
                    ? { x: dx > 0 ? gap : -gap, y: fs(fsz * 0.35), a: dx > 0 ? 'start' : 'end' }
                    : { x: 0, y: dy > 0 ? gap + fs(fsz) * 0.9 : -gap, a: 'middle' };
              }
              return (
                <a
                  key={n.id}
                  href={`#page/${n.id}`}
                  className={s.node}
                  data-state={st}
                  data-hub={hub ? 'true' : 'false'}
                  aria-label={n.title}
                  onClick={(e) => onNodeClick(e, n.id)}
                  {...hoverProps(n.id)}
                >
                  <g transform={`translate(${n.x} ${n.y})`}>
                    {focus === n.id && <circle className={s.halo} r={n.r * 4.5} fill={col} />}
                    {n.depth === 0 && (
                      <circle
                        r={n.r + 1.6}
                        fill="none"
                        stroke={col}
                        strokeWidth="0.08"
                        strokeDasharray="0.35 0.45"
                      />
                    )}
                    {hub && <circle r={n.r + 0.65} fill="none" stroke={col} strokeWidth="0.14" />}
                    <circle r={n.r} fill={col} className={s.core} />
                    {n.depth > 0 && <circle r={n.r * 0.38} fill="#fff" opacity="0.85" />}
                    <circle r={Math.max(n.r * 3, 2)} fill="transparent" />
                    {lp && (
                      <text
                        className={major ? s.hlabel : s.llabel}
                        data-shown={showLabel ? 'true' : 'false'}
                        x={lp.x}
                        y={lp.y}
                        textAnchor={lp.a}
                        fontSize={fs(major ? 1.45 : 1.6)}
                      >
                        {n.title}
                      </text>
                    )}
                  </g>
                </a>
              );
            })}
          </g>
        </svg>

        <MapHud
          className={s.maphud}
          label="drag to pan, click a star"
          fs={isFs}
          onToggle={toggleFs}
        />
        <div className={`${s.hud} ${s.hudBl}`}>
          <span className={s.leg}>
            <i />
            hierarchy
          </span>
          <span className={s.leg}>
            <i className={s.dash} />
            cross-link
          </span>
        </div>
        <div className={s.zoom}>
          <button type="button" onClick={() => zoomBy(1.4)} aria-label="Zoom in">
            +
          </button>
          <button type="button" onClick={() => zoomBy(1 / 1.4)} aria-label="Zoom out">
            −
          </button>
          <button type="button" onClick={clear} aria-label="Reset view">
            ⟲
          </button>
        </div>
      </div>

      <aside className={s.panel} ref={panelRef}>
        <label className={s.search}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="6.5" />
            <path d="m20 20-4.2-4.2" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="find a page"
            aria-label="Find a page"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && match?.size) select([...match][0]);
              if (e.key === 'Escape') setQuery('');
            }}
          />
          {query && (
            <button
              type="button"
              className={s.searchX}
              onClick={() => setQuery('')}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </label>

        {fn && (
          <div className={s.detail}>
            <button type="button" className={s.back} onClick={back}>
              ← {backLabel}
            </button>
            {fn.path.length > 1 && (
              <div className={s.crumbs}>
                {fn.path.slice(0, -1).map((id) => (
                  <Fragment key={id}>
                    <button type="button" onClick={() => select(id)}>
                      {byId.get(id)!.title}
                    </button>
                    <span>/</span>
                  </Fragment>
                ))}
              </div>
            )}
            <h3 className={s.title}>
              <Dot color={fn.color} size={10} />
              {fn.title}
            </h3>
            <p className={s.summary}>{fn.description}</p>
            <a className={s.open} href={fn.href} target="_blank" rel="noopener noreferrer">
              open in the wiki <span aria-hidden="true">↗</span>
            </a>
            {fn.kids.length > 0 && relGroup('inside', fn.kids, fn.id)}
            {fn.out.length > 0 && relGroup('links to', fn.out, fn.id)}
            {fn.inn.length > 0 && relGroup('linked from', fn.inn, fn.id)}
            <div className={s.rule} />
          </div>
        )}

        <div className={s.eyebrow}>
          {match ? `${match.size} ${match.size === 1 ? 'match' : 'matches'}` : 'contents'}
        </div>
        <div className={s.tree}>
          {rows.map((n) => {
            const hasKids = n.kids.length > 0;
            const isOpen = !!visible || open.has(n.id);
            return (
              <div
                key={n.id}
                className={s.row}
                data-root={n.depth === 0 ? 'true' : 'false'}
                data-row={n.id}
                data-active={focus === n.id ? 'true' : 'false'}
                data-hover={hover === n.id ? 'true' : 'false'}
                style={{ paddingLeft: 4 + n.depth * 14 }}
              >
                {hasKids ? (
                  <button
                    type="button"
                    className={s.caret}
                    data-open={isOpen ? 'true' : 'false'}
                    onClick={() => toggle(n.id)}
                    aria-label={isOpen ? `Collapse ${n.title}` : `Expand ${n.title}`}
                    aria-expanded={isOpen}
                  >
                    <svg viewBox="0 0 10 10" aria-hidden="true">
                      <path d="M3 2 L7 5 L3 8 Z" fill="currentColor" />
                    </svg>
                  </button>
                ) : (
                  <span className={s.caretSp} />
                )}
                <button
                  type="button"
                  className={s.rowBtn}
                  onClick={() => select(n.id)}
                  {...hoverProps(n.id)}
                >
                  {n.depth <= 1 && <Dot color={n.color} />}
                  <span>{n.title}</span>
                </button>
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
