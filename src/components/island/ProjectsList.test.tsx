import { fireEvent, render } from '@testing-library/react';
import { expect, it } from 'vitest';
import ProjectsList from './ProjectsList';

it('renders projects without optional fields and filters newly configured clusters', () => {
  const project = {
    id: 'new-project',
    title: 'New project',
    tagline: 'Tagline',
    summary: 'Summary',
    tech: ['go'],
    date: '2026',
    magnitude: 2,
    cluster: 'new-cluster',
  };
  const { getByRole, getByText, queryByRole, queryByText, unmount } = render(
    <ProjectsList
      projects={[
        project,
        {
          ...project,
          id: 'second',
          title: 'Second',
          cluster: 'cloud',
          href: 'https://example.com',
          bullets: ['Detail'],
        },
      ]}
    />,
  );
  expect(getByRole('link', { name: 'source' }).getAttribute('href')).toBe('https://example.com');
  expect(getByText('Detail')).toBeTruthy();
  fireEvent.click(getByRole('button', { name: 'new-cluster' }));
  expect(getByText('New project')).toBeTruthy();
  expect(getByText('2026')).toBeTruthy();
  expect(queryByText('Second')).toBeNull();
  expect(queryByRole('link')).toBeNull();
  expect(queryByRole('list')).toBeNull();
  unmount();
});
