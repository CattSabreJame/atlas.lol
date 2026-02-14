import { Fragment, ReactNode } from "react";

function renderEmphasis(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={`${keyPrefix}-strong-${index}`} className="font-semibold text-[#f0f2f6]">
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith("*") && part.endsWith("*")) {
      return (
        <em key={`${keyPrefix}-em-${index}`} className="text-[#d4d9e3] italic">
          {part.slice(1, -1)}
        </em>
      );
    }

    return <Fragment key={`${keyPrefix}-text-${index}`}>{part}</Fragment>;
  });
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  const nodes: ReactNode[] = [];

  let cursor = 0;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = linkRegex.exec(text)) !== null) {
    if (match.index > cursor) {
      nodes.push(...renderEmphasis(text.slice(cursor, match.index), `${keyPrefix}-chunk-${index}`));
    }

    nodes.push(
      <a
        key={`${keyPrefix}-link-${index}`}
        href={match[2]}
        target="_blank"
        rel="noreferrer"
        className="text-[var(--accent-strong)] underline underline-offset-2"
      >
        {match[1]}
      </a>,
    );

    cursor = match.index + match[0].length;
    index += 1;
  }

  if (cursor < text.length) {
    nodes.push(...renderEmphasis(text.slice(cursor), `${keyPrefix}-tail`));
  }

  return nodes;
}

interface RichTextContentProps {
  value: string;
}

export function RichTextContent({ value }: RichTextContentProps) {
  const lines = value.split(/\r?\n/);
  const blocks: Array<{ type: "h2" | "h3" | "quote" | "paragraph" | "list"; content: string | string[] }> = [];
  let paragraphBuffer: string[] = [];
  let listBuffer: string[] = [];

  function flushParagraph() {
    if (!paragraphBuffer.length) {
      return;
    }

    blocks.push({
      type: "paragraph",
      content: paragraphBuffer.join(" "),
    });
    paragraphBuffer = [];
  }

  function flushList() {
    if (!listBuffer.length) {
      return;
    }

    blocks.push({
      type: "list",
      content: [...listBuffer],
    });
    listBuffer = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    if (line.startsWith("- ")) {
      flushParagraph();
      listBuffer.push(line.slice(2).trim());
      continue;
    }

    flushList();

    if (line.startsWith("### ")) {
      flushParagraph();
      blocks.push({ type: "h3", content: line.slice(4).trim() });
      continue;
    }

    if (line.startsWith("## ")) {
      flushParagraph();
      blocks.push({ type: "h2", content: line.slice(3).trim() });
      continue;
    }

    if (line.startsWith("> ")) {
      flushParagraph();
      blocks.push({ type: "quote", content: line.slice(2).trim() });
      continue;
    }

    paragraphBuffer.push(line);
  }

  flushParagraph();
  flushList();

  return (
    <div className="space-y-3 text-sm leading-relaxed text-[#c8ceda]">
      {blocks.map((block, index) => {
        if (block.type === "h2") {
          return (
            <h2 key={`block-${index}`} className="text-base font-semibold text-white">
              {renderInline(block.content as string, `h2-${index}`)}
            </h2>
          );
        }

        if (block.type === "h3") {
          return (
            <h3 key={`block-${index}`} className="text-sm font-semibold text-[#edf1f8]">
              {renderInline(block.content as string, `h3-${index}`)}
            </h3>
          );
        }

        if (block.type === "quote") {
          return (
            <blockquote
              key={`block-${index}`}
              className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[#d7dde8]"
            >
              {renderInline(block.content as string, `quote-${index}`)}
            </blockquote>
          );
        }

        if (block.type === "list") {
          return (
            <ul key={`block-${index}`} className="list-disc space-y-1 pl-5 text-[#c9cfdb]">
              {(block.content as string[]).map((item, itemIndex) => (
                <li key={`list-${index}-${itemIndex}`}>{renderInline(item, `list-${index}-${itemIndex}`)}</li>
              ))}
            </ul>
          );
        }

        return (
          <p key={`block-${index}`} className="text-[#c8ceda]">
            {renderInline(block.content as string, `p-${index}`)}
          </p>
        );
      })}
    </div>
  );
}
