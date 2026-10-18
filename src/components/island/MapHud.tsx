import { useEffect, useState } from 'react';
import s from './MapHud.module.css';

/**
 * Lets a map frame fill the screen. The CSS overlay is the fullscreen; native
 * fullscreen is requested on top of it to hide the browser chrome where allowed.
 */
export function useMapFullscreen(): [boolean, () => void] {
  const [fs, setFs] = useState(false);

  useEffect(() => {
    if (!fs) return;
    const html = document.documentElement;
    html.classList.add(s.lock);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFs(false);
    };
    const onChange = () => {
      if (!document.fullscreenElement) setFs(false);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      html.classList.remove(s.lock);
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onChange);
    };
  }, [fs]);

  const toggle = () => {
    const next = !fs;
    setFs(next);
    // A refusal (iframes, iOS Safari) leaves the CSS overlay, which is the fullscreen anyway.
    if (next && !document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    }
    if (!next && document.fullscreenElement) document.exitFullscreen().catch(() => {});
  };

  return [fs, toggle];
}

type Props = { label: string; fs: boolean; onToggle: () => void; className: string };

export default function MapHud({ label, fs, onToggle, className }: Props) {
  return (
    <div className={`${s.hud} ${className}`}>
      <span className={s.label}>{label}</span>
      <button
        type="button"
        className={s.btn}
        onClick={onToggle}
        aria-label={fs ? 'Exit fullscreen' : 'Fullscreen'}
        title={fs ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {fs ? (
            <>
              <path d="M9 4v5H4" />
              <path d="M15 4v5h5" />
              <path d="M9 20v-5H4" />
              <path d="M15 20v-5h5" />
            </>
          ) : (
            <>
              <path d="M4 9V4h5" />
              <path d="M20 9V4h-5" />
              <path d="M4 15v5h5" />
              <path d="M20 15v5h-5" />
            </>
          )}
        </svg>
      </button>
    </div>
  );
}
