import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildOrrery } from '@/lib/orrery';
import Orrery, { type ProjectDetail } from './Orrery';

beforeAll(() => {
  class Noop {
    observe() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', Noop);
  vi.stubGlobal('IntersectionObserver', Noop);
  Element.prototype.scrollIntoView = () => {};
});

afterEach(() => {
  history.replaceState(null, '', '/');
  vi.useRealTimers();
});

const data = buildOrrery(
  [
    { id: 'odyssey', name: 'Odyssey', cluster: 'cloud', tech: ['go', 'aws'] },
    { id: 'planear', name: 'Planear', cluster: 'cloud', tech: ['go'], featured: true },
    { id: 'site', name: 'This site', cluster: 'general', tech: ['react'] },
  ],
  [
    { id: 'cloud', label: 'Cloud', color: '#7dd3fc' },
    { id: 'general', label: 'General', color: '#fde047' },
  ],
  [
    { id: 'infra', label: 'Cloud & infra', tint: '#6366f1', techs: { aws: 'AWS' } },
    { id: 'backend', label: 'Backend', tint: '#e11d48', techs: { go: 'Go' } },
    { id: 'frontend', label: 'Frontend', tint: '#14b8a6', techs: { react: 'React' } },
  ],
);
const details: Record<string, ProjectDetail> = {
  odyssey: { title: 'Scaffolds AWS projects.', description: 'A Go CLI.', date: '2024' },
  planear: { title: 'Reconciles CSV state.', description: 'A Go library.' },
  site: {
    title: 'This portfolio.',
    description: 'Astro and React.',
    href: 'https://github.com/x/site',
  },
};

const node = (label: string) => screen.getByLabelText(label, { selector: 'a' });

describe('Orrery compact', () => {
  it('links every star into the projects page', () => {
    render(<Orrery mode="compact" data={data} />);
    expect(node('Go, 2 projects').getAttribute('href')).toBe('/projects#tech/go');
    expect(node('Odyssey').getAttribute('href')).toBe('/projects#project/odyssey');
    expect(screen.queryByText('project cluster')).toBeNull();
  });

  it('marks featured projects and gives them a wider halo', () => {
    render(<Orrery mode="compact" data={data} />);
    expect(node('Planear').getAttribute('data-featured')).toBe('true');
    expect(node('Odyssey').getAttribute('data-featured')).toBe('false');
    const halo = (label: string) => Number(node(label).querySelector('circle')!.getAttribute('r'));
    const core = (label: string) =>
      Number(node(label).querySelectorAll('circle')[1].getAttribute('r'));
    expect(halo('Planear') / core('Planear')).toBe(7);
    expect(halo('Odyssey') / core('Odyssey')).toBe(5);
  });
});

describe('Orrery inline', () => {
  it('lists the projects orbiting a clicked beacon and records it in the hash', () => {
    render(<Orrery mode="inline" data={data} details={details} />);
    fireEvent.click(node('Go, 2 projects'));
    expect(screen.getByText('2 projects orbit this beacon')).toBeTruthy();
    expect(screen.getByText('Scaffolds AWS projects.')).toBeTruthy();
    expect(screen.queryByText('This portfolio.')).toBeNull();
    expect(location.hash).toBe('#tech/go');
  });

  it('shows a project with its date, description and outbound link, then steps back', () => {
    render(<Orrery mode="inline" data={data} details={details} />);
    fireEvent.click(node('React, 1 project'));
    fireEvent.click(screen.getByText('This site', { selector: 'span' }));
    expect(screen.getByText('Astro and React.')).toBeTruthy();
    expect(screen.getByText('view on github ↗').getAttribute('href')).toBe(
      'https://github.com/x/site',
    );
    fireEvent.click(screen.getByRole('button', { name: 'back to React' }));
    expect(screen.getByText('1 project orbits this beacon')).toBeTruthy();
    expect(location.hash).toBe('#tech/react');
  });

  it('steps back from a beacon to all technologies, even when reached from a project', () => {
    render(<Orrery mode="inline" data={data} details={details} />);
    fireEvent.click(node('Odyssey'));
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    fireEvent.click(screen.getByRole('button', { name: 'back to all technologies' }));
    expect(screen.getByText('explore by technology')).toBeTruthy();
    expect(location.hash).toBe('');
  });

  it('steps back from a project to all technologies when it was not reached from a beacon', () => {
    render(<Orrery mode="inline" data={data} details={details} />);
    fireEvent.click(node('Odyssey'));
    fireEvent.click(node('Planear'));
    const back = screen.getByRole('button', { name: 'back to all technologies' });
    expect(back.textContent).toBe('back');
    fireEvent.click(back);
    expect(screen.getByText('explore by technology')).toBeTruthy();
  });

  it('omits the date line when a project has none', () => {
    render(<Orrery mode="inline" data={data} details={details} />);
    fireEvent.click(node('Odyssey'));
    expect(screen.getByText('2024')).toBeTruthy();
    fireEvent.click(node('Planear'));
    expect(screen.getByText('A Go library.')).toBeTruthy();
    expect(screen.queryByText('2024')).toBeNull();
  });

  it('switches a cluster off and dims its stars', () => {
    render(<Orrery mode="inline" data={data} details={details} />);
    fireEvent.click(screen.getByRole('button', { name: /General/ }));
    expect(node('This site').getAttribute('data-state')).toBe('off');
    expect(node('React, 1 project').getAttribute('data-state')).toBe('dim');
    expect(node('Odyssey').getAttribute('data-state')).toBe('norm');
  });

  it('opens the project named in the URL hash on load', () => {
    vi.useFakeTimers();
    history.replaceState(null, '', '/projects#project/planear');
    render(<Orrery mode="inline" data={data} details={details} />);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.getByText('A Go library.')).toBeTruthy();
  });

  it('opens a project when a hash link elsewhere on the page is clicked', () => {
    render(
      <>
        <Orrery mode="inline" data={data} details={details} />
        <a href="#project/odyssey">recent row</a>
      </>,
    );
    fireEvent.click(screen.getByText('recent row'));
    expect(screen.getByText('A Go CLI.')).toBeTruthy();
  });
});
