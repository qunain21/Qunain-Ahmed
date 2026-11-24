import { Fragment, memo, useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface CodeBlockProps {
  language: string;
  code: string;
}

function CodeBlock({ language, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-950 text-slate-100 dark:border-slate-800">
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-3.5 py-2 text-xs text-slate-400">
        <span className="font-mono">{language || 'code'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex min-h-[28px] items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-2 focus-visible:outline-blue-500"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-3.5 font-mono text-[13px] leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function renderInline(text: string): React.ReactNode[] {
  const tokens: React.ReactNode[] = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIdx = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(text.slice(lastIndex, match.index));
    }

    const full = match[0];
    if (full.startsWith('`') && full.endsWith('`')) {
      tokens.push(
        <code
          key={keyIdx++}
          className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[13px] text-slate-800 dark:bg-slate-800 dark:text-slate-200"
        >
          {full.slice(1, -1)}
        </code>,
      );
    } else if (full.startsWith('**') && full.endsWith('**')) {
      tokens.push(
        <strong key={keyIdx++} className="font-semibold text-slate-900 dark:text-white">
          {full.slice(2, -2)}
        </strong>,
      );
    } else if (full.startsWith('*') && full.endsWith('*')) {
      tokens.push(
        <em key={keyIdx++} className="italic">
          {full.slice(1, -1)}
        </em>,
      );
    } else if (match[2] && match[3]) {
      tokens.push(
        <a
          key={keyIdx++}
          href={match[3]}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-blue-600 underline underline-offset-2 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          {match[2]}
        </a>,
      );
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push(text.slice(lastIndex));
  }

  return tokens;
}

function renderTextSegment(segment: string, keyPrefix: string): React.ReactNode {
  const lines = segment.split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    const headingMatch = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const content = renderInline(headingMatch[2]);
      if (level === 1) {
        blocks.push(
          <h3
            key={`${keyPrefix}-h1-${i}`}
            className="mt-3 mb-1.5 font-display text-base font-semibold text-slate-900 first:mt-0 dark:text-white"
          >
            {content}
          </h3>,
        );
      } else {
        blocks.push(
          <h4
            key={`${keyPrefix}-h2-${i}`}
            className="mt-3 mb-1 font-display text-[15px] font-semibold text-slate-900 first:mt-0 dark:text-white"
          >
            {content}
          </h4>,
        );
      }
      i++;
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ''));
        i++;
      }
      blocks.push(
        <ul
          key={`${keyPrefix}-ul-${i}`}
          className="my-2 list-disc space-y-1 pl-5 text-[15px] leading-relaxed"
        >
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i++;
      }
      blocks.push(
        <ol
          key={`${keyPrefix}-ol-${i}`}
          className="my-2 list-decimal space-y-1 pl-5 text-[15px] leading-relaxed"
        >
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#{1,3})\s+/.test(lines[i].trim()) &&
      !/^[-*]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i]);
      i++;
    }

    blocks.push(
      <p key={`${keyPrefix}-p-${i}`} className="my-2 text-[15px] leading-[1.6] first:mt-0 last:mb-0">
        {paraLines.map((pLine, idx) => (
          <Fragment key={idx}>
            {idx > 0 && <br />}
            {renderInline(pLine)}
          </Fragment>
        ))}
      </p>,
    );
  }

  return blocks;
}

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
}: MarkdownRendererProps) {
  const parts: Array<{ type: 'text' | 'code'; value: string; lang?: string }> = [];
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: content.slice(lastIndex, match.index) });
    }
    parts.push({
      type: 'code',
      lang: match[1] || 'code',
      value: match[2].replace(/\n$/, ''),
    });
    lastIndex = codeBlockRegex.lastIndex;
  }

  if (lastIndex < content.length) {
    parts.push({ type: 'text', value: content.slice(lastIndex) });
  }

  return (
    <div className="min-w-0 break-words">
      {parts.map((part, idx) =>
        part.type === 'code' ? (
          <CodeBlock key={`cb-${idx}`} language={part.lang || 'code'} code={part.value} />
        ) : (
          <Fragment key={`tx-${idx}`}>{renderTextSegment(part.value, `seg-${idx}`)}</Fragment>
        ),
      )}
    </div>
  );
});
