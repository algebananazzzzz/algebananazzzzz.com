import { describe, expect, it } from 'vitest';
import {
  description,
  linkTokens,
  tipQuotes,
  toStarmap,
  type OutlineDoc,
  type OutlineNode,
} from './sync-starmap';

const SHARE = 'https://outline.example/s/abc';

const node = (id: string, title: string, children: OutlineNode[] = [], color?: string) => ({
  id,
  url: `/doc/${title.toLowerCase()}-${id.slice(-10)}`,
  title,
  color,
  children,
});
const doc = (id: string, text: string): OutlineDoc => ({ id, urlId: id.slice(-10), text });

const uuid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;

describe('description', () => {
  it('reads a multi-line leading quote and strips markdown', () => {
    expect(description('> Uses **Pi-hole** and `dnsmasq`,\n> see [DNS](/doc/x).\n\nBody')).toBe(
      'Uses Pi-hole and dnsmasq, see DNS.',
    );
  });

  it('unescapes characters Outline escapes in its markdown', () => {
    expect(description('> Read TIME\\_WAIT and blue\\-green.')).toBe(
      'Read TIME_WAIT and blue-green.',
    );
  });

  it('returns null when the page does not open with a quote', () => {
    expect(description('## Heading\n\n> later quote')).toBeNull();
  });
});

describe('tipQuotes', () => {
  it('takes the bold opening sentence of every tip callout and ignores other callouts', () => {
    const text = [
      '> Description.',
      ':::tip\n**Idempotence is a promise to your `future` self.** Run it twice to check.\n\n:::',
      ':::info\n**Not a tip.** Ignored.\n:::',
      'Body text',
      ':::tip\n**Back up, then believe it.**\n:::',
    ].join('\n\n');
    expect(tipQuotes(text)).toEqual([
      'Idempotence is a promise to your future self.',
      'Back up, then believe it.',
    ]);
  });

  it('marks a tip that does not open with a bold sentence', () => {
    expect(tipQuotes(':::tip\nPlain tip, then **bold**.\n:::')).toEqual([null]);
  });
});

describe('linkTokens', () => {
  it('finds relative, absolute and anchored doc links but not attachments', () => {
    const text =
      '[a](/doc/abc-1234567890) [b](https://outline.example/doc/' +
      uuid(1) +
      '#h-x) ![img](/api/attachments.redirect?id=1)';
    expect(linkTokens(text)).toEqual(['abc-1234567890', uuid(1)]);
  });
});

describe('toStarmap', () => {
  const tree = [
    node(uuid(1), 'Root', [
      node(uuid(2), 'Branch', [node(uuid(3), 'Leaf')], '#21834f'),
      node(uuid(4), 'Other', [], '#AF3D34'),
    ]),
  ];
  const docs = [
    doc(uuid(1), '> Root page.'),
    doc(
      uuid(2),
      `> Branch page.\n\n[leaf](/doc/${uuid(3)}) [other](/doc/other-${uuid(4).slice(-10)})`,
    ),
    doc(uuid(3), `> Leaf page. [private](/doc/${uuid(99)}) [self](/doc/${uuid(3)})`),
    doc(uuid(4), '> Other page.\n\n:::tip\n**One quote.** And why.\n:::'),
  ];

  it('nests pages, colours only the branch level, and keeps cross-links between public pages', () => {
    const out = toStarmap(tree, docs, SHARE);
    expect(out.shareUrl).toBe(SHARE);
    const root = out.pages[0];
    expect(root.color).toBeUndefined();
    const [branch, other] = root.children!;
    expect(branch).toMatchObject({
      title: 'Branch',
      color: '#21834F',
      description: 'Branch page.',
    });
    // The link to its own child is already drawn as hierarchy, so only "Other" remains.
    expect(branch.links).toEqual([other.id]);
    expect(other.quotes).toEqual(['One quote.']);
    expect(branch.quotes).toBeUndefined();
    const leaf = branch.children![0];
    expect(leaf.color).toBeUndefined();
    expect(leaf.links).toBeUndefined();
  });

  it('lists every page missing a description, branch colour or bold tip opener', () => {
    const broken = [node(uuid(1), 'Root', [node(uuid(2), 'Branch', [node(uuid(3), 'Leaf')])])];
    const bad = [
      doc(uuid(1), '> ok\n\n:::tip\nNot bold.\n:::'),
      doc(uuid(2), 'No quote'),
      doc(uuid(3), '## nope'),
    ];
    expect(() => toStarmap(broken, bad, SHARE)).toThrow(
      /"Branch" does not start[\s\S]*"Leaf" does not start[\s\S]*"Branch" is a branch page[\s\S]*"Root" has a tip callout/,
    );
  });
});
