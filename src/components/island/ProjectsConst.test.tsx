import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ProjectsConst, { type ProjectInput } from './ProjectsConst';

const projects: ProjectInput[] = Array.from({ length: 9 }, (_, i) => ({
  id: `project-${i}`,
  title: `Project ${i}`,
  summary: 'Example',
  tagline: 'Example tagline',
  date: '2026',
  magnitude: 2.2,
  tech: [],
  cluster: ['cloud', 'general', 'llm'][Math.floor(i / 3)],
}));

function positions(input: ProjectInput[]) {
  const { container, unmount } = render(
    <ProjectsConst
      projects={input}
      clusters={Object.fromEntries(input.map((p) => [p.cluster, { color: '#123456' }]))}
    />,
  );
  const result = new Map(
    [...container.querySelectorAll('g')]
      .filter((g) => g.querySelector('circle') && g.querySelector('text'))
      .map((g) => {
        const core = g.querySelectorAll('circle')[1];
        return [
          g.querySelector('text')!.textContent!,
          [Number(core.getAttribute('cx')), Number(core.getAttribute('cy'))],
        ] as const;
      }),
  );
  unmount();
  return result;
}

const distance = (a: readonly number[], b: readonly number[]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1]);

describe('spacetime project clusters', () => {
  it.each([2, 3, 4, 5, 6])(
    'separates related stars with %i clusters after perspective and warping',
    (count) => {
      const sample = Array.from({ length: count * 3 }, (_, i) => ({
        ...projects[0],
        id: `project-${i}`,
        title: `Project ${i}`,
        cluster: `group-${Math.floor(i / 3)}`,
      }));
      const points = positions(sample);
      for (const project of sample) {
        const origin = points.get(project.title.toLowerCase())!;
        const same = sample.filter((p) => p.id !== project.id && p.cluster === project.cluster);
        const other = sample.filter((p) => p.cluster !== project.cluster);
        const farthestMember = Math.max(
          ...same.map((p) => distance(origin, points.get(p.title.toLowerCase())!)),
        );
        const nearestOther = Math.min(
          ...other.map((p) => distance(origin, points.get(p.title.toLowerCase())!)),
        );
        expect(farthestMember).toBeLessThan(nearestOther);
      }
    },
  );

  it('keeps positions stable when input order changes', () => {
    expect(positions(projects)).toEqual(positions([...projects].reverse()));
  });
});

it('uses configured cluster colors, magnitude and date even for previously special IDs', () => {
  const sample = [{ ...projects[0], id: 'nubenube', magnitude: 1.3, date: '2025 → ongoing' }];
  const { container, getByText, unmount } = render(
    <ProjectsConst projects={sample} clusters={{ cloud: { color: '#123456' } }} />,
  );
  expect(container.querySelector('stop[offset="22%"]')?.getAttribute('stop-color')).toBe('#123456');
  expect(getByText('mag 1.3 · 2025 → ongoing')).toBeTruthy();
  const radius = Number(container.querySelectorAll('circle')[1].getAttribute('r'));
  unmount();
  const larger = render(
    <ProjectsConst
      projects={[{ ...sample[0], magnitude: 4 }]}
      clusters={{ cloud: { color: '#123456' } }}
    />,
  );
  expect(Number(larger.container.querySelectorAll('circle')[1].getAttribute('r'))).toBeGreaterThan(
    radius,
  );
  larger.unmount();
});
