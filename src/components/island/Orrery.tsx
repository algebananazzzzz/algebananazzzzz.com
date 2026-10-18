import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { LINK_SCALE, ORRERY_H, ORRERY_W, type OrreryData } from '@/lib/orrery';
import MapHud, { useMapFullscreen } from './MapHud';
import s from './Orrery.module.css';

export type ProjectDetail = { title: string; description: string; date?: string; href?: string };

type Props =
  | { mode: 'compact'; data: OrreryData }
  | { mode: 'inline'; data: OrreryData; details: Record<string, ProjectDetail> };

type Kind = 'tech' | 'project';
type Focus = { kind: Kind; id: string };
type Cam = { x: number; y: number; k: number };
type State = 'norm' | 'hi' | 'dim' | 'off';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const round2 = (v: number) => Math.round(v * 100) / 100;

const camTf = (c: Cam, vw: number) =>
  `translate(${vw / 2} ${ORRERY_H / 2}) scale(${c.k}) translate(${-c.x} ${-c.y})`;
// Dust moves at a fraction of the camera for parallax depth.
const dustTf = (c: Cam, vw: number) => {
  const par = 0.35;
  const pk = 1 + (c.k - 1) * par;
  const x = ORRERY_W / 2 + (c.x - ORRERY_W / 2) * par;
  const y = ORRERY_H / 2 + (c.y - ORRERY_H / 2) * par;
  return `translate(${vw / 2} ${ORRERY_H / 2}) scale(${pk}) translate(${-x} ${-y})`;
};

// Back leads up the map, not through history: a project returns to the beacon it was
// opened from, and everything else returns to all technologies.
const backTarget = (stack: Focus[]): Focus | null => {
  const prev = stack[stack.length - 2];
  return stack[stack.length - 1]?.kind === 'project' && prev?.kind === 'tech' ? prev : null;
};

function parseHash(hash: string): Focus | null {
  const m = /^#(tech|project)\/(.+)$/.exec(hash);
  return m ? { kind: m[1] as Kind, id: decodeURIComponent(m[2]) } : null;
}

