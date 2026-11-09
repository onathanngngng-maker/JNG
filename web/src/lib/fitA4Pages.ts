const BR_SPLIT = /(?<=<br\s*\/?>)/i;
const VOID_TAGS = new Set(["br", "img", "hr", "meta", "link", "input"]);

export type FittedSheet = {
  html: string;
  fontPx: number;
};

export function isVisibleHtml(html: string): boolean {
  if (/<img\b/i.test(html)) return true;
  const text = html
    .replace(/<br\s*\/?>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .trim();
  return text.length > 0;
}

function openTags(html: string): string[] {
  const tags: string[] = [];
  const re = /<\/?([a-zA-Z][\w:-]*)\b[^>]*?>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const full = match[0];
    const name = match[1].toLowerCase();
    if (full.startsWith("</")) {
      for (let index = tags.length - 1; index >= 0; index -= 1) {
        const open = /^<([a-zA-Z][\w:-]*)/i.exec(tags[index]);
        if (open && open[1].toLowerCase() === name) {
          tags.splice(index, 1);
          break;
        }
      }
      continue;
    }
    if (full.endsWith("/>") || VOID_TAGS.has(name)) continue;
    tags.push(full);
  }
  return tags;
}

function closeOpenTags(html: string): string {
  return openTags(html)
    .reverse()
    .map((tag) => {
      const name = /^<([a-zA-Z][\w:-]*)/i.exec(tag)?.[1] ?? "span";
      return `</${name}>`;
    })
    .join("");
}

function packPieces(pieces: string[], fits: (fragment: string) => boolean): string[] {
  const pages: string[] = [];
  let current = "";

  const commit = () => {
    if (!isVisibleHtml(current)) {
      current = "";
      return;
    }
    pages.push(current + closeOpenTags(current));
    current = openTags(current).join("");
  };

  for (const piece of pieces) {
    const next = current + piece;
    if (!current || fits(next)) {
      current = next;
      continue;
    }
    commit();
    current += piece;
  }
  if (isVisibleHtml(current)) pages.push(current + closeOpenTags(current));
  return pages;
}

function splitOversized(page: string, fits: (fragment: string) => boolean): string[] {
  const tokens = page.match(/<[^>]+>|[^<\s]+|\s+/g);
  if (!tokens || tokens.length < 2) return [page];
  const pieces = packPieces(tokens, fits);
  return pieces.length ? pieces : [page];
}

function matchWrappedSpan(html: string, start: number): number {
  let depth = 0;
  const re = /<\/?span\b[^>]*>/gi;
  re.lastIndex = start;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    if (match[0][1] === "/") {
      depth -= 1;
      if (depth === 0) return match.index + match[0].length;
    } else {
      depth += 1;
    }
  }
  return html.length;
}

function layoutUnits(html: string): string[] {
  const units: string[] = [];
  let index = 0;
  while (index < html.length) {
    const mathAt = html.indexOf('<span class="exam-math"', index);
    const imgFrom = html.slice(index).search(/<img\b/i);
    const imgAt = imgFrom >= 0 ? index + imgFrom : -1;
    const nextSpecial =
      mathAt >= 0 && (imgAt < 0 || mathAt <= imgAt)
        ? { kind: "math" as const, at: mathAt }
        : imgAt >= 0
          ? { kind: "img" as const, at: imgAt }
          : null;
    if (!nextSpecial) {
      units.push(...html.slice(index).split(BR_SPLIT).filter(Boolean));
      break;
    }
    if (nextSpecial.at > index) {
      units.push(...html.slice(index, nextSpecial.at).split(BR_SPLIT).filter(Boolean));
    }
    if (nextSpecial.kind === "math") {
      const end = matchWrappedSpan(html, nextSpecial.at);
      units.push(html.slice(nextSpecial.at, end));
      index = end;
    } else {
      const end = html.indexOf(">", nextSpecial.at);
      units.push(html.slice(nextSpecial.at, end + 1));
      index = end + 1;
    }
  }
  return units.filter((unit) => unit.length > 0);
}

export function packHtmlToFit(html: string, fits: (fragment: string) => boolean): string[] {
  const units = layoutUnits(html);
  const pages = packPieces(units.length ? units : [html], fits);
  return pages.flatMap((page) => {
    if (fits(page) || page.includes("exam-math") || page.includes("<img")) return [page];
    return splitOversized(page, fits);
  });
}

const BODY_FONT_PX = 15;

export function layoutA4Sheets(
  html: string,
  probe: HTMLElement,
  maxHeight: number,
): FittedSheet[] {
  const source = html.trim() ? html : "";
  probe.style.fontSize = `${BODY_FONT_PX}px`;
  if (!source) return [{ html: "", fontPx: BODY_FONT_PX }];

  const fits = (fragment: string) => {
    probe.innerHTML = fragment;
    return probe.scrollHeight <= maxHeight - 4;
  };
  if (fits(source) || source.includes('class="solution-block"')) return [{ html: source, fontPx: BODY_FONT_PX }];

  const pages = packHtmlToFit(source, fits).filter(isVisibleHtml);
  return (pages.length ? pages : [source]).map((part) => ({ html: part, fontPx: BODY_FONT_PX }));
}
