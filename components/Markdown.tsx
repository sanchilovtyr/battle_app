import { ReactNode } from "react";

/**
 * Минимальный и безопасный рендер Markdown для статей блога. Всё превращается в
 * React-элементы (без dangerouslySetInnerHTML), поэтому внедрить HTML/скрипт через
 * текст статьи нельзя. Поддерживается: ## и ### заголовки, абзацы, списки (- и 1.),
 * цитаты (>), **жирный**, *курсив*, [ссылки](https://…), разделитель ---.
 */

function safeHref(href: string): string | null {
  const h = href.trim();
  if (h.startsWith("/") && !h.startsWith("//")) return h;
  if (/^https?:\/\//i.test(h)) return h;
  return null;
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0;
  let i = 0;
  for (const m of Array.from(text.matchAll(re))) {
    const idx = m.index ?? 0;
    if (idx > last) nodes.push(text.slice(last, idx));
    const tok = m[0];
    const key = `${keyPrefix}-${i++}`;
    if (tok.startsWith("**")) {
      nodes.push(<strong key={key}>{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("[")) {
      const mm = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(tok);
      const href = mm ? safeHref(mm[2]) : null;
      if (mm && href) {
        const external = /^https?:\/\//i.test(href);
        nodes.push(
          <a
            key={key}
            href={href}
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="font-medium text-violet underline underline-offset-4 hover:text-ink-900"
          >
            {mm[1]}
          </a>
        );
      } else {
        nodes.push(tok);
      }
    } else {
      nodes.push(<em key={key}>{tok.slice(1, -1)}</em>);
    }
    last = idx + tok.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

type Block =
  | { t: "h2" | "h3" | "p" | "quote"; text: string }
  | { t: "ul" | "ol"; items: string[] }
  | { t: "hr" };

function parse(md: string): Block[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) {
      blocks.push({ t: "p", text: para.join(" ") });
      para = [];
    }
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    if (!line.trim()) {
      flush();
    } else if (/^###\s+/.test(line)) {
      flush();
      blocks.push({ t: "h3", text: line.replace(/^###\s+/, "") });
    } else if (/^##?\s+/.test(line)) {
      // «# » внутри статьи понижаем до h2: единственный h1 — заголовок самой страницы
      flush();
      blocks.push({ t: "h2", text: line.replace(/^##?\s+/, "") });
    } else if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      flush();
      blocks.push({ t: "hr" });
    } else if (/^>\s?/.test(line)) {
      flush();
      const q = [line.replace(/^>\s?/, "")];
      while (i + 1 < lines.length && /^>\s?/.test(lines[i + 1])) q.push(lines[++i].replace(/^>\s?/, ""));
      blocks.push({ t: "quote", text: q.join(" ") });
    } else if (/^[-*]\s+/.test(line)) {
      flush();
      const items = [line.replace(/^[-*]\s+/, "")];
      while (i + 1 < lines.length && /^[-*]\s+/.test(lines[i + 1])) items.push(lines[++i].replace(/^[-*]\s+/, ""));
      blocks.push({ t: "ul", items });
    } else if (/^\d+[.)]\s+/.test(line)) {
      flush();
      const items = [line.replace(/^\d+[.)]\s+/, "")];
      while (i + 1 < lines.length && /^\d+[.)]\s+/.test(lines[i + 1]))
        items.push(lines[++i].replace(/^\d+[.)]\s+/, ""));
      blocks.push({ t: "ol", items });
    } else {
      para.push(line.trim());
    }
  }
  flush();
  return blocks;
}

export default function Markdown({ source }: { source: string }) {
  const blocks = parse(source);
  return (
    <div className="space-y-5 text-[16px] leading-[1.75] text-ink-900 md:text-[17px]">
      {blocks.map((b, i) => {
        const k = `b${i}`;
        switch (b.t) {
          case "h2":
            return (
              <h2 key={k} className="mt-10 font-display text-xl leading-snug tracking-tight text-ink-900 md:text-2xl">
                {renderInline(b.text, k)}
              </h2>
            );
          case "h3":
            return (
              <h3 key={k} className="mt-8 text-lg font-extrabold tracking-tight text-ink-900 md:text-xl">
                {renderInline(b.text, k)}
              </h3>
            );
          case "quote":
            return (
              <blockquote key={k} className="rounded-r-xl border-l-4 border-violet bg-violet-soft px-5 py-4 text-ink-900">
                {renderInline(b.text, k)}
              </blockquote>
            );
          case "ul":
            return (
              <ul key={k} className="space-y-2">
                {b.items.map((it, j) => (
                  <li key={j} className="flex gap-3">
                    <span className="mt-0.5 shrink-0 text-violet">✓</span>
                    <span>{renderInline(it, `${k}-${j}`)}</span>
                  </li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={k} className="list-decimal space-y-2 pl-6 marker:font-bold marker:text-violet">
                {b.items.map((it, j) => (
                  <li key={j} className="pl-1">
                    {renderInline(it, `${k}-${j}`)}
                  </li>
                ))}
              </ol>
            );
          case "hr":
            return <hr key={k} className="border-line" />;
          default:
            return <p key={k}>{renderInline(b.text, k)}</p>;
        }
      })}
    </div>
  );
}

