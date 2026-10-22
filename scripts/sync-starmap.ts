// Pulls the Public collection from Outline and writes src/content/starmap-manifest.json.
// Run with `npm run sync:starmap`; it reads OUTLINE_API_TOKEN from .env.
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const OUTLINE = 'https://outline.algebananazzzzz.com';
const PUBLIC_COLLECTION = '10032969-d222-4933-87e9-ed351ba741e7';
const OUT = 'src/content/starmap-manifest.json';

export type OutlineNode = {
  id: string;
  url: string;
  title: string;
  color?: string | null;
  children: OutlineNode[];
};
export type OutlineDoc = { id: string; urlId: string; text: string };

export type StarmapPageOut = {
  id: string;
  title: string;
  color?: string;
  description: string;
  quotes?: string[];
  links?: string[];
  children?: StarmapPageOut[];
};
export type StarmapFileOut = { shareUrl: string; pages: StarmapPageOut[] };

const stripMarkdown = (s: string) =>
  s
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\\([\\`*_{}[\]()#+\-.!>~|])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

/** The page's leading blockquote is its description; null when the page doesn't open with one. */
export function description(text: string): string | null {
  const lines = text.replace(/^\s+/, '').split('\n');
  const quote: string[] = [];
  for (const line of lines) {
    if (!line.startsWith('>')) break;
    quote.push(line.replace(/^>\s?/, ''));
  }
  const s = stripMarkdown(quote.join(' '));
  return s || null;
}

/**
 * A callout of any type that opens with a bold sentence makes that sentence a quote for the
 * meteors and mottos. Callouts without one are plain notes and give no quote. A bold opener
 * under five words is a label like "Observe:", not a sentence, and one ending in a colon
 * introduces what follows rather than standing alone.
 */
export function calloutQuotes(text: string): string[] {
  return [...text.matchAll(/^:::\w+\n([\s\S]*?)\n:::/gm)].flatMap((m) => {
    const lead = /^\s*\*\*(.+?)\*\*/.exec(m[1]);
    const quote = lead && stripMarkdown(lead[1]);
    return quote && quote.split(/\s+/).length >= 5 && !quote.endsWith(':') ? [quote] : [];
  });
}

/** Outline writes internal links as /doc/<uuid> or /doc/<slug>-<urlId>, sometimes absolute. */
export function linkTokens(text: string): string[] {
  const re = /\]\((?:https?:\/\/[^/)]+)?\/doc\/([^)#?\s]+)/g;
  return [...text.matchAll(re)].map((m) => m[1]);
}

const slugOf = (node: OutlineNode) => node.url.replace(/^\/doc\//, '');

export function toStarmap(
  tree: OutlineNode[],
  docs: OutlineDoc[],
  shareUrl: string,
): StarmapFileOut {
  const byId = new Map(docs.map((d) => [d.id, d]));
  const byUrlId = new Map(docs.map((d) => [d.urlId, d]));
  const slugById = new Map<string, string>();
  const parentOf = new Map<string, string | null>();
  const walk = (nodes: OutlineNode[], parent: string | null) => {
    for (const n of nodes) {
      slugById.set(n.id, slugOf(n));
      parentOf.set(n.id, parent);
      walk(n.children, n.id);
    }
  };
  walk(tree, null);

  const resolve = (token: string) => {
    const doc = /^[0-9a-f-]{36}$/.test(token) ? byId.get(token) : byUrlId.get(token.slice(-10));
    return doc && slugById.has(doc.id) ? doc.id : null;
  };

  const missingQuote: string[] = [];
  const missingColor: string[] = [];

  const build = (n: OutlineNode, depth: number): StarmapPageOut => {
    const doc = byId.get(n.id);
    if (!doc) throw new Error(`Outline listed "${n.title}" in the tree but not in documents.list.`);
    const desc = description(doc.text);
    if (!desc) missingQuote.push(n.title);
    // Second-level pages are the branches; everything below takes their colour.
    if (depth === 1 && !n.color) missingColor.push(n.title);

    const tree = new Set([parentOf.get(n.id), ...n.children.map((c) => c.id)]);
    const links = [
      ...new Set(
        linkTokens(doc.text)
          .map(resolve)
          .filter((id): id is string => !!id && id !== n.id && !tree.has(id)),
      ),
    ].map((id) => slugById.get(id)!);

    const pageQuotes = calloutQuotes(doc.text);
    return {
      id: slugOf(n),
      title: n.title,
      ...(depth === 1 && n.color ? { color: n.color.toUpperCase() } : {}),
      description: desc ?? '',
      ...(pageQuotes.length ? { quotes: pageQuotes } : {}),
      ...(links.length ? { links } : {}),
      ...(n.children.length ? { children: n.children.map((c) => build(c, depth + 1)) } : {}),
    };
  };

  const pages = tree.map((n) => build(n, 0));
  const problems = [
    ...missingQuote.map((t) => `"${t}" does not start with a > quote to use as its description.`),
    ...missingColor.map((t) => `"${t}" is a branch page and needs an icon colour in Outline.`),
  ];
  if (problems.length) throw new Error(`Outline pages need fixing:\n  ${problems.join('\n  ')}`);
  return { shareUrl, pages };
}

async function api<T>(method: string, body: object): Promise<T> {
  const res = await fetch(`${OUTLINE}/api/${method}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OUTLINE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Outline ${method} failed: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { data: T }).data;
}

async function main() {
  if (!process.env.OUTLINE_API_TOKEN) throw new Error('OUTLINE_API_TOKEN is not set.');

  const tree = await api<OutlineNode[]>('collections.documents', { id: PUBLIC_COLLECTION });
  const docs: OutlineDoc[] = [];
  for (let offset = 0; ; offset += 100) {
    const batch = await api<OutlineDoc[]>('documents.list', {
      collectionId: PUBLIC_COLLECTION,
      limit: 100,
      offset,
    });
    docs.push(...batch);
    if (batch.length < 100) break;
  }
  const shares = await api<{ collectionId: string | null; published: boolean; url: string }[]>(
    'shares.list',
    {},
  );
  const share = shares.find((s) => s.collectionId === PUBLIC_COLLECTION && s.published);
  if (!share) throw new Error('The Public collection has no published share link in Outline.');

  const file = toStarmap(tree, docs, share.url);
  writeFileSync(OUT, JSON.stringify(file, null, 2) + '\n');
  console.log(`Wrote ${OUT}: ${docs.length} pages.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e: Error) => {
    console.error(e.message);
    process.exit(1);
  });
}
