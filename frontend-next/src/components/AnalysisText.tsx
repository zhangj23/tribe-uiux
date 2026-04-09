'use client';

import { Fragment, useMemo, useState, ReactNode } from 'react';

interface Props { text?: string; }

interface Section {
  level: 2 | 3;
  title: string;
  body: string[];
}

/**
 * Split the raw LLM text into heading-delimited sections. Any content before
 * the first heading becomes an anonymous "Summary" section.
 */
function parseSections(raw: string): Section[] {
  // Drop Claude's FRICTION_SCORE sentinel if present.
  const clean = raw.replace(/FRICTION_SCORE:.*$/gim, '').trim();
  const lines = clean.split(/\r?\n/);

  const sections: Section[] = [];
  let current: Section | null = null;
  const ensureCurrent = () => {
    if (!current) {
      current = { level: 2, title: 'Summary', body: [] };
      sections.push(current);
    }
    return current;
  };

  for (const line of lines) {
    const h3 = line.match(/^###\s+(.*)$/);
    const h2 = line.match(/^##\s+(.*)$/);
    if (h2) {
      current = { level: 2, title: h2[1].trim(), body: [] };
      sections.push(current);
    } else if (h3) {
      current = { level: 3, title: h3[1].trim(), body: [] };
      sections.push(current);
    } else {
      ensureCurrent().body.push(line);
    }
  }

  // Strip sections that are empty or only whitespace.
  return sections.filter(s => s.body.some(l => l.trim().length > 0));
}

/**
 * Render a single inline segment with **bold** support — no HTML injection,
 * just React elements, so LLM output can't inject tags or handlers.
 */
function renderInline(text: string): ReactNode {
  const parts: ReactNode[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(<strong key={`b${key++}`}>{match[1]}</strong>);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

/**
 * Render the body of a section as a mix of paragraphs and lists.
 * We do not use dangerouslySetInnerHTML anywhere — React handles escaping.
 */
function renderBody(lines: string[]): ReactNode {
  const blocks: ReactNode[] = [];
  let listBuffer: { ordered: boolean; items: string[] } | null = null;
  let paragraphBuffer: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length === 0) return;
    const text = paragraphBuffer.join(' ').trim();
    if (text) {
      blocks.push(<p key={`p${blocks.length}`}>{renderInline(text)}</p>);
    }
    paragraphBuffer = [];
  };

  const flushList = () => {
    if (!listBuffer) return;
    const Tag = listBuffer.ordered ? 'ol' : 'ul';
    const items = listBuffer.items;
    blocks.push(
      <Tag key={`l${blocks.length}`}>
        {items.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </Tag>
    );
    listBuffer = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }
    const orderedMatch = line.match(/^\s*(\d+)\.\s+(.*)$/);
    const unorderedMatch = line.match(/^\s*[-*]\s+(.*)$/);
    if (orderedMatch) {
      flushParagraph();
      if (!listBuffer || !listBuffer.ordered) {
        flushList();
        listBuffer = { ordered: true, items: [] };
      }
      listBuffer.items.push(orderedMatch[2]);
    } else if (unorderedMatch) {
      flushParagraph();
      if (!listBuffer || listBuffer.ordered) {
        flushList();
        listBuffer = { ordered: false, items: [] };
      }
      listBuffer.items.push(unorderedMatch[1]);
    } else {
      flushList();
      paragraphBuffer.push(line);
    }
  }
  flushParagraph();
  flushList();

  return <Fragment>{blocks}</Fragment>;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`analysis-chevron${open ? ' is-open' : ''}`}
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden
    >
      <path
        d="M3.5 4.5L6 7l2.5-2.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function AnalysisText({ text }: Props) {
  const sections = useMemo(() => (text ? parseSections(text) : []), [text]);
  const [openIds, setOpenIds] = useState<Set<number>>(() => new Set([0]));

  if (!text || sections.length === 0) {
    return (
      <div className="analysis-text">
        <p style={{ color: 'var(--text-dim)' }}>No analysis available.</p>
      </div>
    );
  }

  const toggle = (i: number) => {
    setOpenIds(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  return (
    <div className="analysis-text analysis-sections">
      {sections.map((section, i) => {
        const open = openIds.has(i);
        const headingId = `analysis-section-${i}`;
        const panelId = `analysis-panel-${i}`;
        return (
          <section key={i} className={`analysis-section${open ? ' is-open' : ''}`}>
            <button
              type="button"
              className={`analysis-section-header analysis-section-header--h${section.level}`}
              onClick={() => toggle(i)}
              aria-expanded={open}
              aria-controls={panelId}
              id={headingId}
            >
              <Chevron open={open} />
              <span className="analysis-section-title">{section.title}</span>
            </button>
            <div
              id={panelId}
              role="region"
              aria-labelledby={headingId}
              className="analysis-section-body"
              hidden={!open}
            >
              {renderBody(section.body)}
            </div>
          </section>
        );
      })}
    </div>
  );
}
