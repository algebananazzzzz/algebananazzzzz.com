// Geometry for the orrery, computed once at build time so the island
// ships fixed coordinates instead of running a force simulation in the browser.

export const ORRERY_W = 160;
export const ORRERY_H = 100;
// Link paths are emitted in units this many times larger and scaled back down in the
// island. Chromium flattens a curve in its local units, so a quad spanning ~20 units
// under a 15x+ transform renders as visibly joined straight segments.
export const LINK_SCALE = 10;

export type OrreryProjectInput = {
  id: string;
  name: string;
  cluster: string;
  tech: string[];
  featured?: boolean;
};
export type OrreryClusterInput = { id: string; label: string; color: string };
export type OrreryDomainInput = {
  id: string;
  label: string;
  tint: string;
  techs: Record<string, string>;
};

export type OrreryDomain = { id: string; label: string; tint: string; x: number; y: number };
export type OrreryTech = {
  id: string;
  label: string;
  domain: string;
  x: number;
  y: number;
  r: number;
  total: number;
};
export type OrreryProject = {
  id: string;
  name: string;
  cluster: string;
  tech: string[];
  featured: boolean;
  x: number;
  y: number;
  r: number;
};
export type OrreryLink = { project: string; tech: string; d: string };
export type OrreryData = {
  domains: OrreryDomain[];
  clusters: OrreryClusterInput[];
  techs: OrreryTech[];
  projects: OrreryProject[];
  links: OrreryLink[];
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
};

type SimNode = {
  id: string;
  kind: 'tech' | 'project';
  x: number;
  y: number;
  vx: number;
  vy: number;
  ax: number;
  ay: number;
};

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
// Two decimals is sub-pixel at any zoom the map allows and keeps the props payload small.
const round2 = (v: number) => Math.round(v * 100) / 100;

function validate(
  projects: OrreryProjectInput[],
  clusters: OrreryClusterInput[],
  domains: OrreryDomainInput[],
) {
  const owner = new Map<string, string>();
  for (const d of domains) {
    for (const id of Object.keys(d.techs)) {
      const prev = owner.get(id);
      if (prev) throw new Error(`Tech "${id}" is listed under both "${prev}" and "${d.id}".`);
      owner.set(id, d.id);
    }
  }
  const clusterIds = new Set(clusters.map((c) => c.id));
  for (const p of projects) {
    if (!clusterIds.has(p.cluster)) {
      throw new Error(`Project "${p.id}" is in unknown cluster "${p.cluster}".`);
    }
    for (const t of p.tech) {
      if (!owner.has(t)) {
        throw new Error(
          `Project "${p.id}" uses unknown tech "${t}". Add it to src/content/technologies.yaml.`,
        );
      }
    }
  }
}

// Domains alternate between an upper and lower band, left to right in file order.
function placeDomains(domains: OrreryDomainInput[]) {
  return domains.map((d, i) => ({
    id: d.id,
    label: d.label,
    tint: d.tint,
    x: (ORRERY_W * (i + 0.5)) / domains.length,
    y: domains.length === 1 ? ORRERY_H / 2 : i % 2 === 0 ? 30 : 72,
  }));
}

