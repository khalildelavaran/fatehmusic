const VOID_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta",
  "param", "source", "track", "wbr"
]);

const ALLOWED_TAGS = new Set([
  "a", "article", "aside", "blockquote", "br", "button", "caption", "code",
  "dd", "del", "details", "div", "dl", "dt", "em", "figcaption", "figure",
  "footer", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "i", "img",
  "input", "label", "li", "main", "mark", "nav", "ol", "p", "pre", "section",
  "small", "span", "strong", "sub", "summary", "sup", "table", "tbody", "td",
  "th", "thead", "tr", "u", "ul"
]);

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseEmmetTerm(source, state) {
  let index = state.index;
  const start = index;
  while (index < source.length && !/[.#[{*+>]/.test(source[index])) index += 1;
  const rawTag = source.slice(start, index).trim();
  const tag = rawTag || "div";
  if (!/^[a-z][a-z0-9-]*$/i.test(tag) || !ALLOWED_TAGS.has(tag.toLowerCase())) return null;

  const node = { tag: tag.toLowerCase(), id: "", classes: [], attributes: [], text: "", repeat: 1, children: [] };
  while (index < source.length) {
    const char = source[index];
    if (char === ".") {
      index += 1;
      const classStart = index;
      while (index < source.length && !/[.#\[{*+>]/.test(source[index])) index += 1;
      const className = source.slice(classStart, index).trim();
      if (className) node.classes.push(className);
      continue;
    }
    if (char === "#") {
      index += 1;
      const idStart = index;
      while (index < source.length && !/[.#\[{*+>]/.test(source[index])) index += 1;
      node.id = source.slice(idStart, index).trim();
      continue;
    }
    if (char === "[") {
      const end = source.indexOf("]", index + 1);
      if (end < 0) return null;
      const rawAttributes = source.slice(index + 1, end);
      const expression = /([a-z_:][\w:.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s]+)))?/gi;
      let match;
      while ((match = expression.exec(rawAttributes))) {
        const name = match[1];
        if (/^on/i.test(name)) continue;
        node.attributes.push([name, match[2] ?? match[3] ?? match[4] ?? ""]);
      }
      index = end + 1;
      continue;
    }
    if (char === "{") {
      const end = source.indexOf("}", index + 1);
      if (end < 0) return null;
      node.text = source.slice(index + 1, end);
      index = end + 1;
      continue;
    }
    if (char === "*") {
      index += 1;
      const countStart = index;
      while (index < source.length && /\d/.test(source[index])) index += 1;
      node.repeat = Math.max(1, Math.min(100, Number(source.slice(countStart, index)) || 1));
      continue;
    }
    break;
  }

  state.index = index;
  return node;
}

function cloneNodeWithIndex(node, index) {
  const substitute = (value) => value.replace(/\$+/g, (marker) => String(index).padStart(marker.length, "0"));
  return {
    ...node,
    id: substitute(node.id),
    classes: node.classes.map(substitute),
    attributes: node.attributes.map(([name, value]) => [name, substitute(value)]),
    text: substitute(node.text),
    repeat: 1,
    children: node.children.map((child) => cloneNodeWithIndex(child, index))
  };
}

function parseEmmetList(source, state, depth = 0) {
  if (depth > 24) return null;
  const nodes = [];
  while (state.index < source.length) {
    const term = parseEmmetTerm(source, state);
    if (!term) return null;
    if (source[state.index] === ">") {
      state.index += 1;
      term.children = parseEmmetList(source, state, depth + 1);
      if (!term.children?.length) return null;
    }
    for (let i = 1; i <= term.repeat; i += 1) nodes.push(cloneNodeWithIndex(term, i));
    if (nodes.length > 1000) return null;
    if (source[state.index] === "+") {
      state.index += 1;
      continue;
    }
    break;
  }
  return nodes;
}

function renderEmmetNode(node, depth = 0) {
  const indent = "  ".repeat(depth);
  const attributes = [];
  if (node.id) attributes.push('id="' + escapeHtml(node.id) + '"');
  if (node.classes.length) attributes.push('class="' + escapeHtml(node.classes.join(" ")) + '"');
  for (const [name, value] of node.attributes) {
    if (/^on/i.test(name) || !/^[a-z_:][\w:.-]*$/i.test(name)) continue;
    attributes.push(name + '="' + escapeHtml(value) + '"');
  }
  const opening = "<" + node.tag + (attributes.length ? " " + attributes.join(" ") : "") + ">";
  if (VOID_TAGS.has(node.tag)) return indent + opening.slice(0, -1) + " />";
  const text = node.text ? escapeHtml(node.text) : "";
  if (!node.children.length) return indent + opening + text + "</" + node.tag + ">";
  return indent + opening + (text ? text + "\n" : "\n") +
    node.children.map((child) => renderEmmetNode(child, depth + 1)).join("\n") +
    "\n" + indent + "</" + node.tag + ">";
}

/**
 * Expands a useful, safe subset of Emmet: tags, IDs, classes, attributes,
 * text nodes, child/sibling operators and numeric repetition.
 */
export function expandEmmetAbbreviation(value) {
  const source = String(value ?? "").trim();
  if (!source || source.length > 300 || /[<>\n]/.test(source)) return null;
  const state = { index: 0 };
  const nodes = parseEmmetList(source, state);
  if (!nodes?.length || state.index !== source.length) return null;
  return nodes.map((node) => renderEmmetNode(node)).join("\n");
}

export function formatHtmlSource(source) {
  const tokens = String(source ?? "")
    .replace(/>\s*</g, ">\n<")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const output = [];
  let depth = 0;
  let inPreformatted = false;
  for (const token of tokens) {
    if (inPreformatted) {
      output.push(token);
      if (/^<\/(?:pre|textarea|script|style)\b/i.test(token)) inPreformatted = false;
      continue;
    }
    const closeTag = token.match(/^<\/([a-z][\w:-]*)/i);
    const openTag = token.match(/^<([a-z][\w:-]*)\b/i);
    if (closeTag) depth = Math.max(0, depth - 1);
    output.push("  ".repeat(depth) + token);
    if (openTag && /^(?:pre|textarea|script|style)$/i.test(openTag[1]) && !closeTag) {
      inPreformatted = true;
    } else if (openTag && !closeTag && !VOID_TAGS.has(openTag[1].toLowerCase()) && !/\/>$/.test(token)) {
      depth += 1;
    }
  }
  return output.join("\n");
}
