import { useEffect, useRef, useState } from 'react';
import { computeStardate } from '@/lib/stardate';
import { useReducedComplexity } from '@/lib/useReducedComplexity';
import s from './Splash.module.css';

const warpLines = Array.from({ length: 38 }, (_, i) => {
  const x = (i * 27.7) % 100;
  const yJitter = ((i * 41.3) % 80) - 40;
  const len = 28 + ((i * 13) % 18);
  return { x, yJitter, len, key: i };
});

export default function Splash() {
  const innerRef = useRef<HTMLDivElement>(null);
  const eyebrowRef = useRef<HTMLDivElement>(null);
  const subRef = useRef<HTMLDivElement>(null);
  const horizonRef = useRef<HTMLDivElement>(null);
  const warpRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLButtonElement>(null);
  const stardateRef = useRef<HTMLSpanElement>(null);
  const reduced = useReducedComplexity();
  const programmaticScrollRef = useRef(false);
  const snapRafRef = useRef(0);

  useEffect(() => {
    const tick = () => {
      if (stardateRef.current) stardateRef.current.textContent = computeStardate();
    };
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const y = window.scrollY || 0;
      const vh = window.innerHeight || 800;
      const p = Math.min(1, Math.max(0, y / (vh * 0.9)));
      const pe = p * p;

      if (innerRef.current) {
        innerRef.current.style.opacity = String(1 - p * 1.05);
        innerRef.current.style.transform = `translateY(${-p * 70}px) scale(${1 + p * 0.06})`;
      }
      if (eyebrowRef.current) {
        eyebrowRef.current.style.transform = `translateY(${-p * 140}px)`;
        eyebrowRef.current.style.opacity = String(Math.max(0, 1 - p * 2.4));
      }
      if (subRef.current) {
        subRef.current.style.transform = `translateY(${-p * 30}px) scale(${1 + p * 0.18})`;
        subRef.current.style.opacity = String(Math.max(0, 1 - p * 1.7));
      }
      if (horizonRef.current) {
        const peakAt = vh * 0.95;
        const fadeEnd = vh * 2.6;
        let hp: number;
        if (y < peakAt) hp = y / peakAt;
        else hp = Math.max(0, 1 - (y - peakAt) / (fadeEnd - peakAt));
        const hpEased = 1 - Math.pow(1 - hp, 1.8);
        horizonRef.current.style.opacity = String(hpEased);
        horizonRef.current.style.transform = `translateY(${(1 - hpEased) * 14}vh)`;
      }
      if (warpRef.current) {
        const wIn = Math.max(0, Math.min(1, (p - 0.02) / 0.23));
        const wOut = Math.max(0, Math.min(1, 1 - (p - 0.75) / 0.2));
        const wAmt = Math.min(wIn, wOut);
        warpRef.current.style.opacity = String(wAmt);
        warpRef.current.style.transform = `translateY(${-wIn * 28}vh)`;
      }
      if (hintRef.current) {
        hintRef.current.style.opacity = String(Math.max(0, 1 - p * 2.8));
        hintRef.current.style.transform = `translateY(${p * 24}px)`;
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', update);
    };
  }, [reduced]);

  // Scroll-snap for the first two sections (splash → hero)
  useEffect(() => {
    let scrollDir: 'up' | 'down' = 'down';
    let lastScrollY = window.scrollY;
    let snapTimer: ReturnType<typeof setTimeout> | null = null;

    const smoothSnapTo = (target: number) => {
      if (programmaticScrollRef.current) return;
      cancelAnimationFrame(snapRafRef.current);
      const startY = window.scrollY;
      const dist = target - startY;
      if (Math.abs(dist) < 2) return;
      const duration = 2400;
      const startT = performance.now();
      const ease = (t: number) => 1 - Math.pow(1 - t, 2.5);
      programmaticScrollRef.current = true;
      const tick = (now: number) => {
        const t = Math.min(1, (now - startT) / duration);
        window.scrollTo(0, startY + dist * ease(t));
        if (t < 1) snapRafRef.current = requestAnimationFrame(tick);
        else programmaticScrollRef.current = false;
      };
      snapRafRef.current = requestAnimationFrame(tick);
    };

    const snap = () => {
      const y = window.scrollY;
      const vh = window.innerHeight;
      // Only snap while between the two snap points
      if (y <= 0 || y >= vh) return;
      smoothSnapTo(scrollDir === 'down' ? vh : 0);
    };

    const onScroll = () => {
      const currentY = window.scrollY;
      if (currentY !== lastScrollY) {
        scrollDir = currentY > lastScrollY ? 'down' : 'up';
        lastScrollY = currentY;
      }
      cancelAnimationFrame(snapRafRef.current);
      if (snapTimer) clearTimeout(snapTimer);
      snapTimer = setTimeout(snap, 120);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (snapTimer) clearTimeout(snapTimer);
      cancelAnimationFrame(snapRafRef.current);
    };
  }, []);

  const onClickHint = () => {
    const heroEl = document.querySelector('.hero') as HTMLElement | null;
    const target = heroEl
      ? heroEl.getBoundingClientRect().top + (window.scrollY || 0)
      : window.innerHeight || 800;
    if (reduced) {
      window.scrollTo(0, target);
      return;
    }
    const startY = window.scrollY || 0;
    const dist = target - startY;
    if (Math.abs(dist) < 2) return;
    const duration = 900;
    const startT = performance.now();
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    cancelAnimationFrame(snapRafRef.current);
    programmaticScrollRef.current = true;
    const tick = (now: number) => {
      const t = Math.min(1, (now - startT) / duration);
      window.scrollTo(0, startY + dist * ease(t));
      if (t < 1) requestAnimationFrame(tick);
      else programmaticScrollRef.current = false;
    };
    requestAnimationFrame(tick);
  };

  return (
    <section className={s.splash} aria-label="welcome" data-accent="cosmic">
      <div ref={warpRef} className={s.splashWarp} aria-hidden="true">
        {warpLines.map((l) => (
          <span
            key={l.key}
            className={s.warpLine}
            style={{ left: `${l.x}%`, top: `calc(50% + ${l.yJitter}vh)`, height: `${l.len}vh` }}
          />
        ))}
      </div>

      <div ref={horizonRef} className={s.splashHorizon} aria-hidden="true" />

      <div ref={innerRef} className={s.splashInner}>
        <div ref={eyebrowRef} className={s.splashEyebrow}>
          <span className={s.dot} />
          <span>
            singapore, 1.3°n, stardate{' '}
            <span className={s.stardateNum} ref={stardateRef} suppressHydrationWarning>
              {computeStardate()}
            </span>
          </span>
        </div>
        <h1 className={s.splashHello}>
          Hello, I'm <em>Daniel</em>
        </h1>
        <div ref={subRef} className={s.splashSub}>
          <span>Welcome to my portfolio site!</span>
        </div>
      </div>

      <button
        ref={hintRef}
        onClick={onClickHint}
        className={s.splashScrollhint}
        type="button"
        aria-label="descent into the nebula"
      >
        <span>descent into the nebula</span>
        <svg
          className={s.chev}
          width="34"
          height="34"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
    </section>
  );
}
