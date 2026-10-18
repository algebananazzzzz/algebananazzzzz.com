import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MapHud, { useMapFullscreen } from './MapHud';

function Frame() {
  const [fs, toggle] = useMapFullscreen();
  return (
    <div data-testid="frame" data-fs={fs ? 'true' : 'false'}>
      <MapHud className="" label="drag to pan" fs={fs} onToggle={toggle} />
    </div>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('map fullscreen', () => {
  it('expands the frame, locks the page, and asks for native fullscreen', () => {
    const request = vi.fn(() => Promise.resolve());
    document.documentElement.requestFullscreen = request;
    render(<Frame />);

    fireEvent.click(screen.getByRole('button', { name: 'Fullscreen' }));

    expect(screen.getByTestId('frame').dataset.fs).toBe('true');
    expect(document.documentElement.classList.length).toBeGreaterThan(0);
    expect(request).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Exit fullscreen' })).toBeTruthy();
  });

  it('collapses on Escape and releases the page lock', () => {
    document.documentElement.requestFullscreen = () => Promise.resolve();
    render(<Frame />);
    fireEvent.click(screen.getByRole('button', { name: 'Fullscreen' }));

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.getByTestId('frame').dataset.fs).toBe('false');
    expect(document.documentElement.classList.length).toBe(0);
  });

  it('stays in the CSS overlay when the browser refuses native fullscreen', () => {
    document.documentElement.requestFullscreen = () => Promise.reject(new Error('denied'));
    render(<Frame />);

    fireEvent.click(screen.getByRole('button', { name: 'Fullscreen' }));

    expect(screen.getByTestId('frame').dataset.fs).toBe('true');
  });
});
