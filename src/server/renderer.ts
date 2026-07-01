export type HtmlDocumentInput = {
  title: string;
  html: string;
  publishedAt?: string;
  versionLabel?: string;
};

type PlanningSection = {
  id: string;
  label: string;
  body: string;
  geo?: string;
};

export type PlanningSectionMetadata = {
  id: string;
  title: string;
  href: string;
  geo: string | null;
  required: boolean;
  order: number;
};

const PLANNING_SECTIONS: PlanningSection[] = [
  {
    id: "answer-summary",
    label: "Answer Summary",
    geo: "answer-summary",
    body: "<p class=\"marklog-placeholder\">State the concise answer this document provides so AI systems can quote it directly.</p>"
  },
  {
    id: "source-of-truth",
    label: "Source of Truth",
    geo: "source-of-truth",
    body: "<ul><li class=\"marklog-placeholder\">List stable decisions, canonical facts, and rules that downstream AI agents should preserve.</li></ul>"
  },
  {
    id: "summary",
    label: "Summary",
    body: "<p class=\"marklog-placeholder\">State the document purpose, product surface, and current recommendation.</p>"
  },
  {
    id: "target-reader",
    label: "Target Reader",
    body: "<p class=\"marklog-placeholder\">Describe who should read this page: product, design, engineering, leadership, QA, or AI agents.</p>"
  },
  {
    id: "context",
    label: "Context",
    body: "<p class=\"marklog-placeholder\">Capture the background, constraints, related decisions, and non-goals.</p>"
  },
  {
    id: "goals",
    label: "Goals",
    body: "<ul><li class=\"marklog-placeholder\">Add measurable product or workflow goals.</li></ul>"
  },
  {
    id: "decision-log",
    label: "Decision Log",
    body: "<table><thead><tr><th>Decision</th><th>Reason</th><th>Status</th></tr></thead><tbody><tr><td class=\"marklog-placeholder\">TBD</td><td class=\"marklog-placeholder\">TBD</td><td>Open</td></tr></tbody></table>"
  },
  {
    id: "user-flow",
    label: "User Flow",
    body: "<ol><li class=\"marklog-placeholder\">Describe the first user or AI-reader step.</li></ol>"
  },
  {
    id: "wireframe",
    label: "Wireframe",
    body: "<div class=\"marklog-wireframe\" data-marklog-block=\"wireframe\"><div>Navigation / source tree</div><div>Primary content</div><div>Revision and comments</div></div>"
  },
  {
    id: "mockup",
    label: "Mockup",
    body: "<div class=\"marklog-mockup\" data-marklog-block=\"mockup\"><aside>Structure</aside><main>Planning surface</main><aside>Context</aside></div>"
  },
  {
    id: "requirements",
    label: "Requirements",
    body: "<ul><li class=\"marklog-placeholder\">Add functional, UX, data, and operational requirements.</li></ul>"
  },
  {
    id: "open-questions",
    label: "Open Questions",
    body: "<ul><li class=\"marklog-placeholder\">List unresolved decisions and owners.</li></ul>"
  },
  {
    id: "ai-notes",
    label: "AI Notes",
    body: "<p class=\"marklog-placeholder\">Summarize stable facts, assumptions, and section links that an AI agent should preserve.</p>"
  }
];

export function preparePlanningHtml(input: HtmlDocumentInput): string {
  const sanitized = stripExecutableHtml(input.html.trim());
  const html = isFullHtmlDocument(sanitized)
    ? sanitized
    : wrapHtmlFragment({
        ...input,
        html: sanitized || `<p>${escapeHtml(input.title)}</p>`
      });

  return normalizePlanningDocument(addArchiveMetadata(html, input));
}

