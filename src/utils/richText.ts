/**
 * Rich Text & Formatting Utilities
 * Provides seamless conversion between WYSIWYG HTML, legacy Markdown, and plain text.
 */

/**
 * Strips HTML tags and decodes common entities to produce clean plain text.
 */
export function stripHtml(input: string): string {
  if (!input) return '';
  return input
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Accurately counts words from rich text content by stripping HTML tags first.
 */
export function countWords(input: string): number {
  const plain = stripHtml(input);
  if (!plain) return 0;
  return plain.split(/\s+/).filter(Boolean).length;
}

/**
 * Converts legacy markdown syntax to semantic HTML if content does not already contain HTML.
 * Handles **bold**, *italic*, > blockquote, and - list items.
 */
export function markdownToHtml(content: string): string {
  if (!content) return '';

  // If it already looks like HTML (has common HTML tags), return it directly
  if (/<(p|div|b|strong|i|em|ul|ol|li|blockquote|h[1-6]|br)[^>]*>/i.test(content)) {
    return content;
  }

  // Otherwise, safely convert legacy markdown to HTML
  let html = content;

  // Escape raw HTML entities to prevent unintentional injection
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Blockquotes: lines starting with &gt; or >
  html = html.replace(/^(&gt;|>)[ \t]?(.*)$/gm, '<blockquote>$2</blockquote>');

  // Bold: **text** or __text__
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

  // Italic: *text* or _text_
  html = html.replace(/\*([^*]+?)\*/g, '<em>$1</em>');
  html = html.replace(/_([^_]+?)_/g, '<em>$1</em>');

  // Unordered list items: - item or * item
  html = html.replace(/^[ \t]*[-*][ \t]+(.*)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>(?:(?!<\/li>)[\s\S])*?<\/li>(?:\s*<li>[\s\S]*?<\/li>)*)/g, '<ul>$1</ul>');
  html = html.replace(/<\/ul>\s*<ul>/g, '');

  // Split into paragraphs by double newlines
  const sections = html.split(/\n\n+/);
  const formattedSections = sections
    .map((sec) => {
      const trimmed = sec.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('<blockquote>') || trimmed.startsWith('<ul>')) {
        return trimmed;
      }
      return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
    })
    .filter(Boolean);

  return formattedSections.length > 0 ? formattedSections.join('') : '';
}

/**
 * Converts rich text HTML back to clean Markdown (used for journal exports).
 */
export function htmlToMarkdown(html: string): string {
  if (!html) return '';
  let md = html;

  // Convert blockquotes
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_m, p1) => {
    const inner = stripHtml(p1).trim();
    return `\n> ${inner}\n`;
  });

  // Convert list items
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m, p1) => {
    return `\n- ${stripHtml(p1).trim()}`;
  });
  md = md.replace(/<\/?ul[^>]*>/gi, '\n');
  md = md.replace(/<\/?ol[^>]*>/gi, '\n');

  // Convert bold
  md = md.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**');

  // Convert italic
  md = md.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*');

  // Convert line breaks and paragraph ends
  md = md.replace(/<br\s*\/?>/gi, '\n');
  md = md.replace(/<\/p>/gi, '\n\n');
  md = md.replace(/<p[^>]*>/gi, '');
  md = md.replace(/<\/div>/gi, '\n');
  md = md.replace(/<div[^>]*>/gi, '');

  // Strip remaining HTML tags
  md = md.replace(/<[^>]+>/g, '');

  // Decode common HTML entities
  md = md
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  return md.trim();
}
