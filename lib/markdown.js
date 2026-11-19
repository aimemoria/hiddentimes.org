// Markdown → safe HTML, on the server (so search engines and share previews get the real text).
const { marked } = require('marked');
const sanitizeHtml = require('sanitize-html');
const config = require('./config');

const siteHost = (() => { try { return new URL(config.SITE_URL).host; } catch { return ''; } })();

const ALLOWED = {
  allowedTags: [
    'p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote',
    'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 's', 'del', 'u', 'sup', 'sub', 'mark', 'small',
    'a', 'img', 'figure', 'figcaption', 'code', 'pre', 'kbd',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'loading', 'decoding'],
    th: ['align'], td: ['align'],
    ol: ['start'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  allowProtocolRelative: false,
  transformTags: {
    // links to other websites open in a new tab
    a: (tag, attribs) => {
      const href = attribs.href || '';
      let external = false;
      try { external = /^https?:/i.test(href) && new URL(href).host !== siteHost; } catch {}
      return {
        tagName: 'a',
        attribs: external ? { ...attribs, target: '_blank', rel: 'noopener noreferrer' } : attribs,
      };
    },
    img: (tag, attribs) => ({ tagName: 'img', attribs: { ...attribs, loading: 'lazy', decoding: 'async' } }),
  },
};

const renderMarkdown = (md) => sanitizeHtml(marked.parse(String(md || ''), { gfm: true, breaks: true }), ALLOWED);

module.exports = { renderMarkdown };
