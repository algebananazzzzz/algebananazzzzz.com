export type Accent = 'cosmic' | 'sunset' | 'aurora' | 'nebula';

const MAP: Record<string, Accent> = {
  '/': 'cosmic',
  '/starmap': 'cosmic',
  '/about': 'aurora',
  '/projects': 'sunset',
  '/experience': 'nebula',
};

export function accentForPath(path: string): Accent {
  const trimmed = path.endsWith('/') && path !== '/' ? path.slice(0, -1) : path;
  return MAP[trimmed] ?? 'cosmic';
}
