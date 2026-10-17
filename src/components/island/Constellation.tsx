import { useMemo, useState } from 'react';
import { forceSimulation, forceLink, forceManyBody, forceCollide, forceX, forceY } from 'd3-force';
import type { SimulationNodeDatum, SimulationLinkDatum } from 'd3-force';
import type { WikiPage, WikiTopic } from '@/types/wiki';

interface Props {
  pages: WikiPage[];
  topics: WikiTopic[];
  baseUrl: string;
  activeCluster?: string;
}

const VB_W = 200;
const VB_H = 100;

interface GraphNode extends SimulationNodeDatum {
  id: string;
  page: WikiPage;
  r: number;
}

interface GraphLink extends SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
}

function sizeFor(linkCount: number): number {
  return 0.55 + ((Math.min(linkCount, 9) - 2) / 7) * 1.45;
}

function deriveEdges(pages: WikiPage[]): [string, string][] {
  const pageIds = new Set(pages.map((p) => p.id));
  const seen = new Set<string>();
  const edges: [string, string][] = [];
  for (const p of pages) {
    for (const linkId of p.links) {
      if (!pageIds.has(linkId)) continue;
      const key = [p.id, linkId].sort().join('::');
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push([p.id, linkId]);
    }
  }
  return edges;
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

function runSimulation(pages: WikiPage[], topics: WikiTopic[]): GraphNode[] {
  const edges = deriveEdges(pages);
  const topicIds = topics.map((t) => t.id);
  const topicCount = topicIds.length || 1;

  const topicCenters = new Map<string, { x: number; y: number }>();
  const margin = VB_W * 0.25;
  const usable = VB_W - margin * 2;
  topicIds.forEach((tid, i) => {
    topicCenters.set(tid, {
      x: margin + (topicCount === 1 ? usable / 2 : (i / (topicCount - 1)) * usable),
      y: VB_H / 2,
    });
  });

  const nodes: GraphNode[] = pages.map((p, i) => {
    const center = topicCenters.get(p.topic) ?? { x: VB_W / 2, y: VB_H / 2 };
    return {
      id: p.id,
      page: p,
      r: sizeFor(p.links.length),
      x: center.x + (seededRandom(i * 2) - 0.5) * 30,
      y: center.y + (seededRandom(i * 2 + 1) - 0.5) * 30,
    };
  });

  const links: GraphLink[] = edges.map(([s, t]) => ({ source: s, target: t }));

  const sim = forceSimulation<GraphNode>(nodes)
    .force(
      'link',
      forceLink<GraphNode, GraphLink>(links)
        .id((d) => d.id)
        .distance(16)
        .strength(0.4),
    )
    .force('charge', forceManyBody<GraphNode>().strength(-65).distanceMax(50))
    .force(
      'topicX',
      forceX<GraphNode>((d) => topicCenters.get(d.page.topic)?.x ?? VB_W / 2).strength(0.2),
    )
    .force(
      'topicY',
      forceY<GraphNode>((d) => topicCenters.get(d.page.topic)?.y ?? VB_H / 2).strength(0.2),
    )
    .force(
      'collide',
      forceCollide<GraphNode>().radius((d) => d.r + 2.5),
    )
    .stop();

  for (let i = 0; i < 300; i++) sim.tick();

  const pad = 4;
  const r4 = (v: number) => Math.round(v * 1e4) / 1e4;
  for (const n of nodes) {
    n.x = r4(Math.max(pad, Math.min(VB_W - pad, n.x ?? VB_W / 2)));
    n.y = r4(Math.max(pad, Math.min(VB_H - pad, n.y ?? VB_H / 2)));
  }

  return nodes;
}

export default function Constellation({ pages, topics, baseUrl, activeCluster = 'all' }: Props) {
  const topicById = useMemo(() => Object.fromEntries(topics.map((t) => [t.id, t])), [topics]);

  const nodes = useMemo(() => runSimulation(pages, topics), [pages, topics]);
  const byId = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);
  const edges = useMemo(() => deriveEdges(pages), [pages]);

  const [hover, setHover] = useState<string | null>(null);

  const hasActive = !!activeCluster && activeCluster !== 'all';
  const activeColor = hasActive ? (topicById[activeCluster]?.dotColor ?? '#fff') : null;

  const isDim = (n: GraphNode) => hasActive && n.page.topic !== activeCluster;
  const isLit = (n: GraphNode) => hasActive && n.page.topic === activeCluster;

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="w-full h-auto"
        style={{ aspectRatio: '200/100', maxHeight: 520 }}
        role="img"
        aria-label="Constellation of notes"
      >
        <defs>
          <radialGradient id="cons-haloGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,236,67,0.45)" />
            <stop offset="100%" stopColor="rgba(255,236,67,0)" />
          </radialGradient>
          {hasActive && activeColor && (
            <radialGradient id="cons-haloActive" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={activeColor} stopOpacity="0.85" />
              <stop offset="45%" stopColor={activeColor} stopOpacity="0.35" />
              <stop offset="100%" stopColor={activeColor} stopOpacity="0" />
            </radialGradient>
          )}
          <filter id="cons-softGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="0.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="cons-brightGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="1.6" result="b1" />
            <feGaussianBlur stdDeviation="0.6" in="SourceGraphic" result="b2" />
            <feMerge>
              <feMergeNode in="b1" />
              <feMergeNode in="b2" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Edges */}
        <g>
          {edges.map(([a, b], i) => {
            const na = byId[a];
            const nb = byId[b];
            if (!na || !nb) return null;
            const bothDim = isDim(na) && isDim(nb);
            const bothActive = isLit(na) && isLit(nb);
            let stroke = 'rgba(255,236,67,0.18)';
            let width = 0.22;
            let dash: string | undefined;
            if (bothActive && activeColor) {
              stroke = activeColor;
              width = 0.42;
            } else if (bothDim) {
              stroke = 'rgba(255,255,255,0.03)';
              dash = '0.6 0.8';
            }
            return (
              <line
                key={`e-${i}`}
                x1={na.x!}
                y1={na.y!}
                x2={nb.x!}
                y2={nb.y!}
                stroke={stroke}
                strokeWidth={width}
                strokeDasharray={dash}
                opacity={bothActive ? 0.85 : 1}
                style={{ transition: 'stroke 250ms, stroke-width 250ms, opacity 250ms' }}
              />
            );
          })}
        </g>

        {/* Hover-highlighted edges */}
        {hover && (
          <g>
            {edges
              .filter(([a, b]) => a === hover || b === hover)
              .map(([a, b], i) => {
                const na = byId[a];
                const nb = byId[b];
                if (!na || !nb) return null;
                return (
                  <line
                    key={`he-${i}`}
                    x1={na.x!}
                    y1={na.y!}
                    x2={nb.x!}
                    y2={nb.y!}
                    stroke="rgba(255,236,67,0.7)"
                    strokeWidth="0.32"
                  />
                );
              })}
          </g>
        )}

        {/* Nodes */}
        <g>
          {nodes.map((n) => {
            const t = topicById[n.page.topic] ?? { dotColor: '#fff' };
            const dimmed = isDim(n);
            const lit = isLit(n);
            const isHover = hover === n.id;
            const rNode = lit ? n.r * 1.25 : n.r;
            return (
              <a
                key={n.id}
                href={`${baseUrl}/${n.page.id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <g
                  onMouseEnter={() => setHover(n.id)}
                  onMouseLeave={() => setHover(null)}
                  tabIndex={0}
                  role="link"
                  aria-label={n.page.title}
                  style={{
                    cursor: 'pointer',
                    opacity: dimmed ? 0.15 : 1,
                    transition: 'opacity 250ms',
                  }}
                >
                  {lit && (
                    <circle
                      cx={n.x!}
                      cy={n.y!}
                      r={n.r * 5.5}
                      fill="url(#cons-haloActive)"
                      style={{
                        animation: 'cons-pulse 2.6s ease-in-out infinite',
                        transformOrigin: `${n.x!}px ${n.y!}px`,
                      }}
                    />
                  )}
                  {!lit && n.r > 1.0 && (
                    <circle
                      cx={n.x!}
                      cy={n.y!}
                      r={n.r * 3.0}
                      fill="url(#cons-haloGrad)"
                      opacity={isHover ? 0.95 : 0.6}
                    />
                  )}
                  <circle
                    cx={n.x!}
                    cy={n.y!}
                    r={rNode}
                    fill={t.dotColor}
                    filter={lit ? 'url(#cons-brightGlow)' : 'url(#cons-softGlow)'}
                  />
                  {(lit || n.r > 1.4) && (
                    <circle cx={n.x!} cy={n.y!} r={rNode * 0.42} fill="rgba(255,255,255,0.98)" />
                  )}
                </g>
              </a>
            );
          })}
        </g>

        {/* Hover label */}
        {hover &&
          (() => {
            const n = byId[hover];
            if (!n) return null;
            const flip = n.x! > 140;
            const lx = flip ? n.x! - 2.4 : n.x! + 2.4;
            return (
              <g pointerEvents="none">
                <text
                  x={lx}
                  y={n.y! - 1.4}
                  fill="#e5e7eb"
                  fontSize="2.2"
                  fontFamily="ui-monospace, SFMono-Regular, monospace"
                  textAnchor={flip ? 'end' : 'start'}
                  style={{ paintOrder: 'stroke', stroke: '#0f172a', strokeWidth: 0.8 }}
                >
                  {n.page.title}
                </text>
                <text
                  x={lx}
                  y={n.y! + 1.8}
                  fill="#9ca3af"
                  fontSize="1.6"
                  fontFamily="ui-monospace, SFMono-Regular, monospace"
                  textAnchor={flip ? 'end' : 'start'}
                  style={{ paintOrder: 'stroke', stroke: '#0f172a', strokeWidth: 0.8 }}
                >
                  {n.page.links.length} links · {n.page.kind}
                </text>
              </g>
            );
          })()}
      </svg>
    </div>
  );
}