export function starterHtmlDocument(title: string): string {
  const escapedTitle = escapeHtml(title);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapedTitle}</title>
  <style>
    body {
      margin: 0;
      padding: 40px 24px;
      color: #1f2937;
      background: #f6f7f9;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.6;
    }
    main {
      max-width: 920px;
      margin: 0 auto;
      background: #fff;
      border: 1px solid #d9dee5;
      padding: 44px;
    }
    h1, h2, h3 {
      line-height: 1.25;
    }
    [id] {
      scroll-margin-top: 24px;
    }
    #section-index {
      margin: 24px 0 32px;
      border: 1px solid #d9dee5;
      background: #f8fafc;
      padding: 18px;
    }
    #section-index h2 {
      margin-top: 0;
      font-size: 1rem;
    }
    #section-index ol {
      columns: 2;
      padding-left: 22px;
    }
    section {
      margin-top: 32px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      border: 1px solid #d9dee5;
      padding: 8px 10px;
      text-align: left;
    }
    th {
      background: #eef2f6;
    }
    .marklog-placeholder {
      color: #637083;
    }
    .marklog-wireframe {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }
    .marklog-wireframe div {
      min-height: 88px;
      border: 1px dashed #7d8da1;
      background: repeating-linear-gradient(-45deg, #ffffff, #ffffff 10px, #eef2f6 10px, #eef2f6 20px);
      padding: 12px;
    }
    .marklog-mockup {
      display: grid;
      grid-template-columns: 180px 1fr 220px;
      min-height: 240px;
      border: 1px solid #94a3b8;
      background: #e2e8f0;
    }
    .marklog-mockup > * {
      padding: 14px;
      border-right: 1px solid #94a3b8;
      background: #f8fafc;
    }
    .marklog-mockup main {
      display: grid;
      place-items: center;
      margin: 0;
      border: 0;
      background: #ffffff;
      padding: 14px;
    }
  </style>
</head>
<body>
  <main>
    <h1>${escapedTitle}</h1>
    ${sectionIndex()}
    <section id="summary" data-marklog-section="summary">
      <h2>Summary</h2>
      <p class="marklog-placeholder">State the document purpose, product surface, and current recommendation.</p>
    </section>
    <section id="target-reader" data-marklog-section="target-reader">
      <h2>Target Reader</h2>
      <p class="marklog-placeholder">Describe who should read this page: product, design, engineering, leadership, QA, or AI agents.</p>
    </section>
    <section id="context" data-marklog-section="context">
      <h2>Context</h2>
      <p class="marklog-placeholder">Capture the background, constraints, related decisions, and non-goals.</p>
    </section>
    <section id="goals" data-marklog-section="goals">
      <h2>Goals</h2>
      <ul><li class="marklog-placeholder">Add measurable product or workflow goals.</li></ul>
    </section>
    <section id="decision-log" data-marklog-section="decision-log">
      <h2>Decision Log</h2>
      <table>
        <thead><tr><th>Decision</th><th>Reason</th><th>Status</th></tr></thead>
        <tbody><tr><td class="marklog-placeholder">TBD</td><td class="marklog-placeholder">TBD</td><td>Open</td></tr></tbody>
      </table>
    </section>
    <section id="user-flow" data-marklog-section="user-flow">
      <h2>User Flow</h2>
      <ol><li class="marklog-placeholder">Describe the first user or AI-reader step.</li></ol>
    </section>
    <section id="wireframe" data-marklog-section="wireframe">
      <h2>Wireframe</h2>
      <div class="marklog-wireframe" data-marklog-block="wireframe">
        <div>Navigation / source tree</div>
        <div>Primary content</div>
        <div>Revision and comments</div>
      </div>
    </section>
    <section id="mockup" data-marklog-section="mockup">
      <h2>Mockup</h2>
      <div class="marklog-mockup" data-marklog-block="mockup">
        <aside>Structure</aside>
        <main>Planning surface</main>
        <aside>Context</aside>
      </div>
    </section>
    <section id="requirements" data-marklog-section="requirements">
      <h2>Requirements</h2>
      <ul><li class="marklog-placeholder">Add functional, UX, data, and operational requirements.</li></ul>
    </section>
    <section id="open-questions" data-marklog-section="open-questions">
      <h2>Open Questions</h2>
      <ul><li class="marklog-placeholder">List unresolved decisions and owners.</li></ul>
    </section>
    <section id="ai-notes" data-marklog-section="ai-notes">
      <h2>AI Notes</h2>
      <p class="marklog-placeholder">Summarize stable facts, assumptions, and section links that an AI agent should preserve.</p>
    </section>
    <section id="legacy-overview" data-marklog-section="legacy-overview">
      <h2>Overview</h2>
      <p>Paste or generate the AI-produced HTML planning document here.</p>
    </section>
  </main>
</body>
</html>`;
}

function wrapHtmlFragment(input: HtmlDocumentInput): string {
  const title = escapeHtml(input.title);
  const publishedAt = input.publishedAt ? escapeHtml(input.publishedAt) : "Draft";
  const version = input.versionLabel ? `<span>${escapeHtml(input.versionLabel)}</span>` : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 40px 24px;
      color: #1f2937;
      background: #f6f7f9;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.6;
    }
    main {
      max-width: 920px;
      margin: 0 auto;
      background: #fff;
      border: 1px solid #d9dee5;
      padding: 44px;
    }
    header {
      margin-bottom: 28px;
      border-bottom: 1px solid #d9dee5;
      padding-bottom: 18px;
    }
    header h1 {
      margin: 0 0 6px;
    }
    header p {
      margin: 0;
      color: #637083;
      font-size: 0.9rem;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      border: 1px solid #d9dee5;
      padding: 8px 10px;
      text-align: left;
    }
    th {
      background: #eef2f6;
    }
    .marklog-placeholder {
      color: #637083;
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>${title}</h1>
      <p>${publishedAt} ${version}</p>
    </header>
    <article>
${input.html}
    </article>
  </main>
</body>
</html>`;
}

