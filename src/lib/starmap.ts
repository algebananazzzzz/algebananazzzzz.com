// Geometry for the starmap, computed once at build time like the orrery, so the
// island ships fixed coordinates instead of running a force simulation in the browser.
import { LINK_SCALE } from './orrery';

export const STARMAP_W = 160;
export const STARMAP_H = 100;

export type StarmapPageInput = {
  id: string;
  title: string;
  description: string;
  color?: string;
  quotes?: string[];
  links?: string[];
  children?: StarmapPageInput[];
};
export type StarmapInput = { shareUrl: string; pages: StarmapPageInput[] };
export type StarmapQuote = { text: string; href: string };

export type StarmapNode = {
  id: string;
  title: string;
  description: string;
  href: string;
  /** Inherited from the branch; null for the top-level pages, which are drawn in ink. */
  color: string | null;
  parent: string | null;
  depth: number;
  path: string[];
  kids: string[];
  out: string[];
  inn: string[];
  x: number;
  y: number;
  r: number;
};
export type StarmapCrossLink = { a: string; b: string; d: string };
export type StarmapData = {
  nodes: StarmapNode[];
  roots: string[];
  cross: StarmapCrossLink[];
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
};

type Sim = { x: number; y: number; vx: number; vy: number; ax?: number; ay?: number };

function rand(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const round2 = (v: number) => Math.round(v * 100) / 100;

function index(input: StarmapInput) {
  const byId = new Map<string, StarmapNode>();
  const list: StarmapNode[] = [];
  const walk = (p: StarmapPageInput, parent: StarmapNode | null) => {
    if (byId.has(p.id)) throw new Error(`Starmap page "${p.id}" appears twice.`);
    const n: StarmapNode = {
      id: p.id,
      title: p.title,
      description: p.description,
      href: `${input.shareUrl}/doc/${p.id}`,
      color: p.color ?? parent?.color ?? null,
      parent: parent?.id ?? null,
      depth: parent ? parent.depth + 1 : 0,
      path: parent ? [...parent.path, p.id] : [p.id],
      kids: (p.children ?? []).map((c) => c.id),
      out: p.links ?? [],
      inn: [],
      x: 0,
      y: 0,
      r: 0,
    };
    byId.set(n.id, n);
    list.push(n);
    for (const c of p.children ?? []) walk(c, n);
  };
  for (const p of input.pages) walk(p, null);
  for (const n of list) {
    for (const t of n.out) {
      const target = byId.get(t);
      if (!target) throw new Error(`Starmap page "${n.id}" links to unknown page "${t}".`);
      target.inn.push(n.id);
    }
  }
  return { byId, list };
}

// Top-level pages share the width in proportion to the square root of their size, then
// each page fans out away from its grandparent and a short force pass untangles the result.
function layout(byId: Map<string, StarmapNode>, list: StarmapNode[]) {
  const rnd = rand(11);
  const size = new Map<string, number>();
  const sizeOf = (id: string): number => {
    const n = byId.get(id)!;
    const s = 1 + n.kids.reduce((sum, k) => sum + sizeOf(k), 0);
    size.set(id, s);
    return s;
  };
  const roots = list.filter((n) => n.depth === 0);
  const weights = roots.map((r) => Math.sqrt(sizeOf(r.id)));
  const total = weights.reduce((a, b) => a + b, 0);
  const rest = (n: StarmapNode) =>
    n.depth === 1 ? 12 + 1.5 * Math.sqrt(size.get(n.id)!) : n.kids.length ? 11 : 8.5;

  const P = new Map<string, Sim>();
  let cum = 0;
  roots.forEach((r, i) => {
    const x = STARMAP_W * ((cum + weights[i] / 2) / total);
    cum += weights[i];
    P.set(r.id, { x, y: STARMAP_H / 2, vx: 0, vy: 0, ax: x, ay: STARMAP_H / 2 });
  });
  for (const n of list) {
    if (!n.parent) continue;
    const par = byId.get(n.parent)!;
    const p = P.get(par.id)!;
    const gp = par.parent ? P.get(par.parent)! : null;
    const i = par.kids.indexOf(n.id);
    const count = par.kids.length;
    let a: number;
    if (gp) {
      const spread = Math.min(2.6, 0.8 * count);
      a = Math.atan2(p.y - gp.y, p.x - gp.x) + (count === 1 ? 0 : (i / (count - 1) - 0.5) * spread);
    } else {
      a = -Math.PI / 2 + (i / count) * Math.PI * 2 + 0.4;
    }
    const L = rest(n);
    P.set(n.id, {
      x: p.x + Math.cos(a) * L + (rnd() - 0.5),
      y: p.y + Math.sin(a) * L * 0.85 + (rnd() - 0.5),
      vx: 0,
      vy: 0,
    });
  }

  const ITER = 360;
  for (let it = 0; it < ITER; it++) {
    const alpha = 1 - it / ITER;
    for (const p of P.values()) {
      p.vx = 0;
      p.vy = 0;
    }
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = P.get(list[i].id)!;
        const b = P.get(list[j].id)!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = Math.max(dx * dx + dy * dy, 0.4);
        const d = Math.sqrt(d2);
        if (d > 32) continue;
        const f = (list[i].kids.length || list[j].kids.length ? 34 : 22) / d2;
        a.vx -= (dx / d) * f;
        a.vy -= (dy / d) * f;
        b.vx += (dx / d) * f;
        b.vy += (dy / d) * f;
      }
    }
    for (const n of list) {
      if (!n.parent) continue;
      const c = P.get(n.id)!;
      const p = P.get(n.parent)!;
      const dx = p.x - c.x;
      const dy = p.y - c.y;
      const d = Math.hypot(dx, dy) || 0.01;
      const f = (d - rest(n)) * 0.08;
      c.vx += (dx / d) * f;
      c.vy += (dy / d) * f;
      p.vx -= (dx / d) * f * 0.25;
      p.vy -= (dy / d) * f * 0.25;
    }
    for (const n of list) {
      for (const t of n.out) {
        const a = P.get(n.id)!;
        const b = P.get(t)!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.01;
        const f = (d - 18) * 0.004;
        a.vx += (dx / d) * f;
        a.vy += (dy / d) * f;
        b.vx -= (dx / d) * f;
        b.vy -= (dy / d) * f;
      }
    }
    for (const p of P.values()) {
      if (p.ax !== undefined) {
        p.vx += (p.ax - p.x) * 0.08;
        p.vy += (p.ay! - p.y) * 0.08;
      }
      let vx = p.vx * alpha;
      let vy = p.vy * alpha;
      const m = Math.hypot(vx, vy);
      if (m > 1.5) {
        vx *= 1.5 / m;
        vy *= 1.5 / m;
      }
      p.x = clamp(p.x + vx, 8, STARMAP_W - 8);
      p.y = clamp(p.y + vy, 7, STARMAP_H - 7);
    }
  }
  return P;
}

