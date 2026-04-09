/**
 * Mutate the document title and favicon to reflect the current analysis
 * status. Lets a marketer fan out a bunch of tabs (one per creative) and
 * still tell at a glance which tab is which.
 */

const DEFAULT_TITLE = 'TRIBE UX Analyzer';

const DEFAULT_ICON =
  "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>" +
  "<ellipse cx='16' cy='16' rx='12' ry='10' fill='none' stroke='%2339ff85' stroke-width='2'/>" +
  "<circle cx='16' cy='16' r='3' fill='%2339ff85'/>" +
  "</svg>";

function colorForScore(score: number): string {
  if (score <= 3) return '#39ff85'; // phosphor
  if (score <= 5) return '#00d4ff'; // cyan
  if (score <= 7) return '#ffb347'; // amber
  return '#ff4d6a';                  // red
}

function urlEncodeColor(c: string) {
  return c.replace('#', '%23');
}

function buildFavicon(score: number): string {
  const stroke = urlEncodeColor(colorForScore(score));
  // Big ellipse outline (matches the brand) + a solid filled inner circle
  // tinted to the friction tone. The number itself is too small to read at
  // 16x16 so we use the dot to encode the score.
  return (
    "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>" +
    `<ellipse cx='16' cy='16' rx='12' ry='10' fill='none' stroke='${stroke}' stroke-width='2'/>` +
    `<circle cx='16' cy='16' r='5' fill='${stroke}'/>` +
    "</svg>"
  );
}

function ensureFaviconLink(): HTMLLinkElement {
  let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  return link;
}

export interface TabIdentity {
  /** Current friction score, if known. */
  frictionScore?: number;
  /** Optional human-readable label (e.g. analysis name) shown in the title. */
  label?: string;
}

export function applyTabIdentity({ frictionScore, label }: TabIdentity) {
  if (typeof document === 'undefined') return;

  if (frictionScore != null) {
    const score = frictionScore.toFixed(1);
    const titleBits = [`${score}/10`, label, DEFAULT_TITLE].filter(Boolean);
    document.title = titleBits.join(' · ');
    ensureFaviconLink().href = buildFavicon(frictionScore);
  } else {
    document.title = DEFAULT_TITLE;
    ensureFaviconLink().href = DEFAULT_ICON;
  }
}

export function resetTabIdentity() {
  applyTabIdentity({});
}
