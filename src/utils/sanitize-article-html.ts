const ALLOWED_TAGS = new Set([
  "p", "div", "span", "h1", "h2", "h3", "h4", "h5", "h6",
  "strong", "b", "em", "i", "u", "s", "del", "mark", "small",
  "sub", "sup", "br", "hr", "blockquote", "pre", "code",
  "ul", "ol", "li", "a", "img", "table", "caption", "thead",
  "tbody", "tfoot", "tr", "th", "td", "font"
]);

const VOID_TAGS = new Set(["br", "hr", "img"]);
const DROP_CONTENT_TAGS = new Set(["script", "style", "iframe", "object", "embed", "svg", "math", "template", "noscript"]);
const HTML_LEADING_TAG = /^\s*<(?:!doctype\b|!--|\/?(?:html|body|p|div|span|h[1-6]|strong|b|em|i|u|s|del|mark|small|sub|sup|br|hr|blockquote|pre|code|ul|ol|li|a|img|table|caption|thead|tbody|tfoot|tr|th|td|font|script|style|iframe|object|embed|svg|math|template|noscript)\b)/i;

export function isHtmlArticleContent(value: unknown): boolean {
  return HTML_LEADING_TAG.test(String(value ?? ""));
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&(?!(?:amp|lt|gt|quot|#\d+|#x[0-9a-f]+);)/gi, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function safeUrl(value: string, image = false): string | null {
  const candidate = value.trim().replace(/[\u0000-\u0020\u007f]+/g, "");
  const decoded = candidate
    .replace(/&#(?:x([0-9a-f]+)|(\d+));?/gi, (_entity, hex, decimal) => {
      const codePoint = Number.parseInt(hex || decimal, hex ? 16 : 10);
      return codePoint > 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : "";
    })
    .replace(/&colon;/gi, ":")
    .replace(/&tab;/gi, "\t")
    .replace(/&newline;/gi, "\n")
    .replace(/&sol;/gi, "/")
    .replace(/[\u0000-\u0020\u007f]+/g, "");

  if (!candidate || !decoded || /^(?:javascript|vbscript|data|file):/i.test(decoded)) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(decoded)) {
    if (/^https?:\/\//i.test(decoded) && /^https?:\/\//i.test(candidate)) return candidate;
    if (!image && /^(?:mailto|tel):/i.test(decoded) && /^(?:mailto|tel):/i.test(candidate)) return candidate;
    return null;
  }
  if (candidate.startsWith("/") && !candidate.startsWith("//") && decoded.startsWith("/") && !decoded.startsWith("//")) return candidate;
  if (candidate.startsWith("#") && decoded.startsWith("#")) return candidate;
  if (/^\.\.?\//.test(candidate) && /^\.\.?\//.test(decoded)) return candidate;
  return null;
}
function safeColor(value: string): boolean {
  return /^(?:#[0-9a-f]{3,8}|(?:rgb|rgba|hsl|hsla)\([\d\s.,%+-]+\)|[a-z]{1,24})$/i.test(value.trim());
}

function safeCssValue(property: string, value: string): boolean {
  const clean = value.trim();
  if (!clean || /url\s*\(|expression\s*\(|javascript:|@import|[<>]/i.test(clean)) return false;

  switch (property) {
    case "color":
    case "background-color":
      return safeColor(clean);
    case "font-size": {
      const match = clean.match(/^(\d{1,3}(?:\.\d+)?)(px|pt|em|rem|%)$/i);
      return Boolean(match && Number(match[1]) > 0 && Number(match[1]) <= 144);
    }
    case "font-family":
      return /^[a-z0-9 _"',-]{1,100}$/i.test(clean);
    case "font-weight":
      return /^(?:normal|bold|[1-9]00)$/i.test(clean);
    case "font-style":
      return /^(?:normal|italic|oblique)$/i.test(clean);
    case "text-align":
      return /^(?:left|right|center|justify|start|end)$/i.test(clean);
    case "text-decoration":
      return /^(?:none|underline|overline|line-through|underline line-through)$/i.test(clean);
    case "vertical-align":
      return /^(?:baseline|sub|super|top|middle|bottom|-?\d+(?:\.\d+)?(?:px|em|rem|%))$/i.test(clean);
    case "line-height":
      return /^(?:normal|\d+(?:\.\d+)?(?:px|em|rem|%)?)$/i.test(clean);
    case "width":
    case "height":
      return /^(?:\d{1,4}(?:\.\d+)?(?:px|%|em|rem)?|auto)$/i.test(clean);
    case "border":
      return /^(?:(?:0|\d{1,2}px)\s+(?:none|solid|dashed|dotted|double)\s+)?(?:#[0-9a-f]{3,8}|[a-z]{1,20})?$/i.test(clean);
    case "border-collapse":
      return /^(?:collapse|separate)$/i.test(clean);
    case "padding":
    case "margin":
      return /^(?:auto|0|\d{1,3}(?:\.\d+)?(?:px|pt|em|rem|%))(?:\s+(?:auto|0|\d{1,3}(?:\.\d+)?(?:px|pt|em|rem|%))){0,3}$/i.test(clean);
    default:
      return false;
  }
}

function sanitizeStyle(value: string): string {
  const allowed = new Set([
    "color", "background-color", "font-size", "font-family", "font-weight",
    "font-style", "text-align", "text-decoration", "vertical-align",
    "line-height", "width", "height", "border", "border-collapse", "padding", "margin"
  ]);
  const declarations: string[] = [];
  for (const declaration of value.split(";")) {
    const separator = declaration.indexOf(":");
    if (separator < 1) continue;
    const property = declaration.slice(0, separator).trim().toLowerCase();
    const rawValue = declaration.slice(separator + 1).trim();
    if (!allowed.has(property) || !safeCssValue(property, rawValue)) continue;
    declarations.push(property + ":" + rawValue);
  }
  return declarations.join(";");
}

function sanitizeAttributes(tag: string, source: string): string {
  const attrs: string[] = [];
  const allowedByTag: Record<string, Set<string>> = {
    a: new Set(["href", "title"]),
    img: new Set(["src", "alt", "title", "width", "height"]),
    td: new Set(["colspan", "rowspan"]),
    th: new Set(["colspan", "rowspan", "scope"]),
    table: new Set(["border", "cellpadding", "cellspacing"]),
    font: new Set(["face", "color", "size"])
  };
  const allowed = allowedByTag[tag] ?? new Set<string>();
  const expression = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>]+)))?/g;
  let match: RegExpExecArray | null;
  while ((match = expression.exec(source))) {
    const name = match[1].toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? "";
    if (name === "style") {
      const style = sanitizeStyle(value);
      if (style) attrs.push('style="' + escapeAttribute(style) + '"');
      continue;
    }
    if (name === "dir" && /^(?:ltr|rtl|auto)$/i.test(value)) {
      attrs.push('dir="' + value.toLowerCase() + '"');
      continue;
    }
    if (!allowed.has(name)) continue;
    if (name === "href" || name === "src") {
      const url = safeUrl(value, tag === "img" && name === "src");
      if (url) attrs.push(name + '="' + escapeAttribute(url) + '"');
      continue;
    }
    if (["width", "height", "colspan", "rowspan", "border", "cellpadding", "cellspacing", "size"].includes(name)) {
      if (/^\d{1,4}$/.test(value) && Number(value) > 0) attrs.push(name + '="' + value + '"');
      continue;
    }
    if (name === "scope" && /^(?:row|col|rowgroup|colgroup)$/i.test(value)) {
      attrs.push('scope="' + value.toLowerCase() + '"');
      continue;
    }
    if (name === "face") {
      if (/^[a-z0-9 _"',-]{1,100}$/i.test(value)) attrs.push('face="' + escapeAttribute(value) + '"');
      continue;
    }
    if (name === "color") {
      if (safeColor(value)) attrs.push('color="' + escapeAttribute(value) + '"');
      continue;
    }
    if (name === "alt" || name === "title") {
      attrs.push(name + '="' + escapeAttribute(value.slice(0, 500)) + '"');
    }
  }

  if (tag === "a") {
    attrs.push('target="_blank"', 'rel="noopener noreferrer"');
  }
  return attrs.length ? " " + attrs.join(" ") : "";
}

function tokenizeHtml(source: string): string[] {
  const tokens: string[] = [];
  let index = 0;
  while (index < source.length) {
    if (source[index] !== "<") {
      const nextTag = source.indexOf("<", index);
      const end = nextTag < 0 ? source.length : nextTag;
      tokens.push(source.slice(index, end));
      index = end;
      continue;
    }

    if (index + 1 < source.length && !/[a-z/!?]/i.test(source[index + 1])) {
      tokens.push("<");
      index += 1;
      continue;
    }

    const start = index;
    let quote: string | null = null;
    index += 1;
    while (index < source.length) {
      const char = source[index];
      if (quote) {
        if (char === quote && source[index - 1] !== "\\") quote = null;
      } else if (char === '"' || char === "'") {
        quote = char;
      } else if (char === ">") {
        index += 1;
        break;
      }
      index += 1;
    }
    tokens.push(source.slice(start, index));
  }
  return tokens;
}

export function sanitizeArticleHtml(value: unknown): string {
  let source = String(value ?? "");
  source = source.replace(/<!--[\s\S]*?-->/g, "");
  source = source.replace(/<(script|style|iframe|object|embed|svg|math|template|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "");

  const tokens = tokenizeHtml(source);
  const output: string[] = [];
  const stack: string[] = [];
  let dropTag: string | null = null;

  for (const token of tokens) {
    const tagMatch = token.match(/^<\s*(\/?)\s*([a-z][a-z0-9:-]*)\b([^>]*)>$/i);
    if (!tagMatch) {
      if (dropTag) continue;
      output.push(token.startsWith("<") ? token.replace(/</g, "&lt;") : token);
      continue;
    }

    const closing = Boolean(tagMatch[1]);
    const tag = tagMatch[2].toLowerCase();
    if (DROP_CONTENT_TAGS.has(tag)) {
      if (!closing) dropTag = tag;
      else if (dropTag === tag) dropTag = null;
      continue;
    }
    if (dropTag) continue;
    if (!ALLOWED_TAGS.has(tag)) continue;

    if (closing) {
      if (VOID_TAGS.has(tag)) continue;
      const index = stack.lastIndexOf(tag);
      if (index < 0) continue;
      for (let i = stack.length - 1; i >= index; i -= 1) output.push("</" + stack[i] + ">");
      stack.length = index;
      continue;
    }

    let attrs = tagMatch[3].replace(/\/\s*$/, "");
    if (tag === "font") {
      const fontMatch = attrs.match(/\bsize\s*=\s*(?:"([1-7])"|'([1-7])'|([1-7]))/i);
      if (fontMatch) {
        const legacySizes: Record<string, string> = { "1": "10px", "2": "13px", "3": "16px", "4": "18px", "5": "24px", "6": "32px", "7": "48px" };
        attrs += ' style="font-size:' + legacySizes[fontMatch[1] ?? fontMatch[2] ?? fontMatch[3]] + '"';
      }
    }
    output.push("<" + tag + sanitizeAttributes(tag, attrs) + ">");
    if (!VOID_TAGS.has(tag)) stack.push(tag);
  }

  for (let i = stack.length - 1; i >= 0; i -= 1) output.push("</" + stack[i] + ">");
  return output.join("");
}
