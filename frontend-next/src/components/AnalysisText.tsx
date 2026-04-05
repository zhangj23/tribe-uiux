interface Props { text?: string; }

function renderAnalysis(raw: string): string {
  // Escape HTML to prevent XSS from LLM output
  let text = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  let html = text
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^(\d+)\. (.+)$/gm, '<li><strong>$1.</strong> $2</li>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');

  html = html.replace(/((<li>.*?<\/li>\s*)+)/g, '<ul>$1</ul>');
  html = '<p>' + html + '</p>';
  html = html.replace(/<p>\s*<\/p>/g, '');
  html = html.replace(/<p>\s*(<h[23]>)/g, '$1');
  html = html.replace(/(<\/h[23]>)\s*<\/p>/g, '$1');
  html = html.replace(/<p>\s*(<ul>)/g, '$1');
  html = html.replace(/(<\/ul>)\s*<\/p>/g, '$1');
  html = html.replace(/FRICTION_SCORE:.*?(<br>|<\/p>)/gi, '$1');

  return html;
}

export default function AnalysisText({ text }: Props) {
  if (!text) {
    return (
      <div className="analysis-text">
        <p style={{ color: 'var(--text-dim)' }}>No analysis available.</p>
      </div>
    );
  }

  return (
    <div
      className="analysis-text"
      dangerouslySetInnerHTML={{ __html: renderAnalysis(text) }}
    />
  );
}
