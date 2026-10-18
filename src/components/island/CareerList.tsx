import { useState, type CSSProperties } from 'react';
import s from './CareerList.module.css';

export interface StarData {
  stellarClass: string;
  classDesc: string;
  color: string;
  accent: string;
  glow: string;
  sizeMul: number;
  bri: number;
}

export interface CareerEntry {
  id: string;
  date: string;
  role: string;
  org: string;
  summary: string;
  bullets?: string[];
  tags: string[];
  star: StarData;
}

const BASE_SIZE = 12;

export default function CareerList({ entries }: { entries: CareerEntry[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const list = entries.map((e) => ({
    ...e,
    ...e.star,
  }));

  return (
    <div className={s.careerList}>
      {list.map((e, idx) => {
        const isOpen = idx === openIndex;
        const starSize = Math.round(BASE_SIZE * e.sizeMul);
        const cssBri = e.bri / 5;
        const next = list[idx + 1];
        const nextBri = next ? next.bri / 5 : 0;
        const style = {
          '--row-color': e.color,
          '--row-glow': e.glow,
          '--row-accent': e.accent,
          '--star-size': `${starSize}px`,
          '--star-bri': cssBri,
          '--next-row-color': next ? next.color : e.color,
          '--next-star-bri': nextBri,
        } as CSSProperties;

        return (
          <button
            key={e.id}
            type="button"
            onClick={() => setOpenIndex(isOpen ? null : idx)}
            aria-expanded={isOpen}
            className={`${s.careerRow} ${isOpen ? s.open : ''}`}
            style={style}
          >
            <div className={s.rowHead}>
              <span className={s.star} aria-hidden="true">
                <span className={s.starCore} />
              </span>
              <span className={s.date}>{e.date}</span>
              <span className={s.role}>
                {e.role}
                <span className={s.orgSep}>at</span>
                <span className={s.org}>{e.org}</span>
              </span>
              <span className={s.class}>{e.stellarClass.toLowerCase()}</span>
              <svg
                className={s.chev}
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </div>
            <div className={s.rowBody}>
              <div className={s.bodyInner}>
                <p className={s.summary}>{e.summary}</p>
                {e.bullets && e.bullets.length > 0 && (
                  <ul className={s.careerBullets}>
                    {e.bullets.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                )}
                <div className={s.rowMeta}>
                  <span className={s.classDesc}>
                    <span className={s.swatch} style={{ background: e.color, color: e.color }} />
                    {e.classDesc}
                  </span>
                  {e.tags.length > 0 && (
                    <div className={s.tags}>
                      {e.tags.map((tag) => (
                        <span key={tag} className="tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
