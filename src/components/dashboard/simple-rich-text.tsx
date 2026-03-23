"use client";

import { useRef, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type SimpleRichTextEditorProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
};

function applyWrap(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  prefix: string,
  suffix = prefix
) {
  const selected = value.slice(selectionStart, selectionEnd);
  const nextValue =
    value.slice(0, selectionStart) + prefix + selected + suffix + value.slice(selectionEnd);
  const caretOffset = prefix.length + selected.length + suffix.length;

  return {
    nextValue,
    nextSelectionStart: selectionStart + prefix.length,
    nextSelectionEnd: selectionStart + caretOffset - suffix.length,
  };
}

function applyList(value: string, selectionStart: number, selectionEnd: number) {
  const selected = value.slice(selectionStart, selectionEnd);
  const base = selected.length ? selected : "Punkt";
  const lines = base.split("\n").map((line) => (line.startsWith("- ") ? line : `- ${line}`));
  const nextChunk = lines.join("\n");
  const nextValue = value.slice(0, selectionStart) + nextChunk + value.slice(selectionEnd);

  return {
    nextValue,
    nextSelectionStart: selectionStart,
    nextSelectionEnd: selectionStart + nextChunk.length,
  };
}

export function SimpleRichTextEditor({
  id,
  value,
  onChange,
  placeholder,
  rows = 5,
}: SimpleRichTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const updateSelection = (
    transform: (text: string, selectionStart: number, selectionEnd: number) => {
      nextValue: string;
      nextSelectionStart: number;
      nextSelectionEnd: number;
    }
  ) => {
    const element = textareaRef.current;
    if (!element) return;

    const { nextValue, nextSelectionStart, nextSelectionEnd } = transform(
      value,
      element.selectionStart,
      element.selectionEnd
    );

    onChange(nextValue);

    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(nextSelectionStart, nextSelectionEnd);
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={() => updateSelection((text, start, end) => applyWrap(text, start, end, "**"))}
        >
          Fett
        </Button>
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={() => updateSelection((text, start, end) => applyWrap(text, start, end, "_"))}
        >
          Kursiv
        </Button>
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={() => updateSelection((text, start, end) => applyWrap(text, start, end, "~~"))}
        >
          Durchstreichen
        </Button>
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={() => updateSelection((text, start, end) => applyList(text, start, end))}
        >
          Liste
        </Button>
      </div>
      <Textarea
        ref={textareaRef}
        id={id}
        value={value}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function renderInline(text: string): Array<string | ReactNode> {
  const parts: Array<string | ReactNode> = [];
  let remaining = text;
  let key = 0;

  const patterns = [
    { regex: /\*\*(.+?)\*\*/, render: (content: string) => <strong key={key++}>{content}</strong> },
    { regex: /_(.+?)_/, render: (content: string) => <em key={key++}>{content}</em> },
    { regex: /~~(.+?)~~/, render: (content: string) => <s key={key++}>{content}</s> },
  ];

  while (remaining.length) {
    const matchInfo = patterns
      .map((pattern) => {
        const match = remaining.match(pattern.regex);
        return match?.index !== undefined
          ? { pattern, match, index: match.index }
          : null;
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((left, right) => left.index - right.index)[0];

    if (!matchInfo) {
      parts.push(remaining);
      break;
    }

    if (matchInfo.index > 0) {
      parts.push(remaining.slice(0, matchInfo.index));
    }

    parts.push(matchInfo.pattern.render(matchInfo.match[1]));
    remaining = remaining.slice(matchInfo.index + matchInfo.match[0].length);
  }

  return parts;
}

export function SimpleRichTextContent({
  value,
  className,
}: {
  value?: string | null;
  className?: string;
}) {
  if (!value?.trim()) {
    return null;
  }

  const lines = value.split("\n");
  const items: string[] = [];
  const blocks: ReactNode[] = [];
  let key = 0;

  const flushList = () => {
    if (!items.length) return;
    blocks.push(
      <ul key={`list-${key++}`} className="list-disc space-y-1 pl-5">
        {items.map((item, index) => (
          <li key={`li-${index}`}>{renderInline(item)}</li>
        ))}
      </ul>
    );
    items.length = 0;
  };

  lines.forEach((line) => {
    if (line.startsWith("- ")) {
      items.push(line.slice(2));
      return;
    }

    flushList();

    if (line.trim().length === 0) {
      blocks.push(<div key={`space-${key++}`} className="h-2" />);
      return;
    }

    blocks.push(
      <p key={`p-${key++}`} className="leading-6">
        {renderInline(line)}
      </p>
    );
  });

  flushList();

  return <div className={cn("text-sm text-muted-foreground", className)}>{blocks}</div>;
}
