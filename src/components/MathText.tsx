import { memo } from "react";
import { InlineMath, BlockMath } from "react-katex";
import "katex/dist/katex.min.css";

interface MathTextProps {
  children: string;
  className?: string;
  /** Quando true, o componente envolve em <span> em vez de <div> (útil para flow inline) */
  inline?: boolean;
}

/**
 * Renderiza texto que pode conter LaTeX entre delimitadores:
 * - `$$...$$` → bloco
 * - `$...$`   → inline
 * - `\(...\)` → inline
 * - `\[...\]` → bloco
 *
 * O texto fora dos delimitadores é renderizado como texto puro,
 * preservando quebras de linha.
 */
function MathTextImpl({ children, className, inline = false }: MathTextProps) {
  if (!children) return null;

  // Regex captura: $$...$$, \[...\], $...$, \(...\)
  // ordem importa: bloco antes de inline
  const regex = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\$([^\n$]+?)\$|\\\(([\s\S]+?)\\\)/g;

  const parts: Array<{ type: "text" | "inline" | "block"; value: string }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(children)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: children.slice(lastIndex, match.index) });
    }
    const blockMatch = match[1] ?? match[2];
    const inlineMatch = match[3] ?? match[4];
    if (blockMatch != null) {
      parts.push({ type: "block", value: blockMatch.trim() });
    } else if (inlineMatch != null) {
      parts.push({ type: "inline", value: inlineMatch.trim() });
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < children.length) {
    parts.push({ type: "text", value: children.slice(lastIndex) });
  }

  const sharedStyle = {
    whiteSpace: "pre-wrap" as const,
    overflowWrap: "anywhere" as const,
    wordBreak: "break-word" as const,
    maxWidth: "100%",
  };

  // Sem matemática? Retorna texto puro preservando quebras
  if (parts.every((p) => p.type === "text")) {
    const Tag = inline ? "span" : "div";
    return <Tag className={className} style={sharedStyle}>{children}</Tag>;
  }

  const Wrapper = inline ? "span" : "div";

  return (
    <Wrapper className={className} style={sharedStyle}>
      {parts.map((p, i) => {
        if (p.type === "text") return <span key={i} style={sharedStyle}>{p.value}</span>;
        try {
          if (p.type === "block") {
            return (
              <span key={i} className="block my-1 max-w-full overflow-x-auto">
                <BlockMath math={p.value} />
              </span>
            );
          }
          return <InlineMath key={i} math={p.value} />;
        } catch {
          // KaTeX falhou — mostra o source bruto pra não quebrar a UI
          return <span key={i} className="font-mono text-xs" style={sharedStyle}>{p.value}</span>;
        }
      })}
    </Wrapper>
  );
}

export const MathText = memo(MathTextImpl);