/** Every tip-callout quote in the wiki, in page order, each linking to its page in the public wiki. */
export function collectQuotes(input: StarmapInput): StarmapQuote[] {
  const walk = (p: StarmapPageInput): StarmapQuote[] => [
    ...(p.quotes ?? []).map((text) => ({ text, href: `${input.shareUrl}/doc/${p.id}` })),
    ...(p.children ?? []).flatMap(walk),
  ];
  return input.pages.flatMap(walk);
}

export function buildStarmap(input: StarmapInput): StarmapData {
  const { byId, list } = index(input);
  const P = layout(byId, list);
  for (const n of list) {
    const p = P.get(n.id)!;
    n.x = round2(p.x);
    n.y = round2(p.y);
    const degree = n.kids.length + n.out.length + n.inn.length + (n.parent ? 1 : 0);
    n.r = n.depth === 0 ? 1.25 : round2(0.42 + Math.min(degree, 8) * 0.09);
  }

  const rnd = rand(5);
  const u = (v: number) => round2(v * LINK_SCALE);
  const cross = list.flatMap((n) =>
    n.out.map((t) => {
      const a = n;
      const b = byId.get(t)!;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const s = 0.18 + rnd() * 0.12;
      return {
        a: a.id,
        b: b.id,
        d: `M${u(a.x)} ${u(a.y)}Q${u(mx - dy * s)} ${u(my + dx * s)} ${u(b.x)} ${u(b.y)}`,
      };
    }),
  );

  const xs = list.map((n) => n.x);
  const ys = list.map((n) => n.y);
  return {
    nodes: list,
    roots: list.filter((n) => n.depth === 0).map((n) => n.id),
    cross,
    bounds: {
      // Wide enough for a label set to the side of an edge star.
      minX: round2(Math.min(...xs) - 16),
      maxX: round2(Math.max(...xs) + 16),
      minY: round2(Math.min(...ys) - 6),
      maxY: round2(Math.max(...ys) + 7),
    },
  };
}
