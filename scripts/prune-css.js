// Per-page CSS pruning for the inlined stylesheet.
// Keeps a rule when every class in at least one of its selectors appears in the page's HTML
// (or is added at runtime by main.js — see SAFE). Ids, tags and attributes are never pruned on,
// so the result is conservative: it can keep a little too much, never too little.
// @font-face, @keyframes and other non-selector at-rules are kept whole.

// Google's translator injects its own classes (skiptranslate, goog-*, VIpgJd-*) after load: keep rules for them.
const SAFE = (c) => /^(is-|goog-|VIpgJd-)/.test(c) || ["js", "no-scroll", "fold-toggle", "no-motion", "skiptranslate", "translated-ltr", "lenis", "lenis-stopped", "lenis-smooth", "has-motion", "motion-failed", "w", "xhero__flyer", "was-on"].includes(c);

// Split a (minified) stylesheet into top-level blocks: [{ head, body }] where body is the text inside { }.
function blocks(css) {
  const out = [];
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf("{", i);
    if (open < 0) break;
    const head = css.slice(i, open).trim();
    let depth = 1, j = open + 1;
    while (j < css.length && depth) {
      const ch = css[j];
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      else if (ch === '"' || ch === "'") { j = css.indexOf(ch, j + 1); }
      j++;
    }
    out.push({ head, body: css.slice(open + 1, j - 1) });
    i = j;
  }
  return out;
}

const classesIn = (sel) => [...sel.replace(/\[[^\]]*\]/g, "").replace(/:not\(([^)]*)\)/g, "").matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]);

function prune(css, has) {
  let out = "";
  for (const { head, body } of blocks(css)) {
    if (head.startsWith("@media") || head.startsWith("@supports") || head.startsWith("@container") || head.startsWith("@layer")) {
      const inner = prune(body, has);
      if (inner) out += `${head}{${inner}}`;
    } else if (head.startsWith("@")) {
      out += `${head}{${body}}`;
    } else {
      const sels = splitSelectors(head).filter((s) => classesIn(s).every((c) => has.has(c) || SAFE(c)));
      if (sels.length) out += `${sels.join(",")}{${body}}`;
    }
  }
  return out;
}

// Split a selector list on top-level commas (not inside :is()/:where()/:not() parentheses).
function splitSelectors(head) {
  const out = [];
  let depth = 0, start = 0;
  for (let i = 0; i < head.length; i++) {
    const ch = head[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "," && depth === 0) { out.push(head.slice(start, i)); start = i + 1; }
  }
  out.push(head.slice(start));
  return out.map((s) => s.trim()).filter(Boolean);
}

export function pruneFor(css, html) {
  const has = new Set();
  for (const m of html.matchAll(/\sclass="([^"]*)"/g)) for (const c of m[1].split(/\s+/)) if (c) has.add(c);
  return prune(css, has);
}
