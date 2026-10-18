import { useEffect, useMemo, useRef, useState } from 'react';
import { useReducedComplexity } from '@/lib/useReducedComplexity';
import s from './Orbit.module.css';

interface OrbitItem {
  title: string;
  note: string;
  tags: string[];
}
interface Props {
  developing: OrbitItem;
  exploring: OrbitItem;
  obsessed: OrbitItem;
}

type Body = {
  id: string;
  label: string;
  name: string;
  note: string;
  color: string;
  glow: string;
  orbitR: number;
  speed: number;
  phase: number;
  radius: number;
  ring?: boolean;
  meta: string[];
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

const RING_TILT_RATIO = 0.32;

function makeRingParticles(id: string, radius: number) {
  const rnd = mulberry32(id.charCodeAt(0) * 173 + id.length);
  const N = 70;
  const inner = radius * 1.45;
  const outer = radius * 2.4;
  const cassiniInner = radius * 1.75;
  const cassiniOuter = radius * 1.88;
  const out: { R: number; baseAngle: number; speed: number; size: number; alpha: number }[] = [];
  for (let i = 0; i < N; i++) {
    let R = inner + rnd() * (outer - inner);
    if (R > cassiniInner && R < cassiniOuter) {
      R = rnd() < 0.5 ? cassiniInner - rnd() * 0.06 : cassiniOuter + rnd() * 0.06;
    }
    const inBrightBand = R < radius * 1.7;
    out.push({
      R,
      baseAngle: rnd() * Math.PI * 2,
      speed: 0.0004 * Math.pow((radius * 2.3) / R, 1.4) * (0.85 + rnd() * 0.3),
      size: (inBrightBand ? 0.28 : 0.22) + rnd() * 0.3,
      alpha: (inBrightBand ? 0.78 : 0.55) + rnd() * 0.25,
    });
  }
  return out;
}

// Sync a canvas element's pixel buffer to its current CSS size.
function syncCanvas(
  canvas: HTMLCanvasElement,
  dpr: number,
): { w: number; h: number; scale: number; ox: number; oy: number } {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const cw = Math.round(w * dpr);
  const ch = Math.round(h * dpr);
  if (canvas.width !== cw || canvas.height !== ch) {
    canvas.width = cw;
    canvas.height = ch;
  }
  // SVG viewBox 0 0 100 100 with xMidYMid meet — compute scale and centering offsets.
  const scale = (Math.min(w, h) / 100) * dpr;
  const ox = (w * dpr - 100 * scale) / 2;
  const oy = (h * dpr - 100 * scale) / 2;
  return { w: cw, h: ch, scale, ox, oy };
}

export default function Orbit({ developing, exploring, obsessed }: Props) {
  const reduced = useReducedComplexity();
  const [hoverId, setHoverId] = useState<string | null>(null);

  const bodies: Body[] = useMemo(
    () => [
      {
        id: 'developing',
        label: 'developing',
        name: developing.title,
        note: developing.note,
        color: '#fbbf24',
        glow: 'rgba(251, 191, 36, 0.55)',
        orbitR: 0.23,
        speed: 0.00045,
        phase: 0.3,
        radius: 2.8,
        meta: developing.tags,
      },
      {
        id: 'exploring',
        label: 'exploring',
        name: exploring.title,
        note: exploring.note,
        color: '#a78bfa',
        glow: 'rgba(167, 139, 250, 0.55)',
        orbitR: 0.38,
        speed: 0.00028,
        phase: 1.6,
        radius: 4.0,
        ring: true,
        meta: exploring.tags,
      },
      {
        id: 'obsessed',
        label: 'Obsessed with',
        name: obsessed.title,
        note: obsessed.note,
        color: '#f472b6',
        glow: 'rgba(244, 114, 182, 0.55)',
        orbitR: 0.52,
        speed: 0.00018,
        phase: 2.9,
        radius: 3.2,
        meta: obsessed.tags,
      },
    ],
    [developing, exploring, obsessed],
  );

  const stars = useMemo(() => {
    const rnd = mulberry32(11);
    return Array.from({ length: 72 }, (_, i) => ({
      x: rnd() * 100,
      y: rnd() * 100,
      r: 0.1 + rnd() * 0.4,
      d: 1.6 + rnd() * 4.2,
      o: 0.18 + rnd() * 0.55,
      key: i,
    }));
  }, []);

  const ringParticles = useMemo(() => {
    const out: Record<string, ReturnType<typeof makeRingParticles>> = {};
    bodies.forEach((b) => {
      if (b.ring) out[b.id] = makeRingParticles(b.id, b.radius);
    });
    return out;
  }, [bodies]);

  const planetRefs = useRef<Record<string, SVGCircleElement | null>>({});
  const moon1Ref = useRef<SVGCircleElement | null>(null);
  const moon2Ref = useRef<SVGCircleElement | null>(null);
  const dialRef = useRef<SVGGElement | null>(null);
  // Two canvases flank the SVG so back particles composite behind planets, front particles in front.
  const ringBackCanvasRef = useRef<HTMLCanvasElement>(null);
  const ringFrontCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (reduced) return;
    const backCanvas = ringBackCanvasRef.current;
    const frontCanvas = ringFrontCanvasRef.current;
    const backCtx = backCanvas?.getContext('2d') ?? null;
    const frontCtx = frontCanvas?.getContext('2d') ?? null;

    let raf = 0;
    let last = performance.now();
    let visible = true;
    const phases = Object.fromEntries(bodies.map((b) => [b.id, b.phase])) as Record<string, number>;
    phases['moon1'] = 1.2;
    phases['moon2'] = 3.8;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const tick = (now: number) => {
      const dt = now - last;
      last = now;

      // Always advance phases so animation stays in sync off-screen.
      bodies.forEach((b) => {
        phases[b.id] += b.speed * dt;
      });
      phases['moon1'] += 0.0026 * dt;
      phases['moon2'] += 0.0016 * dt;
      const dialCur = parseFloat(dialRef.current?.dataset.rot || '0') + dt * 0.0015;
      if (dialRef.current) dialRef.current.dataset.rot = String(dialCur);

      if (visible) {
        if (dialRef.current) dialRef.current.setAttribute('transform', `rotate(${dialCur} 50 50)`);

        let obsessedX = 50,
          obsessedY = 50;
        bodies.forEach((b) => {
          const ph = phases[b.id];
          const r = b.orbitR * 100;
          const ry = b.orbitR * 62;
          const x = 50 + Math.cos(ph) * r;
          const y = 50 + Math.sin(ph) * ry;
          if (b.id === 'obsessed') {
            obsessedX = x;
            obsessedY = y;
          }
          const planet = planetRefs.current[b.id];
          if (planet) {
            planet.setAttribute('cx', String(x));
            planet.setAttribute('cy', String(y));
          }
        });

        // Two moons orbiting outer planet on different radii
        const m1x = obsessedX + Math.cos(phases['moon1']) * 5.5;
        const m1y = obsessedY + Math.sin(phases['moon1']) * 5.5 * 0.42;
        if (moon1Ref.current) {
          moon1Ref.current.setAttribute('cx', String(m1x));
          moon1Ref.current.setAttribute('cy', String(m1y));
        }
        const m2x = obsessedX + Math.cos(phases['moon2']) * 8.5;
        const m2y = obsessedY + Math.sin(phases['moon2']) * 8.5 * 0.42;
        if (moon2Ref.current) {
          moon2Ref.current.setAttribute('cx', String(m2x));
          moon2Ref.current.setAttribute('cy', String(m2y));
        }

        // Draw ring particles to the two canvases instead of exploring SVG attributes.
        if (backCanvas && frontCanvas && backCtx && frontCtx) {
          const back = syncCanvas(backCanvas, dpr);
          const front = syncCanvas(frontCanvas, dpr);
          backCtx.clearRect(0, 0, back.w, back.h);
          frontCtx.clearRect(0, 0, front.w, front.h);

          bodies.forEach((b) => {
            if (!b.ring) return;
            const ph = phases[b.id];
            const r = b.orbitR * 100;
            const ry = b.orbitR * 62;
            const planetX = 50 + Math.cos(ph) * r;
            const planetY = 50 + Math.sin(ph) * ry;
            const rollRad = (Math.sin(now * 0.00012) * 20 * Math.PI) / 180;
            const cosR = Math.cos(rollRad);
            const sinR = Math.sin(rollRad);
            const parts = ringParticles[b.id] ?? [];

            const isIce = b.id === 'exploring';
            for (const p of parts) {
              const angle = p.baseAngle + now * p.speed;
              const lx = Math.cos(angle) * p.R;
              const ly = Math.sin(angle) * p.R * RING_TILT_RATIO;
              const wx = planetX + cosR * lx - sinR * ly;
              const wy = planetY + sinR * lx + cosR * ly;
              const inFront = ly >= 0;
              const { scale, ox, oy } = inFront ? front : back;
              const ctx = inFront ? frontCtx : backCtx;
              ctx.beginPath();
              ctx.arc(wx * scale + ox, wy * scale + oy, p.size * scale, 0, Math.PI * 2);
              ctx.fillStyle = inFront
                ? `rgba(${isIce ? '190,228,255' : '255,250,235'},${p.alpha.toFixed(3)})`
                : `rgba(${isIce ? '160,210,255' : '255,248,230'},${(p.alpha * 0.72).toFixed(3)})`;
              ctx.fill();
            }
          });
        }
      }

      raf = requestAnimationFrame(tick);
    };

    // Only fully pause when the tab is hidden — not on scroll out-of-view.
    // The IO just sets a visibility flag so draw calls are skipped without
    // stopping the RAF, which avoids the cold-start compositing cost on re-entry.
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0].isIntersecting;
      },
      { threshold: 0.01 },
    );
    if (backCanvas) io.observe(backCanvas);

    last = performance.now();
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
      io.disconnect();
    };
  }, [bodies, ringParticles, reduced]);

  const canvasStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
  };

  return (
    <div className={s.orbitWrap}>
      <div className={s.orbit} aria-hidden="true" style={{ position: 'relative' }}>
        <div className={s.orbitBgglow} />
        <canvas ref={ringBackCanvasRef} style={canvasStyle} aria-hidden="true" />
        <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
          <defs>
            <radialGradient id="sun-core" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fff9c4" />
              <stop offset="38%" stopColor="#FFC700" />
              <stop offset="100%" stopColor="#F97316" />
            </radialGradient>
            <radialGradient id="sun-flare" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(255,199,0,0.55)" />
              <stop offset="50%" stopColor="rgba(244,114,80,0.18)" />
              <stop offset="100%" stopColor="rgba(244,114,80,0)" />
            </radialGradient>
            {bodies.map((b) => (
              <radialGradient key={b.id} id={`planet-${b.id}`}>
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
                <stop offset="32%" stopColor={b.color} stopOpacity="0.95" />
                <stop offset="100%" stopColor={b.color} stopOpacity="0.55" />
              </radialGradient>
            ))}
          </defs>

          <g className={s.orbitStars}>
            {stars.map((star) => (
              <circle
                key={star.key}
                cx={star.x}
                cy={star.y}
                r={star.r}
                fill="#fff"
                style={{
                  opacity: star.o,
                  animation: reduced
                    ? undefined
                    : `orbit-twinkle ${star.d}s ease-in-out ${star.key * 0.13}s infinite`,
                }}
              />
            ))}
          </g>

          <g ref={dialRef} className={s.orbitDial} transform="rotate(0 50 50)">
            {Array.from({ length: 60 }, (_, i) => {
              const a = (i / 60) * Math.PI * 2;
              const r0 = 47.5;
              const r1 = i % 5 === 0 ? 49.2 : 48.5;
              return (
                <line
                  key={i}
                  x1={50 + Math.cos(a) * r0}
                  y1={50 + Math.sin(a) * r0}
                  x2={50 + Math.cos(a) * r1}
                  y2={50 + Math.sin(a) * r1}
                  stroke="rgba(229,231,235,0.18)"
                  strokeWidth={i % 5 === 0 ? 0.18 : 0.1}
                />
              );
            })}
            {[
              { a: -90, t: 'N' },
              { a: 0, t: 'E' },
              { a: 90, t: 'S' },
              { a: 180, t: 'W' },
            ].map(({ a, t }) => {
              const rad = (a * Math.PI) / 180;
              return (
                <text
                  key={t}
                  x={50 + Math.cos(rad) * 46.4}
                  y={50 + Math.sin(rad) * 46.4 + 0.7}
                  fontSize="1.8"
                  textAnchor="middle"
                  fill="rgba(229,231,235,0.32)"
                  fontFamily="var(--font-mono)"
                  letterSpacing="0.1em"
                >
                  {t}
                </text>
              );
            })}
          </g>

          {[0.18, 0.63].map((rr, i) => (
            <ellipse
              key={'pring-' + i}
              cx="50"
              cy="50"
              rx={rr * 100}
              ry={rr * 62}
              fill="none"
              stroke="rgba(148, 163, 184, 0.09)"
              strokeWidth="0.18"
            />
          ))}

          {bodies.map((b) => (
            <ellipse
              key={'orbit-' + b.id}
              className={s.orbitRing}
              cx="50"
              cy="50"
              rx={b.orbitR * 100}
              ry={b.orbitR * 62}
              style={
                hoverId === b.id
                  ? { stroke: b.color, opacity: 0.7, strokeDasharray: '2 3' }
                  : undefined
              }
            />
          ))}

          <g className={s.orbitSun}>
            <circle cx="50" cy="50" r="16" fill="url(#sun-flare)" opacity="0.7" />
            <circle cx="50" cy="50" r="11" fill="url(#sun-flare)" opacity="0.85" />
            <circle className={s.sunCore} cx="50" cy="50" r="5.4" fill="url(#sun-core)" />
            <circle cx="48.2" cy="48.4" r="1.4" fill="rgba(255, 255, 255, 0.6)" />
          </g>

          {bodies.map((b) => (
            <g
              key={'planet-' + b.id}
              className={s.planetGroup}
              style={{ color: b.color }}
              onMouseEnter={() => setHoverId(b.id)}
              onMouseLeave={() => setHoverId(null)}
            >
              <circle
                ref={(el) => {
                  planetRefs.current[b.id] = el;
                }}
                className={s.planet}
                cx={50 + Math.cos(b.phase) * b.orbitR * 100}
                cy={50 + Math.sin(b.phase) * b.orbitR * 62}
                r={b.radius}
                fill={`url(#planet-${b.id})`}
              />
            </g>
          ))}
          <circle ref={moon1Ref} cx="50" cy="50" r={0.64} fill="rgba(190,228,255,0.90)" />
          <circle ref={moon2Ref} cx="50" cy="50" r={0.88} fill="rgba(190,228,255,0.82)" />
        </svg>
        <canvas ref={ringFrontCanvasRef} style={canvasStyle} aria-hidden="true" />
        <div className={s.orbitReadoutCorner}>
          <span>orbit / now</span>
          <span className={s.dot} />
          <span>sun + 3 bodies</span>
        </div>
      </div>

      <div className={s.orbitReadout}>
        {bodies.map((b) => (
          <div
            key={b.id}
            className={s.orbitCard}
            data-active={hoverId === b.id ? 'true' : 'false'}
            onMouseEnter={() => setHoverId(b.id)}
            onMouseLeave={() => setHoverId(null)}
          >
            <div className={s.label} style={{ color: b.color }}>
              <span className={s.dot} style={{ background: b.color }} />
              <span style={{ color: 'rgba(229,231,235,0.62)' }}>{b.label}</span>
            </div>
            <div className={s.name}>{b.name}</div>
            <div className={s.note}>{b.note}</div>
            <div className={s.meta}>
              {b.meta.map((m, i) => (
                <span key={i}>
                  {m}
                  {i < b.meta.length - 1 ? ',' : ''}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
