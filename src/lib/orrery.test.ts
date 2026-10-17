import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';
import {
  buildOrrery,
  type OrreryClusterInput,
  type OrreryDomainInput,
  type OrreryProjectInput,
} from './orrery';

const domains: OrreryDomainInput[] = [
  { id: 'cloud', label: 'Cloud', tint: '#6366f1', techs: { aws: 'AWS', terraform: 'Terraform' } },
  { id: 'backend', label: 'Backend', tint: '#e11d48', techs: { go: 'Go', python: 'Python' } },
  { id: 'frontend', label: 'Frontend', tint: '#14b8a6', techs: { react: 'React' } },
];
const clusters: OrreryClusterInput[] = [{ id: 'general', label: 'General', color: '#fde047' }];
const project = (id: string, tech: string[], cluster = 'general'): OrreryProjectInput => ({
  id,
  name: id,
  cluster,
  tech,
});
const projects = [
  project('a', ['aws', 'terraform', 'go']),
  project('b', ['go', 'python']),
  project('c', ['react', 'aws']),
  project('d', ['react']),
];

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

describe('buildOrrery', () => {
  it('is deterministic across builds', () => {
    expect(buildOrrery(projects, clusters, domains)).toEqual(
      buildOrrery(projects, clusters, domains),
    );
  });

  it('keeps every beacon nearest its own domain anchor', () => {
    const { techs, domains: placed } = buildOrrery(projects, clusters, domains);
    for (const t of techs) {
      const nearest = placed.reduce((best, d) => (dist(t, d) < dist(t, best) ? d : best));
      expect(nearest.id).toBe(t.domain);
    }
  });

  it('pulls each project closer to its own techs than to the rest', () => {
    const { techs, projects: placed } = buildOrrery(projects, clusters, domains);
    for (const p of placed) {
      const mine = techs.filter((t) => p.tech.includes(t.id));
      const others = techs.filter((t) => !p.tech.includes(t.id));
      const mean = (ts: typeof techs) => ts.reduce((s, t) => s + dist(p, t), 0) / ts.length;
      expect(mean(mine)).toBeLessThan(mean(others));
    }
  });

  it('counts projects per beacon and links each project to each tech', () => {
    const { techs, links } = buildOrrery(projects, clusters, domains);
    expect(techs.find((t) => t.id === 'aws')!.total).toBe(2);
    expect(techs.find((t) => t.id === 'python')!.total).toBe(1);
    expect(links).toHaveLength(projects.reduce((s, p) => s + p.tech.length, 0));
  });

  it('marks only the projects flagged as featured', () => {
    const flagged = [{ ...project('a', ['go']), featured: true }, project('b', ['go'])];
    const placed = buildOrrery(flagged, clusters, domains).projects;
    expect(placed.map((p) => [p.id, p.featured])).toEqual([
      ['a', true],
      ['b', false],
    ]);
  });

  it('rejects a project that uses an unknown tech', () => {
    expect(() => buildOrrery([project('x', ['cobol'])], clusters, domains)).toThrow(
      /"x" uses unknown tech "cobol"/,
    );
  });

  it('rejects a project in an unknown cluster', () => {
    expect(() => buildOrrery([project('x', ['go'], 'nope')], clusters, domains)).toThrow(
      /"x" is in unknown cluster "nope"/,
    );
  });

  it('rejects a tech id listed under two domains', () => {
    const dup = [...domains, { id: 'more', label: 'More', tint: '#fff', techs: { go: 'Go' } }];
    expect(() => buildOrrery(projects, clusters, dup)).toThrow(/"go" is listed under both/);
  });
});

describe('repository content', () => {
  it('builds an orrery from projects.yaml and technologies.yaml', () => {
    const p = load(readFileSync('src/content/projects.yaml', 'utf8')) as {
      clusters: Record<string, { label: string; color: string }>;
      featured: string[];
      projects: OrreryProjectInput[];
    };
    const ids = p.projects.map((x) => x.id);
    expect(p.featured.filter((id) => !ids.includes(id))).toEqual([]);
    const t = load(readFileSync('src/content/technologies.yaml', 'utf8')) as {
      domains: Record<string, Omit<OrreryDomainInput, 'id'>>;
    };
    const orrery = buildOrrery(
      p.projects,
      Object.entries(p.clusters).map(([id, c]) => ({ id, ...c })),
      Object.entries(t.domains).map(([id, d]) => ({ id, ...d })),
    );
    expect(orrery.projects).toHaveLength(p.projects.length);
  });
});