function rand(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Rounded so the server and client serialize identical attributes.
const DUST = (() => {
  const rnd = rand(99);
  return Array.from({ length: 220 }, (_, i) => ({
    x: round2(-40 + rnd() * 240),
    y: round2(-30 + rnd() * 160),
    r: round2(0.04 + Math.pow(rnd(), 3) * 0.24),
    o: round2(0.12 + rnd() * 0.5),
    twinkle: i < 36,
    dur: round2(2 + rnd() * 5),
    delay: round2(rnd() * 5),
  }));
})();

export default function Orrery(props: Props) {
  const { data, mode } = props;
  const compact = mode === 'compact';

  const techById = useMemo(() => new Map(data.techs.map((t) => [t.id, t])), [data]);
  const projById = useMemo(() => new Map(data.projects.map((p) => [p.id, p])), [data]);
  const clusterById = useMemo(() => new Map(data.clusters.map((c) => [c.id, c])), [data]);

  const restCam = (vw: number): Cam => {
    const b = data.bounds;
    const k = Math.min(vw / (b.maxX - b.minX), ORRERY_H / (b.maxY - b.minY)) * 0.96;
    return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2, k };
  };

  const [isFs, toggleFs] = useMapFullscreen();
  const [shown, setShown] = useState(() => new Set(data.clusters.map((c) => c.id)));
  const [stack, setStack] = useState<Focus[]>([]);
  const [hover, setHover] = useState<Focus | null>(null);
  const [vw, setVw] = useState(ORRERY_W);
  // Camera is written straight to the DOM each frame; React only re-renders
  // when zoom settles, because label sizes depend on it.
  const [k, setK] = useState(() => restCam(ORRERY_W).k);

  const rootRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const camGRef = useRef<SVGGElement>(null);
  const dustGRef = useRef<SVGGElement>(null);
  const vwRef = useRef(ORRERY_W);
  const camRef = useRef<Cam>(restCam(ORRERY_W));
  const tweenRef = useRef(0);
  const dragRef = useRef<{ sx: number; sy: number; cx: number; cy: number; upp: number } | null>(
    null,
  );
  const draggedRef = useRef(false);
  const stackRef = useRef(stack);
  stackRef.current = stack;

  const focus = stack[stack.length - 1] ?? null;
  const visible = data.projects.filter((p) => shown.has(p.cluster));

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

  const frame = (ids: string[]) => {
    const pts = ids.map((id) => techById.get(id) ?? projById.get(id)).filter((p) => p != null);
    if (!pts.length) return;
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const bw = Math.max(maxX - minX, 24) + 22;
    const bh = Math.max(maxY - minY, 16) + 20;
    const kk = clamp(Math.min(vwRef.current / bw, ORRERY_H / bh), restCam(vwRef.current).k, 3);
    animateTo({ x: (minX + maxX) / 2, y: (minY + maxY) / 2, k: kk });
  };
  const frameFocus = (f: Focus | null) => {
    if (!f) return animateTo(restCam(vwRef.current));
    if (f.kind === 'tech') {
      frame([f.id, ...visible.filter((p) => p.tech.includes(f.id)).map((p) => p.id)]);
    } else {
      frame([f.id, ...projById.get(f.id)!.tech]);
    }
  };
  const setHash = (f: Focus | null) => {
    if (compact) return;
    const url = f ? `#${f.kind}/${encodeURIComponent(f.id)}` : location.pathname + location.search;
    history.replaceState(null, '', url);
  };
  const select = (f: Focus) => {
    if (!(f.kind === 'tech' ? techById.has(f.id) : projById.has(f.id))) return;
    setStack((st) => (st.length && st[st.length - 1].id === f.id ? st : [...st, f].slice(-2)));
    setHover(null);
    setHash(f);
    frameFocus(f);
  };
  const back = () => {
    const f = backTarget(stack);
    setStack(f ? [f] : []);
    setHover(null);
    setHash(f);
    frameFocus(f);
  };
  const clear = () => {
    setStack([]);
    setHover(null);
    setHash(null);
    frameFocus(null);
  };
  const zoomBy = (f: number) =>
    animateTo({ ...camRef.current, k: clamp(camRef.current.k * f, 0.8, 4) });
  const toggleCluster = (id: string) =>
    setShown((prev) => {
      const next = new Set(prev);
      if (!next.has(id)) next.add(id);
      else if (next.size > 1) next.delete(id);
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
      const next = clamp((ORRERY_H * r.width) / r.height, 90, 280);
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

  // Deep links: #tech/<id> or #project/<id>, from the URL or from links
  // elsewhere on the page (the recently-shipped list).
  useEffect(() => {
    if (compact) return;
    const scrollToMap = () =>
      rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const initial = parseHash(location.hash);
    const timer = initial ? setTimeout(() => selectRef.current(initial), 250) : undefined;
    const onHash = () => {
      const f = parseHash(location.hash);
      if (f) {
        selectRef.current(f);
        scrollToMap();
      }
    };
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element).closest('a[href^="#tech/"], a[href^="#project/"]');
      if (!a || rootRef.current?.contains(a)) return;
      const f = parseHash(a.getAttribute('href') ?? '');
      if (!f) return;
      e.preventDefault();
      selectRef.current(f);
      scrollToMap();
    };
    window.addEventListener('hashchange', onHash);
    document.addEventListener('click', onClick);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('hashchange', onHash);
      document.removeEventListener('click', onClick);
    };
  }, [compact]);

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
      upp: Math.max(vwRef.current / r.width, ORRERY_H / r.height),
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
        x: clamp(d.cx - (dx * d.upp) / ck, 0, ORRERY_W),
        y: clamp(d.cy - (dy * d.upp) / ck, 0, ORRERY_H),
      });
    }
  };
  const endDrag = () => {
    dragRef.current = null;
  };
  const onNodeClick = (e: ReactMouseEvent, f: Focus) => {
    if (draggedRef.current) {
      e.preventDefault();
      return;
    }
    if (compact) return;
    e.preventDefault();
    select(f);
  };
  const onBackgroundClick = (e: ReactMouseEvent) => {
    if (compact || draggedRef.current || (e.target as Element).closest('a')) return;
    if (stack.length) clear();
  };

  const active = hover ?? focus;
  let hiTech: Set<string> | null = null;
  let hiProj: Set<string> | null = null;
  if (active?.kind === 'tech') {
    hiTech = new Set([active.id]);
    hiProj = new Set(visible.filter((p) => p.tech.includes(active.id)).map((p) => p.id));
  } else if (active?.kind === 'project') {
    const p = projById.get(active.id)!;
    if (shown.has(p.cluster)) {
      hiProj = new Set([p.id]);
      hiTech = new Set(p.tech);
    }
  }
  const countFor = (tid: string) => visible.filter((p) => p.tech.includes(tid)).length;
  const techState = (id: string): State =>
    !hiTech ? (countFor(id) ? 'norm' : 'dim') : hiTech.has(id) ? 'hi' : 'dim';
  const projState = (cluster: string, id: string): State =>
    !shown.has(cluster) ? 'off' : !hiProj ? 'norm' : hiProj.has(id) ? 'hi' : 'dim';

  const fs = (base: number) => base / Math.pow(k, 0.65);
  const href = (f: Focus) => `${compact ? '/projects' : ''}#${f.kind}/${f.id}`;

  let orbit: { x: number; y: number; r: number } | null = null;
  if (focus?.kind === 'tech') {
    const c = techById.get(focus.id)!;
    const ds = visible
      .filter((p) => p.tech.includes(focus.id))
      .map((p) => Math.hypot(p.x - c.x, p.y - c.y));
    if (ds.length) orbit = { x: c.x, y: c.y, r: Math.max(...ds) + 2.5 };
  }

  const dust = useMemo(
    () =>
      DUST.map((d, i) => (
        <circle
          key={i}
          cx={d.x}
          cy={d.y}
          r={d.r}
          fill="#fff"
          opacity={d.o}
          className={d.twinkle ? s.tw : undefined}
          style={
            d.twinkle
              ? { animationDuration: `${d.dur}s`, animationDelay: `${d.delay}s` }
              : undefined
          }
        />
      )),
    [],
  );

  return (
    <div
      className={compact ? `${s.root} ${s.compact}` : s.root}
      ref={rootRef}
      data-fs={isFs ? 'true' : 'false'}
    >
      <div className={s.map} ref={mapRef}>
        <svg
          ref={svgRef}
          className={s.svg}
          viewBox={`0 0 ${vw} ${ORRERY_H}`}
          preserveAspectRatio="xMidYMid meet"
          aria-label="Projects mapped to the technologies they were built with"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onClick={onBackgroundClick}
        >
          <defs>
            {data.domains.map((d) => (
              <g key={d.id}>
                <radialGradient id={`po-neb-${d.id}`}>
                  <stop offset="0%" stopColor={d.tint} stopOpacity="0.2" />
                  <stop offset="55%" stopColor={d.tint} stopOpacity="0.06" />
                  <stop offset="100%" stopColor={d.tint} stopOpacity="0" />
                </radialGradient>
                <radialGradient id={`po-bh-${d.id}`}>
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
                  <stop offset="18%" stopColor={d.tint} stopOpacity="0.45" />
                  <stop offset="55%" stopColor={d.tint} stopOpacity="0.1" />
                  <stop offset="100%" stopColor={d.tint} stopOpacity="0" />
                </radialGradient>
              </g>
            ))}
            {data.clusters.map((c) => (
              <radialGradient key={c.id} id={`po-ph-${c.id}`}>
                <stop offset="0%" stopColor={c.color} stopOpacity="0.7" />
                <stop offset="40%" stopColor={c.color} stopOpacity="0.18" />
                <stop offset="100%" stopColor={c.color} stopOpacity="0" />
              </radialGradient>
            ))}
            <linearGradient id="po-spike-h" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="#fff" stopOpacity="0" />
              <stop offset="0.5" stopColor="#fff" stopOpacity="0.75" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="po-spike-v" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#fff" stopOpacity="0" />
              <stop offset="0.5" stopColor="#fff" stopOpacity="0.75" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
          </defs>

          <g ref={dustGRef} transform={dustTf(camRef.current, vw)} pointerEvents="none">
            {dust}
          </g>

          <g ref={camGRef} transform={camTf(camRef.current, vw)}>
            <g pointerEvents="none">
              {data.domains.map((d) => (
                <ellipse
                  key={d.id}
                  cx={d.x}
                  cy={d.y}
                  rx="34"
                  ry="24"
                  fill={`url(#po-neb-${d.id})`}
                />
              ))}
            </g>

            <g pointerEvents="none" transform={`scale(${1 / LINK_SCALE})`}>
              {data.links.map((l) => {
                const p = projById.get(l.project)!;
                if (projState(p.cluster, p.id) === 'off') return null;
                const on = !!hiProj?.has(l.project) && !!hiTech?.has(l.tech);
                return (
                  <path
                    key={`${l.project}-${l.tech}`}
                    d={l.d}
                    fill="none"
                    className={s.link}
                    stroke={on ? clusterById.get(p.cluster)!.color : 'rgb(199,210,254)'}
                    strokeWidth={((on ? 0.16 : 0.07) * LINK_SCALE) / Math.sqrt(k)}
                    opacity={on ? 0.75 : hiProj ? 0.04 : 0.14}
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
                stroke="rgba(229,231,235,0.35)"
                strokeWidth={0.08}
                strokeDasharray="0.6 1.2"
                pointerEvents="none"
              />
            )}

            {data.techs.map((t) => {
              const f: Focus = { kind: 'tech', id: t.id };
              return (
                <a
                  key={t.id}
                  href={href(f)}
                  className={`${s.node} ${s.beacon}`}
                  data-state={techState(t.id)}
                  aria-label={`${t.label}, ${t.total} ${t.total === 1 ? 'project' : 'projects'}`}
                  onMouseEnter={() => setHover(f)}
                  onMouseLeave={() => setHover(null)}
                  onClick={(e) => onNodeClick(e, f)}
                >
                  <g transform={`translate(${t.x} ${t.y})`}>
                    <g className={s.star}>
                      <circle className={s.pulse} r={t.r * 4.2} fill={`url(#po-bh-${t.domain})`} />
                      <rect
                        x={-t.r * 3.2}
                        y={-0.04}
                        width={t.r * 6.4}
                        height={0.08}
                        fill="url(#po-spike-h)"
                      />
                      <rect
                        x={-0.04}
                        y={-t.r * 3.2}
                        width={0.08}
                        height={t.r * 6.4}
                        fill="url(#po-spike-v)"
                      />
                      <circle r={t.r} fill="#fff" className={s.bcore} />
                      <circle r={Math.max(t.r * 3, 2.4)} fill="transparent" />
                    </g>
                    <text
                      className={s.blabel}
                      y={t.r * 2.2 + fs(1.6)}
                      textAnchor="middle"
                      fontSize={fs(1.2)}
                    >
                      {t.label}
                    </text>
                  </g>
                </a>
              );
            })}

            {data.projects.map((p) => {
              const f: Focus = { kind: 'project', id: p.id };
              const st = projState(p.cluster, p.id);
              const showLabel = st === 'hi' || (st === 'norm' && k > 1.15);
              return (
                <a
                  key={p.id}
                  href={href(f)}
                  className={`${s.node} ${s.proj}`}
                  data-state={st}
                  data-featured={p.featured ? 'true' : 'false'}
                  tabIndex={st === 'off' ? -1 : undefined}
                  aria-label={p.name}
                  onMouseEnter={() => st !== 'off' && setHover(f)}
                  onMouseLeave={() => setHover(null)}
                  onClick={(e) => onNodeClick(e, f)}
                >
                  <g transform={`translate(${p.x} ${p.y})`}>
                    <circle
                      className={s.phalo}
                      r={p.r * (p.featured ? 7 : 5)}
                      fill={`url(#po-ph-${p.cluster})`}
                    />
                    <circle r={p.r} fill={clusterById.get(p.cluster)!.color} />
                    <circle r={p.r * 0.45} fill="#fff" opacity="0.9" />
                    <circle r={Math.max(p.r * 3, 1.8)} fill="transparent" />
                    <text
                      className={s.plabel}
                      data-shown={showLabel ? 'true' : 'false'}
                      x={p.r + 1}
                      y={fs(0.4)}
                      fontSize={fs(1.05)}
                    >
                      {p.name}
                    </text>
                  </g>
                </a>
              );
            })}
          </g>
        </svg>

        {compact ? (
          <div className={s.hud}>drag to pan · click a star</div>
        ) : (
          <MapHud className={s.maphud} label="drag to pan" fs={isFs} onToggle={toggleFs} />
        )}
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

      {props.mode === 'inline' && (
        <Panel
          data={data}
          details={props.details}
          shown={shown}
          visible={visible}
          stack={stack}
          countFor={countFor}
          onToggle={toggleCluster}
          onSelect={select}
          onBack={back}
          onHover={setHover}
        />
      )}
    </div>
  );
}

type PanelProps = {
  data: OrreryData;
  details: Record<string, ProjectDetail>;
  shown: Set<string>;
  visible: OrreryData['projects'];
  stack: Focus[];
  countFor: (tid: string) => number;
  onToggle: (cluster: string) => void;
  onSelect: (f: Focus) => void;
  onBack: () => void;
  onHover: (f: Focus | null) => void;
};

function Panel({
  data,
  details,
  shown,
  visible,
  stack,
  countFor,
  onToggle,
  onSelect,
  onBack,
  onHover,
}: PanelProps) {
  const focus = stack[stack.length - 1] ?? null;
  const target = backTarget(stack);
  const techLabel = (id: string) => data.techs.find((t) => t.id === id)!.label;
  const projOf = (id: string) => data.projects.find((p) => p.id === id)!;
  const clusterOf = (id: string) => data.clusters.find((c) => c.id === id)!;
  const backLabel = target ? techLabel(target.id) : 'all technologies';
  const hoverProps = (f: Focus) => ({
    onMouseEnter: () => onHover(f),
    onMouseLeave: () => onHover(null),
  });

  return (
    <aside className={s.panel}>
      <div className={s.eyebrow}>project cluster</div>
      <div className={s.clusters}>
        {data.clusters.map((c) => (
          <button
            key={c.id}
            type="button"
            className={s.cluster}
            data-on={shown.has(c.id) ? 'true' : 'false'}
            aria-pressed={shown.has(c.id)}
            onClick={() => onToggle(c.id)}
          >
            <span
              className={s.dot}
              style={{ background: c.color, boxShadow: `0 0 8px ${c.color}` }}
            />
            <span className={s.clusterLabel}>{c.label}</span>
            <span className={s.clusterN}>
              {data.projects.filter((p) => p.cluster === c.id).length}
            </span>
          </button>
        ))}
      </div>
      <div className={s.rule} />

      {!focus && (
        <div className={s.index}>
          <div className={s.eyebrow}>explore by technology</div>
          {data.domains.map((d) => (
            <div key={d.id} className={s.dom}>
              <div className={s.domLabel}>{d.label}</div>
              <div className={s.chips}>
                {data.techs
                  .filter((t) => t.domain === d.id)
                  .map((t) => {
                    const c = countFor(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        className={s.chip}
                        disabled={!c}
                        onClick={() => onSelect({ kind: 'tech', id: t.id })}
                        {...hoverProps({ kind: 'tech', id: t.id })}
                      >
                        {t.label}
                        <span>{c}</span>
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      )}

      {focus?.kind === 'tech' &&
        (() => {
          const list = visible.filter((p) => p.tech.includes(focus.id));
          const domain = data.domains.find(
            (d) => d.id === data.techs.find((t) => t.id === focus.id)!.domain,
          )!;
          return (
            <div className={s.detail}>
              <button
                type="button"
                className={s.back}
                onClick={onBack}
                aria-label={`back to ${backLabel}`}
              >
                <span className={s.backIcon} aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                </span>
                <span className={s.backLabel}>{backLabel}</span>
              </button>
              <div className={s.eyebrow}>{domain.label}</div>
              <h3 className={s.title}>{techLabel(focus.id)}</h3>
              <div className={s.sub}>
                {list.length} {list.length === 1 ? 'project orbits' : 'projects orbit'} this beacon
              </div>
              <div className={s.plist}>
                {list.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={s.prow}
                    onClick={() => onSelect({ kind: 'project', id: p.id })}
                    {...hoverProps({ kind: 'project', id: p.id })}
                  >
                    <span className={s.dot} style={{ background: clusterOf(p.cluster).color }} />
                    <span className={s.prowBody}>
                      <span className={s.prowTitle}>{p.name}</span>
                      <span className={s.prowTag}>{details[p.id].title}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

      {focus?.kind === 'project' &&
        (() => {
          const p = projOf(focus.id);
          const d = details[p.id];
          const cluster = clusterOf(p.cluster);
          return (
            <div className={s.detail}>
              <button
                type="button"
                className={s.back}
                onClick={onBack}
                aria-label={`back to ${backLabel}`}
              >
                <span className={s.backIcon} aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                </span>
                <span className={s.backLabel}>{target ? backLabel : 'back'}</span>
              </button>
              <div className={`${s.eyebrow} ${s.badge}`}>
                <span className={s.dot} style={{ background: cluster.color }} />
                {cluster.label}
              </div>
              <h3 className={s.title}>{p.name}</h3>
              {d.date && <div className={s.sub}>{d.date}</div>}
              <p className={s.description}>{d.description}</p>
              <div className={s.eyebrow}>built with</div>
              <div className={s.chips}>
                {p.tech.map((tid) => (
                  <button
                    key={tid}
                    type="button"
                    className={s.chip}
                    onClick={() => onSelect({ kind: 'tech', id: tid })}
                    {...hoverProps({ kind: 'tech', id: tid })}
                  >
                    {techLabel(tid)}
                  </button>
                ))}
              </div>
              {d.href && (
                <a className={s.linkOut} href={d.href} target="_blank" rel="noopener noreferrer">
                  {d.href.includes('github.com') ? 'view on github ↗' : 'visit site ↗'}
                </a>
              )}
            </div>
          );
        })()}
    </aside>
  );
}
