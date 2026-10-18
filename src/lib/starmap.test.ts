import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { buildStarmap, collectQuotes, STARMAP_H, STARMAP_W, type StarmapInput } from './starmap';

const page = (id: string, children: StarmapInput['pages'] = [], extra = {}) => ({
  id,
  title: id,
  description: `${id} page`,
  ...extra,
  ...(children.length ? { children } : {}),
});

const input: StarmapInput = {
  shareUrl: 'https://outline.example/s/abc',
  pages: [
    page('lab', [
      page('net', [page('dns'), page('vlan')], { color: '#007B69' }),
      page('svc', [], { color: '#006C4E', links: ['os'], quotes: ['Ship it, then watch it.'] }),
    ]),
    page('know', [
      page(
        'os',
        [
          page('mem', [], { quotes: ['Pages are promises.', 'Swap is a confession.'] }),
          page('cpu'),
          page('io'),
        ],
        {
          color: '#854299',
        },
      ),
      page('go', [], { color: '#0073A1', links: ['cpu'] }),
    ]),
  ],
};

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

describe('buildStarmap', () => {
  it('is deterministic across builds', () => {
    expect(buildStarmap(input)).toEqual(buildStarmap(input));
  });

  it('lists pages in tree order with paths, share links and branch colours', () => {
    const { nodes, roots } = buildStarmap(input);
    expect(nodes.map((n) => n.id)).toEqual([
      'lab',
      'net',
      'dns',
      'vlan',
      'svc',
      'know',
      'os',
      'mem',
      'cpu',
      'io',
      'go',
    ]);
    expect(roots).toEqual(['lab', 'know']);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    expect(byId.get('dns')).toMatchObject({
      path: ['lab', 'net', 'dns'],
      color: '#007B69',
      href: 'https://outline.example/s/abc/doc/dns',
    });
    expect(byId.get('lab')!.color).toBeNull();
    expect(byId.get('cpu')!.inn).toEqual(['go']);
  });

  it('keeps every star inside the field and each constellation on its own side', () => {
    const { nodes } = buildStarmap(input);
    for (const n of nodes) {
      expect(n.x).toBeGreaterThanOrEqual(8);
      expect(n.x).toBeLessThanOrEqual(STARMAP_W - 8);
      expect(n.y).toBeGreaterThanOrEqual(7);
      expect(n.y).toBeLessThanOrEqual(STARMAP_H - 7);
    }
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const lab = byId.get('lab')!;
    const know = byId.get('know')!;
    for (const n of nodes.filter((n) => n.depth > 0)) {
      const root = byId.get(n.path[0])!;
      const other = root === lab ? know : lab;
      expect(dist(n, root)).toBeLessThan(dist(n, other));
    }
  });

  it('draws one curve per cross-link', () => {
    const { cross } = buildStarmap(input);
    expect(cross.map((c) => [c.a, c.b])).toEqual([
      ['svc', 'os'],
      ['go', 'cpu'],
    ]);
  });

  it('rejects a duplicate page and a link to an unknown page', () => {
    const dup = { ...input, pages: [page('a', [page('b')]), page('b')] };
    expect(() => buildStarmap(dup)).toThrow(/"b" appears twice/);
    const dangling = { ...input, pages: [page('a', [], { links: ['ghost'] })] };
    expect(() => buildStarmap(dangling)).toThrow(/"a" links to unknown page "ghost"/);
  });

  it('lays out the generated starmap.yaml', () => {
    const real = load(readFileSync('src/content/starmap.yaml', 'utf8')) as StarmapInput;
    const { nodes } = buildStarmap(real);
    expect(nodes.length).toBeGreaterThan(0);
    expect(nodes.filter((n) => n.depth === 1).every((n) => n.color)).toBe(true);
  });
});

describe('collectQuotes', () => {
  it('gathers every quote in page order with a link to its page in the wiki', () => {
    expect(collectQuotes(input)).toEqual([
      { text: 'Ship it, then watch it.', href: 'https://outline.example/s/abc/doc/svc' },
      { text: 'Pages are promises.', href: 'https://outline.example/s/abc/doc/mem' },
      { text: 'Swap is a confession.', href: 'https://outline.example/s/abc/doc/mem' },
    ]);
  });
});
