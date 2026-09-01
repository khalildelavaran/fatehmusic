const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "PRE", "CODE", "TEXTAREA", "INPUT", "SELECT", "OPTION"]);

function toPersianDigits(value: string): string {
  return value.replace(/[0-9]/g, (digit) => PERSIAN_DIGITS[Number(digit)]);
}

function convertTextNodes(root: Node): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (parent && SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
      return /[0-9]/.test(node.nodeValue ?? "") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });

  const nodes: Text[] = [];
  let current: Node | null = walker.nextNode();
  while (current) {
    nodes.push(current as Text);
    current = walker.nextNode();
  }

  for (const node of nodes) node.nodeValue = toPersianDigits(node.nodeValue ?? "");
}

function startPersianDigits(): void {
  convertTextNodes(document.body);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "characterData" && mutation.target.nodeType === Node.TEXT_NODE) {
        const parent = (mutation.target as Text).parentElement;
        if (!parent || !SKIP_TAGS.has(parent.tagName)) {
          const value = mutation.target.nodeValue ?? "";
          const converted = toPersianDigits(value);
          if (converted !== value) mutation.target.nodeValue = converted;
        }
      }

      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          const value = node.nodeValue ?? "";
          const converted = toPersianDigits(value);
          if (converted !== value) node.nodeValue = converted;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as Element;
          if (!SKIP_TAGS.has(element.tagName)) convertTextNodes(element);
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startPersianDigits, { once: true });
} else {
  startPersianDigits();
}
