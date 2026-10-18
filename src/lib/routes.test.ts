import { describe, it, expect } from 'vitest';
import { accentForPath } from './routes';

describe('accentForPath', () => {
  it('returns cosmic for / and /starmap', () => {
    expect(accentForPath('/')).toBe('cosmic');
    expect(accentForPath('/starmap')).toBe('cosmic');
  });
  it('returns aurora for /about', () => {
    expect(accentForPath('/about')).toBe('aurora');
  });
  it('returns sunset for /projects', () => {
    expect(accentForPath('/projects')).toBe('sunset');
  });
  it('returns nebula for /experience', () => {
    expect(accentForPath('/experience')).toBe('nebula');
  });
  it('falls back to cosmic for unknown paths', () => {
    expect(accentForPath('/xyz')).toBe('cosmic');
  });
});
