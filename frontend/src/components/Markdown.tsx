import React from 'react';

interface MarkdownProps {
  content: string;
}

export const Markdown: React.FC<MarkdownProps> = ({ content }) => {
  // Regex to strip any <artifact>...</artifact> blocks so they do not render in the chat text stream
  const cleanContent = content.replace(/<artifact[\s\S]*?<\/artifact>/g, '').trim();

  if (!cleanContent) return null;

  // Simple parser that splits text by code blocks
  const parts = cleanContent.split(/(```[\s\S]*?```)/g);

  return (
    <div className="markdown-body">
      {parts.map((part, index) => {
        if (part.startsWith('```')) {
          // Parse code block
          const match = part.match(/```(\w*)\n([\s\S]*?)```/);
          const lang = match ? match[1] : '';
          const code = match ? match[2] : part.slice(3, -3);

          return (
            <pre key={index}>
              <code className={lang ? `language-${lang}` : ''}>{code.trim()}</code>
            </pre>
          );
        } else {
          // Parse standard text line by line or paragraph by paragraph
          const blocks = part.split(/\n\n+/);
          return blocks.map((block, bIdx) => {
            const trimmed = block.trim();
            if (!trimmed) return null;

            // Header Check
            if (trimmed.startsWith('# ')) {
              return <h1 key={`${index}-${bIdx}`}>{parseInline(trimmed.slice(2))}</h1>;
            }
            if (trimmed.startsWith('## ')) {
              return <h2 key={`${index}-${bIdx}`}>{parseInline(trimmed.slice(3))}</h2>;
            }
            if (trimmed.startsWith('### ')) {
              return <h3 key={`${index}-${bIdx}`}>{parseInline(trimmed.slice(4))}</h3>;
            }

            // Bullet List Check
            if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
              const items = trimmed.split(/\n[-*]\s+/);
              return (
                <ul key={`${index}-${bIdx}`}>
                  {items.map((item, iIdx) => (
                    <li key={iIdx}>{parseInline(item.replace(/^[-*]\s+/, ''))}</li>
                  ))}
                </ul>
              );
            }

            // Numbered List Check
            if (/^\d+\.\s+/.test(trimmed)) {
              const items = trimmed.split(/\n\d+\.\s+/);
              return (
                <ol key={`${index}-${bIdx}`}>
                  {items.map((item, iIdx) => (
                    <li key={iIdx}>{parseInline(item.replace(/^\d+\.\s+/, ''))}</li>
                  ))}
                </ol>
              );
            }

            // Standard Paragraph
            const lines = trimmed.split('\n');
            return (
              <p key={`${index}-${bIdx}`}>
                {lines.map((line, lIdx) => (
                  <React.Fragment key={lIdx}>
                    {lIdx > 0 && <br />}
                    {parseInline(line)}
                  </React.Fragment>
                ))}
              </p>
            );
          });
        }
      })}
    </div>
  );
};

// Helper function to parse inline bold and code tokens
function parseInline(text: string): React.ReactNode[] {
  // Regex to split on bold (**text**) and code (`text`)
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }
    return part;
  });
}
