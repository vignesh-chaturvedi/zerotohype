const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * A line of text with three bits of Markdown, `code`, **bold** and [links](…), as HTML. Links can go
 * to https:// pages, to pages on this site, or to anchors on the same page.
 */
export const inlineMd = (s: string) =>
  escape(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(((?:https:\/\/|\/|#)[^)\s]+)\)/g, '<a href="$2">$1</a>');
