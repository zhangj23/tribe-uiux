import type { Job, ZScores } from '@/types';

const METRIC_LABELS: { key: keyof ZScores; label: string }[] = [
  { key: 'visual_processing', label: 'Visual Processing' },
  { key: 'object_recognition', label: 'Object / Face Recognition' },
  { key: 'reading_language', label: 'Reading & Language' },
  { key: 'attention_salience', label: 'Attention & Salience' },
  { key: 'cognitive_load', label: 'Cognitive Load' },
  { key: 'emotional_response', label: 'Emotional Response' },
];

function signed(n: number): string {
  if (n > 0) return `+${n.toFixed(2)}`;
  return n.toFixed(2);
}

function verdictFor(score: number | undefined): string {
  if (score == null) return 'Awaiting analysis';
  if (score <= 3) return 'Low friction — clean processing';
  if (score <= 5) return 'Healthy';
  if (score <= 7) return 'Moderate friction';
  return 'High friction — overload risk';
}

export interface ExportOptions {
  title?: string;
  /** User's freeform note attached to this analysis (optional). */
  note?: string;
}

/**
 * Produce a plain-text summary suitable for pasting into Slack/email.
 * Uses Markdown-lite formatting that survives Slack's auto-format.
 */
export function formatJobAsText(job: Job, opts: ExportOptions = {}): string {
  const lines: string[] = [];
  const title = opts.title ?? 'TRIBE UX Analysis';
  const now = new Date().toLocaleString();

  lines.push(`*${title.toUpperCase()}*`);
  lines.push(`Generated ${now}`);
  lines.push('');

  // Friction score
  if (job.friction_score != null) {
    lines.push(`Friction Score: ${job.friction_score.toFixed(1)} / 10`);
    lines.push(`Verdict: ${verdictFor(job.friction_score)}`);
    lines.push('');
  }

  // User's note, if any — surface it right after the headline number so the
  // recipient sees the human context before the metrics.
  if (opts.note && opts.note.trim()) {
    lines.push('Note:');
    for (const line of opts.note.trim().split(/\r?\n/)) {
      lines.push(`  ${line}`);
    }
    lines.push('');
  }

  // Z-scores table
  if (job.z_scores) {
    lines.push('Neural Metrics (z-scores):');
    for (const { key, label } of METRIC_LABELS) {
      const v = job.z_scores[key];
      if (v == null) continue;
      lines.push(`  • ${label.padEnd(28)} ${signed(v)}`);
    }
    lines.push('');
  }

  // Trim the LLM analysis to avoid huge clipboard payloads. Cut at the last
  // sentence or paragraph boundary within the budget so the exported text
  // never ends mid-thought.
  if (job.llm_analysis) {
    const full = job.llm_analysis.trim();
    const LIMIT = 800;
    let out: string;
    if (full.length <= LIMIT) {
      out = full;
    } else {
      const slice = full.slice(0, LIMIT);
      // Prefer paragraph > sentence > word boundary.
      const byPara = slice.lastIndexOf('\n\n');
      const bySentence = Math.max(
        slice.lastIndexOf('. '),
        slice.lastIndexOf('! '),
        slice.lastIndexOf('? '),
      );
      const byWord = slice.lastIndexOf(' ');
      const cut =
        byPara > LIMIT * 0.6 ? byPara
        : bySentence > LIMIT * 0.6 ? bySentence + 1
        : byWord > 0 ? byWord
        : LIMIT;
      out = slice.slice(0, cut).trimEnd() + '…';
    }
    lines.push('AI Analysis:');
    lines.push(out);
    lines.push('');
  }

  lines.push('— Powered by TRIBE UX Analyzer');

  return lines.join('\n');
}

/**
 * Attempt to copy text to clipboard. Returns true on success.
 * Falls back to a temporary textarea for legacy browsers.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === 'undefined') return false;

  // Modern path
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to fallback
    }
  }

  // Fallback: execCommand via hidden textarea
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
