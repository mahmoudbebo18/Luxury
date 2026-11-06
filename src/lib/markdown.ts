// A small Markdown renderer for the legal pages (site_pages). Shared by the build (vite.config.ts writes
// the static pages) and the admin editor preview, so both show exactly the same thing.
// Supports: ## / ### headings, paragraphs, - and 1. lists, **bold**, *italic*, [links](/path),
// and marks a bare [placeholder] (text the client still has to give us) so it stands out.

export interface Heading {
  id: string;
  text: string;
}

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const safeHref = (href: string) => (/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(href) ? href : '#');

function inline(text: string): string {
  // Links are set aside first so bold/italic/placeholder rules never touch their markup.
  const links: string[] = [];
  const keep = (html: string) => `\u0000${links.push(html) - 1}\u0000`;
  let s = escape(text);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, href: string) => {
    const external = /^https?:\/\//i.test(href);
    return keep(`<a href="${safeHref(href)}"${external ? ' target="_blank" rel="noopener"' : ''}>${label}</a>`);
  });
  s = s.replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, (email) => keep(`<a href="mailto:${email}" dir="ltr">${email}</a>`));
  s = s.replace(/\[([^\]]+)\]/g, '<mark class="pending">[$1]</mark>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => links[Number(i)]);
}

const slugify = (text: string, used: Set<string>, index: number) => {
  let id = text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  if (!id || used.has(id)) id = `section-${index}`;
  used.add(id);
  return id;
};

export function renderMarkdown(md: string): { html: string; headings: Heading[] } {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  const headings: Heading[] = [];
  const used = new Set<string>();
  let para: string[] = [];
  let list: { tag: 'ul' | 'ol'; items: string[] } | null = null;

  const flushPara = () => {
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) out.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`);
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    const h = /^(#{2,3})\s+(.+)$/.exec(line);
    const ul = /^[-*]\s+(.+)$/.exec(line);
    const ol = /^\d+[.)]\s+(.+)$/.exec(line);
    if (!line) {
      flushPara();
      flushList();
    } else if (h) {
      flushPara();
      flushList();
      const level = h[1].length;
      const text = h[2].replace(/^#+\s*/, '');
      const id = slugify(text, used, headings.length + 1);
      if (level === 2) headings.push({ id, text: inline(text).replace(/<[^>]+>/g, '') });
      out.push(`<h${level} id="${id}">${inline(text)}</h${level}>`);
    } else if (ul || ol) {
      flushPara();
      const tag = ul ? 'ul' : 'ol';
      if (list && list.tag !== tag) flushList();
      list ??= { tag, items: [] };
      list.items.push((ul ?? ol)![1]);
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return { html: out.join('\n'), headings };
}