// Beacons are anchored to their domain, projects are pulled toward every tech
// they use, and everything repels.
function simulate(projects: OrreryProjectInput[], domains: OrreryDomainInput[]) {
  const rnd = rand(42);
  const anchors = placeDomains(domains);
  const nodes = new Map<string, SimNode>();
  domains.forEach((d, di) => {
    const { x: ax, y: ay } = anchors[di];
    const ids = Object.keys(d.techs);
    const off = rnd() * Math.PI * 2;
    ids.forEach((id, i) => {
      const a = off + (i / ids.length) * Math.PI * 2;
      const r = ids.length === 1 ? 0 : 7 + rnd() * 4;
      nodes.set(id, {
        id,
        kind: 'tech',
        x: ax + Math.cos(a) * r,
        y: ay + Math.sin(a) * r * 0.75,
        vx: 0,
        vy: 0,
        ax,
        ay,
      });
    });
  });
  for (const p of projects) {
    const ts = p.tech.map((id) => nodes.get(id)!);
    const x = ts.reduce((s, n) => s + n.x, 0) / ts.length;
    const y = ts.reduce((s, n) => s + n.y, 0) / ts.length;
    nodes.set(p.id, {
      id: p.id,
      kind: 'project',
      x: x + (rnd() - 0.5) * 8,
      y: y + (rnd() - 0.5) * 8,
      vx: 0,
      vy: 0,
      ax: 0,
      ay: 0,
    });
  }

  const arr = [...nodes.values()];
  const ITER = 420;
  for (let it = 0; it < ITER; it++) {
    const alpha = 1 - it / ITER;
    for (const n of arr) {
      n.vx = 0;
      n.vy = 0;
    }
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const a = arr[i];
        const b = arr[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = Math.max(dx * dx + dy * dy, 0.5);
        const d = Math.sqrt(d2);
        if (d > 45) continue;
        const rep =
          a.kind === 'tech' && b.kind === 'tech'
            ? 70
            : a.kind === 'tech' || b.kind === 'tech'
              ? 24
              : 20;
        const f = rep / d2;
        a.vx -= (dx / d) * f;
        a.vy -= (dy / d) * f;
        b.vx += (dx / d) * f;
        b.vy += (dy / d) * f;
      }
    }
    for (const p of projects) {
      const pn = nodes.get(p.id)!;
      for (const tid of p.tech) {
        const tn = nodes.get(tid)!;
        const dx = tn.x - pn.x;
        const dy = tn.y - pn.y;
        const d = Math.hypot(dx, dy) || 0.01;
        const f = (d - 9) * 0.05;
        pn.vx += (dx / d) * f;
        pn.vy += (dy / d) * f;
        tn.vx -= (dx / d) * f * 0.18;
        tn.vy -= (dy / d) * f * 0.18;
      }
    }
    for (const n of arr) {
      if (n.kind === 'tech') {
        n.vx += (n.ax - n.x) * 0.03;
        n.vy += (n.ay - n.y) * 0.03;
      }
      let vx = n.vx * alpha;
      let vy = n.vy * alpha;
      const m = Math.hypot(vx, vy);
      if (m > 2) {
        vx *= 2 / m;
        vy *= 2 / m;
      }
      n.x = clamp(n.x + vx, 9, ORRERY_W - 9);
      n.y = clamp(n.y + vy, 8, ORRERY_H - 9);
    }
  }
  return { nodes, anchors };
}

export function buildOrrery(
  projectInputs: OrreryProjectInput[],
  clusters: OrreryClusterInput[],
  domainInputs: OrreryDomainInput[],
): OrreryData {
  validate(projectInputs, clusters, domainInputs);
  const { nodes, anchors } = simulate(projectInputs, domainInputs);
  const at = (id: string) => {
    const n = nodes.get(id)!;
    return { x: round2(n.x), y: round2(n.y) };
  };

  const techs = domainInputs.flatMap((d) =>
    Object.entries(d.techs).map(([id, label]) => {
      const total = projectInputs.filter((p) => p.tech.includes(id)).length;
      return { id, label, domain: d.id, ...at(id), r: round2(0.55 + total * 0.17), total };
    }),
  );
  const projects = projectInputs.map((p) => ({
    id: p.id,
    name: p.name,
    cluster: p.cluster,
    tech: p.tech,
    featured: !!p.featured,
    ...at(p.id),
    r: round2(0.32 + p.tech.length * 0.06),
  }));

  const rnd = rand(7);
  const links = projects.flatMap((p) =>
    p.tech.map((tid) => {
      const b = at(tid);
      const mx = (p.x + b.x) / 2;
      const my = (p.y + b.y) / 2;
      const dx = b.x - p.x;
      const dy = b.y - p.y;
      const s = (rnd() - 0.5) * 0.35;
      const u = (v: number) => round2(v * LINK_SCALE);
      return {
        project: p.id,
        tech: tid,
        d: `M${u(p.x)} ${u(p.y)}Q${u(mx - dy * s)} ${u(my + dx * s)} ${u(b.x)} ${u(b.y)}`,
      };
    }),
  );

  const all = [...techs, ...projects];
  const xs = all.map((n) => n.x);
  const ys = all.map((n) => n.y);
  const bounds = {
    minX: round2(Math.min(...xs) - 9),
    maxX: round2(Math.max(...xs) + 9),
    minY: round2(Math.min(...ys) - 9),
    maxY: round2(Math.max(...ys) + 9),
  };

  return {
    domains: anchors.map((d) => ({ ...d, x: round2(d.x), y: round2(d.y) })),
    clusters,
    techs,
    projects,
    links,
    bounds,
  };
}
