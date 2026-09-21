import { useEffect, useRef } from 'react';
import { useReducedComplexity } from '@/lib/useReducedComplexity';

type Star = {
  x: number;
  y: number;
  r: number;
  twinkleSeed: number;
  twinkleSpeed: number;
  alpha: number;
  depth: number;
  tint: 'warm' | 'cool' | 'neutral';
  vx: number;
  vy: number;
};

type BloomState = { starBloom: number; descent: number; streak: number };

export default function Cosmos({ isHome = false }: { isHome?: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const farRef = useRef<HTMLDivElement>(null);
  const midRef = useRef<HTMLDivElement>(null);
  const nearRef = useRef<HTMLDivElement>(null);
  const streakRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bloomState = useRef<BloomState>({ starBloom: isHome ? 0 : 1, descent: 0, streak: 0 });
  const wakeCanvas = useRef<(() => void) | null>(null);
  const reduced = useReducedComplexity();

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const y = window.scrollY || 0;
      const vh = window.innerHeight || 800;
      const p = Math.min(1.1, Math.max(0, y / (vh * 0.95)));

      let intensity: number;
      if (p < 0.7) {
        const t = p / 0.7;
        const eased = 1 - Math.pow(1 - t, 1.5);
        intensity = 0.2 + eased * 1.3;
      } else {
        const t = Math.min(1, (p - 0.7) / 0.3);
        const eased = t * t * (3 - 2 * t);
        intensity = 1.5 - eased * 0.5;
      }
      if (!isHome) intensity = 1.0;

      const starBloom = Math.min(1.4, intensity);
      let descent: number;
      if (!isHome) descent = 0;
      else if (p < 0.7) descent = p / 0.7;
      else descent = Math.max(0, 1 - (p - 0.7) / 0.3);

      let streak: number;
      if (!isHome) streak = 0;
      else {
        const sIn = Math.max(0, Math.min(1, (p - 0.02) / 0.23));
        const sOut = Math.max(0, Math.min(1, 1 - (p - 0.75) / 0.2));
        streak = Math.min(sIn, sOut);
      }

      bloomState.current.starBloom = starBloom;
      bloomState.current.descent = descent;
      bloomState.current.streak = streak;

      const wrap = wrapRef.current;
      if (wrap) {
        wrap.style.setProperty('--bloom', String(Math.min(1, intensity)));
        wrap.style.setProperty('--star-bloom', String(starBloom));
        wrap.style.setProperty('--descent', String(descent));
      }

      // Scroll parallax uses the individual `translate` property so the
      // continuous CSS keyframe drift (on `transform`) composes without
      // clobbering. `scale` is also individual; only `transform` is shared
      // with the keyframes.
      const descentBoost = 1 + descent * 1.8;
      if (farRef.current) farRef.current.style.translate = `0 ${(y * -0.04).toFixed(2)}px`;
      if (midRef.current) midRef.current.style.translate = `0 ${(y * -0.08).toFixed(2)}px`;
      if (nearRef.current) {
        nearRef.current.style.translate = `0 ${(y * -0.14 * descentBoost).toFixed(2)}px`;
        nearRef.current.style.scale = `${(1 + descent * 0.5).toFixed(3)}`;
      }
      if (streakRef.current) {
        streakRef.current.style.translate = `0 ${(y * -0.025).toFixed(2)}px`;
        streakRef.current.style.rotate = `${(y * 0.002).toFixed(3)}deg`;
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
      wakeCanvas.current?.();
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [isHome]);

  useEffect(() => {
    if (reduced) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let stars: Star[] = [];
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const seed = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      const count = isHome
        ? Math.min(220, Math.round((w * h) / 10000))
        : Math.min(520, Math.round((w * h) / 4000));
      stars = [];
      for (let i = 0; i < count; i++) {
        const depth = Math.random();
        stars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          r: (0.3 + depth * 1.6) * dpr,
          twinkleSeed: Math.random() * Math.PI * 2,
          twinkleSpeed: 0.5 + Math.random() * 1.4,
          alpha: 0.4 + depth * 0.6,
          depth,
          tint: depth > 0.85 ? 'warm' : depth > 0.6 ? 'cool' : 'neutral',
          vx: (Math.random() - 0.5) * 0.02 * (1 + depth),
          vy: (Math.random() - 0.5) * 0.02 * (1 + depth),
        });
      }
    };
    seed();

    let last = performance.now();
    let raf = 0;

    const tint = (kind: Star['tint'], a: number) => {
      if (kind === 'warm') return `rgba(253, 230, 138, ${a})`;
      if (kind === 'cool') return `rgba(186, 230, 253, ${a})`;
      return `rgba(241, 245, 249, ${a})`;
    };

    const wake = () => {
      if (!raf) raf = requestAnimationFrame(draw);
    };
    wakeCanvas.current = wake;

    const draw = (t: number) => {
      const dt = Math.min(80, t - last);
      last = t;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const warpAmount = bloomState.current.streak;
      const sb = isHome ? bloomState.current.starBloom : 1;

      for (const s of stars) {
        const threshold = 0.06 + (1 - s.depth) * 0.82;
        const local = Math.max(0, Math.min(1, (sb - threshold) / (1 - threshold + 0.0001)));
        const reveal = local * local * (3 - 2 * local);
        if (reveal < 0.01) continue;

        s.x += s.vx * dt;
        s.y += s.vy * dt;
        if (s.x < -10) s.x = canvas.width + 10;
        if (s.x > canvas.width + 10) s.x = -10;
        if (s.y < -10) s.y = canvas.height + 10;
        if (s.y > canvas.height + 10) s.y = -10;

        const tw = 0.55 + 0.45 * Math.sin(s.twinkleSeed + t * 0.001 * s.twinkleSpeed);
        const a = s.alpha * tw * reveal;

        if (warpAmount > 0.01) {
          const len = warpAmount * (24 + s.depth * 60) * dpr;
          const grad = ctx.createLinearGradient(s.x, s.y, s.x, s.y + len);
          grad.addColorStop(0, tint(s.tint, a));
          grad.addColorStop(1, tint(s.tint, 0));
          ctx.strokeStyle = grad;
          ctx.lineWidth = s.r;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(s.x, s.y + len);
          ctx.stroke();
        }

        ctx.fillStyle = tint(s.tint, a);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (sb > 0.01 || bloomState.current.streak > 0.01) {
        raf = requestAnimationFrame(draw);
      } else {
        raf = 0;
      }
    };
    if (!document.hidden) raf = requestAnimationFrame(draw);

    const onResize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      seed();
    };
    const onVisibility = () => {
      if (document.hidden) {
        if (raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      } else {
        if (!raf && (bloomState.current.starBloom > 0.01 || bloomState.current.streak > 0.01)) {
          last = performance.now();
          raf = requestAnimationFrame(draw);
        }
      }
    };
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      wakeCanvas.current = null;
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [reduced, isHome]);

  return (
    <div className="cosmos" aria-hidden="true" ref={wrapRef}>
      <div className="layer nebula-far" ref={farRef} />
      <div className="layer mw-streak" ref={streakRef} />
      <div className="layer nebula-mid" ref={midRef} />
      <div className="layer nebula-near" ref={nearRef} />
      <canvas ref={canvasRef} />
      <div className="layer vignette" />
    </div>
  );
}