export function normalizePlanningDocument(html: string): string {
  let next = html;
  const usedIds = collectIds(next);
  next = addSectionAnchors(next, usedIds);
  next = addHeadingAnchors(next, usedIds);
  next = ensureRequiredPlanningSections(next);
  next = ensureSectionIndex(next);
  next = ensureStructureStyles(next);
  return next;
}

export function extractPlanningSections(html: string): PlanningSectionMetadata[] {
  const sections: PlanningSectionMetadata[] = [];
  const seen = new Set<string>();
  let order = 1;

  for (const match of html.matchAll(/<section\b([^>]*)>([\s\S]*?)<\/section>/gi)) {
    const attrs = match[1] ?? "";
    const content = match[2] ?? "";
    const id = getAttributeValue(attrs, "id");
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    sections.push({
      id,
      title: sectionTitle(content),
      href: `#${id}`,
      geo: getAttributeValue(attrs, "data-marklog-geo"),
      required: PLANNING_SECTIONS.some((section) => section.id === id),
      order
    });
    order += 1;
  }

  return sections;
}

export function planningSectionContract(): Array<{ id: string; title: string; href: string; geo: string | null }> {
  return PLANNING_SECTIONS.map((section) => ({
    id: section.id,
    title: section.label,
    href: `#${section.id}`,
    geo: section.geo ?? null
  }));
}

function addArchiveMetadata(html: string, input: HtmlDocumentInput): string {
  const metadata = [
    "marklog:html-planning-document",
    `title=${input.title}`,
    input.versionLabel ? `version=${input.versionLabel}` : null,
    input.publishedAt ? `published_at=${input.publishedAt}` : null
  ]
    .filter(Boolean)
    .join("; ");

  if (html.includes("marklog:html-planning-document")) {
    return html;
  }
  return html.replace(/<head([^>]*)>/i, `<head$1>\n  <meta name="marklog" content="${escapeHtml(metadata)}">`);
}

function addSectionAnchors(html: string, usedIds: Set<string>): string {
  return html.replace(/<section\b([^>]*)>([\s\S]*?)<\/section>/gi, (_match, attrs: string, content: string) => {
    const id = getAttributeValue(attrs, "id") ?? uniqueId(slugifyAnchor(sectionTitle(content), "section"), usedIds);
    const section = PLANNING_SECTIONS.find((entry) => entry.id === id);
    let nextAttrs = ensureAttribute(ensureAttribute(attrs, "id", id), "data-marklog-section", id);
    if (section?.geo) {
      nextAttrs = ensureAttribute(nextAttrs, "data-marklog-geo", section.geo);
    }
    return `<section${nextAttrs}>${content}</section>`;
  });
}

function addHeadingAnchors(html: string, usedIds: Set<string>): string {
  return html.replace(/<h([1-6])\b([^>]*)>([\s\S]*?)<\/h\1>/gi, (match, level: string, attrs: string, content: string) => {
    if (getAttributeValue(attrs, "id")) {
      return match;
    }
    const id = uniqueId(slugifyAnchor(textContent(content), `heading-${level}`), usedIds);
    return `<h${level}${ensureAttribute(attrs, "id", id)}>${content}</h${level}>`;
  });
}

function ensureRequiredPlanningSections(html: string): string {
  const missing = PLANNING_SECTIONS.filter((section) => !hasId(html, section.id));
  if (missing.length === 0) {
    return html;
  }

  const block = missing
    .map(
      (section) => `
    <section id="${section.id}" data-marklog-section="${section.id}"${section.geo ? ` data-marklog-geo="${section.geo}"` : ""} data-marklog-required="true">
      <h2>${escapeHtml(section.label)}</h2>
      ${section.body}
    </section>`
    )
    .join("\n");

  if (/<\/article>/i.test(html)) {
    return html.replace(/<\/article>/i, `${block}\n    </article>`);
  }
  if (/<\/main>/i.test(html)) {
    return replaceLast(html, /<\/main>/gi, `${block}\n  </main>`);
  }
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `<main>${block}\n  </main>\n</body>`);
  }
  return `${html}\n${block}`;
}

function replaceLast(html: string, pattern: RegExp, replacement: string): string {
  const matches = [...html.matchAll(pattern)];
  const last = matches.at(-1);
  if (!last || last.index === undefined) {
    return html;
  }
  return `${html.slice(0, last.index)}${replacement}${html.slice(last.index + last[0].length)}`;
}

