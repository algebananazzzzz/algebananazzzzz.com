import { getCollection } from 'astro:content';
import type { CollectionEntry } from 'astro:content';
import type { CareerEntry } from '@/components/island/CareerList';
import starsData from './stars.json';

type StarRecord = {
  name: string;
  stellarClass: string;
  classDesc: string;
  color: string;
  accent?: string;
  glow: string;
  sizeMul: number;
  bri: number;
};

const starsById = new Map((starsData as StarRecord[]).map((s) => [s.name, s]));

export async function getCareerEntries(limit?: number): Promise<CareerEntry[]> {
  const expEntries = await getCollection('experience');
  let exps: CollectionEntry<'experience'>['data'][] = expEntries.map(
    (e: CollectionEntry<'experience'>) => e.data,
  );

  if (limit !== undefined) {
    exps = exps.slice(0, limit);
  }

  return exps.map((e) => {
    const star = starsById.get(e.star);
    if (!star) throw new Error(`No entry in stars.json for star type "${e.star}" (${e.id}).`);
    return {
      id: e.id,
      date: e.date,
      role: e.role,
      org: e.org,
      summary: e.summary,
      bullets: e.bullets,
      tags: e.tags,
      star: {
        stellarClass: star.stellarClass,
        classDesc: star.classDesc,
        color: star.color,
        accent: star.accent ?? star.color,
        glow: star.glow,
        sizeMul: star.sizeMul,
        bri: star.bri,
      },
    };
  });
}
