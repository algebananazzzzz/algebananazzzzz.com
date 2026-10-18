type Accent = 'cosmic' | 'sunset' | 'aurora' | 'nebula';

const layers: Record<Accent, string> = {
  cosmic: `radial-gradient(ellipse 55% 45% at 50% 30%, rgba(91, 33, 182, 0.42), transparent 65%),
           radial-gradient(ellipse 60% 50% at 30% 80%, rgba(67, 56, 202, 0.32), transparent 70%)`,
  sunset: `radial-gradient(ellipse 55% 45% at 50% 30%, rgba(249, 115, 22, 0.32), transparent 65%),
           radial-gradient(ellipse 60% 50% at 70% 80%, rgba(220, 38, 38, 0.28), transparent 70%)`,
  aurora: `radial-gradient(ellipse 55% 45% at 50% 30%, rgba(22, 163, 74, 0.32), transparent 65%),
           radial-gradient(ellipse 60% 50% at 30% 80%, rgba(8, 145, 178, 0.28), transparent 70%)`,
  nebula: `radial-gradient(ellipse 55% 45% at 50% 30%, rgba(190, 24, 93, 0.38), transparent 65%),
           radial-gradient(ellipse 60% 50% at 70% 80%, rgba(91, 33, 182, 0.32), transparent 70%)`,
};

export default function AccentOrb() {
  const initial = typeof document === 'undefined' ? null : document.documentElement.dataset.accent;
  const accent: Accent = initial && initial in layers ? (initial as Accent) : 'cosmic';

  return (
    <div className="accent-orb" aria-hidden="true">
      {(Object.keys(layers) as Accent[]).map((k) => (
        <div
          key={k}
          className={`accent-layer ${k === accent ? 'active' : ''}`}
          style={{ background: layers[k] }}
        />
      ))}
    </div>
  );
}