function ensureSectionIndex(html: string): string {
  if (hasId(html, "section-index")) {
    return html;
  }

  const index = sectionIndex();
  if (/<main\b[^>]*>\s*<header\b[\s\S]*?<\/header>/i.test(html)) {
    return html.replace(/(<main\b[^>]*>\s*<header\b[\s\S]*?<\/header>)/i, `$1\n    ${index}`);
  }
  if (/<main\b[^>]*>/i.test(html)) {
    return html.replace(/<main\b([^>]*)>/i, `<main$1>\n    ${index}`);
  }
  if (/<body\b[^>]*>/i.test(html)) {
    return html.replace(/<body\b([^>]*)>/i, `<body$1>\n  <main>\n    ${index}`);
  }
  return `${index}\n${html}`;
}

function sectionIndex(): string {
  const items = PLANNING_SECTIONS.map(
    (section) => `<li><a href="#${section.id}" data-marklog-section-link="${section.id}">${escapeHtml(section.label)}</a></li>`
  ).join("");
  return `<nav id="section-index" data-marklog-section-index aria-label="Section index">
      <h2 id="section-index-heading">Section Index</h2>
      <ol>${items}</ol>
    </nav>`;
}

function ensureStructureStyles(html: string): string {
  if (html.includes("marklog-structure-styles")) {
    return html;
  }

  const styles = `<style id="marklog-structure-styles">
    html {
      scroll-behavior: smooth;
    }
    [id] {
      scroll-margin-top: 24px;
    }
    #section-index {
      margin: 24px 0 32px;
      border: 1px solid #d9dee5;
      background: #f8fafc;
      padding: 18px;
    }
    #section-index h2 {
      margin-top: 0;
      font-size: 1rem;
    }
    #section-index ol {
      columns: 2;
      padding-left: 22px;
    }
    #section-index a {
      overflow-wrap: anywhere;
    }
    section[data-marklog-section] {
      margin-top: 32px;
    }
    .marklog-placeholder {
      color: #637083;
    }
    .marklog-wireframe {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }
    .marklog-wireframe div {
      min-height: 88px;
      border: 1px dashed #7d8da1;
      background: repeating-linear-gradient(-45deg, #ffffff, #ffffff 10px, #eef2f6 10px, #eef2f6 20px);
      padding: 12px;
    }
    .marklog-mockup {
      display: grid;
      grid-template-columns: 180px 1fr 220px;
      min-height: 240px;
      border: 1px solid #94a3b8;
      background: #e2e8f0;
    }
    .marklog-mockup > * {
      padding: 14px;
      border-right: 1px solid #94a3b8;
      background: #f8fafc;
    }
    .marklog-mockup main {
      display: grid;
      place-items: center;
      margin: 0;
      border: 0;
      background: #ffffff;
      padding: 14px;
    }
  </style>`;

  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `  ${styles}\n</head>`);
  }
  return `${styles}\n${html}`;
}

function collectIds(html: string): Set<string> {
  const ids = new Set<string>();
  for (const match of html.matchAll(/\sid\s*=\s*["']([^"']+)["']/gi)) {
    ids.add(match[1] ?? "");
  }
  return ids;
}

function hasId(html: string, id: string): boolean {
  return new RegExp(`\\sid\\s*=\\s*["']${escapeRegExp(id)}["']`, "i").test(html);
}

function getAttributeValue(attrs: string, name: string): string | null {
  const match = attrs.match(new RegExp(`\\s${name}\\s*=\\s*["']([^"']+)["']`, "i"));
  return match?.[1] ?? null;
}

function ensureAttribute(attrs: string, name: string, value: string): string {
  if (getAttributeValue(attrs, name)) {
    return attrs;
  }
  return `${attrs} ${name}="${escapeHtml(value)}"`;
}

function uniqueId(base: string, usedIds: Set<string>): string {
  let candidate = base;
  let index = 2;
  while (usedIds.has(candidate)) {
    candidate = `${base}-${index}`;
    index += 1;
  }
  usedIds.add(candidate);
  return candidate;
}

function sectionTitle(sectionHtml: string): string {
  const heading = sectionHtml.match(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i);
  return heading ? textContent(heading[1] ?? "") : "section";
}

function textContent(html: string): string {
  return decodeBasicEntities(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function decodeBasicEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function slugifyAnchor(value: string, fallback: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripExecutableHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "");
}

function isFullHtmlDocument(value: string): boolean {
  return /<!doctype html/i.test(value) || /<html[\s>]/i.test(value);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
