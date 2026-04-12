export type FrictionTone = 'phosphor' | 'cyan' | 'amber' | 'red' | 'dim';

/** Map a friction score (1-10) to a semantic tone. Consistent across the
 *  Header chip, FrictionScore hero display, and project ranking tables. */
export function frictionTone(score: number | null | undefined): FrictionTone {
  if (score == null || Number.isNaN(score)) return 'dim';
  if (score <= 3) return 'phosphor';
  if (score <= 5) return 'cyan';
  if (score <= 7) return 'amber';
  return 'red';
}

/** CSS var lookup for the tone. */
export function frictionToneVar(tone: FrictionTone): string {
  switch (tone) {
    case 'phosphor':
      return 'var(--phosphor)';
    case 'cyan':
      return 'var(--cyan)';
    case 'amber':
      return 'var(--amber)';
    case 'red':
      return 'var(--red)';
    case 'dim':
    default:
      return 'var(--text-dim)';
  }
}
