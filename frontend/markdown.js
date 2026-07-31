// Markdown rendering with extensions: GFM, KaTeX math, Mermaid, autolink
import { marked } from 'marked';
import markedKatex from 'marked-katex-extension';
import { mangle } from 'marked-mangle';
import { markedSmartypants } from 'marked-smartypants';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';
import { hljsLanguage } from './languages.js';

// Mermaid render queue (lazy init)
let mermaidReady = null;
function loadMermaid() {
  if (mermaidReady) return mermaidReady;
  mermaidReady = import('mermaid').then(mod => {
    const mermaid = mod.default;
    mermaid.initialize({
      startOnLoad: false,
      theme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'default',
      securityLevel: 'strict',
    });
    return mermaid;
  });
  return mermaidReady;
}

// Configure marked
const katexOptions = {
  throwOnError: false,
  output: 'html',
  strict: false,
  trust: false,
};

marked.use(markedKatex(katexOptions));
marked.use(mangle());
marked.use(markedSmartypants());
marked.use({
  gfm: true,
  breaks: true,
});

// Custom renderer for code blocks: highlight + mermaid
const renderer = new marked.Renderer();
renderer.code = function(token) {
  // marked v14 passes a token object { text, lang, escaped }
  const codeText = (token && (token.text || token.code)) || '';
  const language = (token && (token.lang || token.language)) || '';

  if (language === 'mermaid') {
    const id = 'm-' + Math.random().toString(36).slice(2, 9);
    return `<div class="mermaid-wrap"><div class="mermaid" data-mermaid-id="${id}">${escapeHtml(codeText)}</div></div>`;
  }

  // Try highlight.js
  let highlighted;
  try {
    const hl = hljsLanguage(language);
    if (hl && hljs.getLanguage(hl)) {
      highlighted = hljs.highlight(codeText, { language: hl }).value;
    } else {
      highlighted = hljs.highlightAuto(codeText).value;
    }
  } catch {
    highlighted = escapeHtml(codeText);
  }
  const langLabel = language ? `<span class="code-lang-label">${escapeHtml(language)}</span>` : '';
  return `<pre><code class="hljs language-${escapeHtml(language || 'plaintext')}">${highlighted}</code>${langLabel}</pre>`;
};
marked.setOptions({ renderer });

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// DOMPurify config: allow target/rel for links, classes for KaTeX
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'a','abbr','b','blockquote','br','code','del','div','em','h1','h2','h3','h4','h5','h6','hr','i','img','ins','kbd','li','ol','p','pre','q','s','samp','small','span','strong','sub','sup','table','tbody','td','tfoot','th','thead','tr','u','ul','input','svg','path','circle','rect','line','g','polyline','polygon','ellipse','defs','title','desc','use','clippath','text','tspan','marker','figure','figcaption','details','summary','ruby','rt','rp','var','wbr','math','mrow','mi','mo','mn','msup','msub','msubsup','mfrac','msqrt','mroot','mtable','mtr','mtd','mtext','mspace','mstyle','merror','mphantom','mfenced','menclose','semantics','annotation'
  ],
  ALLOWED_ATTR: [
    'href','src','alt','title','class','id','target','rel','colspan','rowspan','width','height','align','valign','style','data-mermaid-id','checked','disabled','type','start','reversed','value','xmlns','viewBox','d','fill','stroke','stroke-width','cx','cy','r','x','y','x1','y1','x2','y2','points','transform','opacity','xmlns:xlink','xlink:href','clip-path','clipPath','font-family','font-size','text-anchor','dy','dx','aria-label','aria-hidden','role','preserveAspectRatio','encoding','mathvariant'
  ],
  ALLOW_DATA_ATTR: true,
  FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form'],
  FORBID_ATTR: ['onerror','onload','onclick','onmouseover','onfocus','onblur'],
};

export async function renderMarkdown(text) {
  const raw = await marked.parse(text || '');
  const clean = DOMPurify.sanitize(raw, PURIFY_CONFIG);

  // Render mermaid diagrams (after DOM insertion — we return a wrapper and process later)
  // We can't render mermaid on a string; the caller will post-process
  return clean;
}

// Call after the rendered HTML is in the DOM
export async function renderMermaidInElement(container) {
  const els = container.querySelectorAll('.mermaid');
  if (!els.length) return;
  try {
    const mermaid = await loadMermaid();
    // Mermaid v10+ uses run({ nodes })
    const nodes = Array.from(els);
    // Each .mermaid contains raw text; we need to convert
    for (const el of nodes) {
      const code = el.textContent || '';
      const id = el.getAttribute('data-mermaid-id') || ('m-' + Math.random().toString(36).slice(2,9));
      try {
        const { svg } = await mermaid.render(id, code);
        el.innerHTML = svg;
      } catch (err) {
        el.innerHTML = `<div style="color:var(--danger);font-size:12px;">Mermaid 渲染失败: ${escapeHtml(err.message || String(err))}</div>`;
      }
    }
  } catch (err) {
    console.warn('Mermaid load failed', err);
  }
}

// Re-init mermaid on theme change
export function updateMermaidTheme(theme) {
  if (!mermaidReady) return;
  mermaidReady.then(m => {
    m.initialize({
      startOnLoad: false,
      theme: theme === 'dark' ? 'dark' : 'default',
      securityLevel: 'strict',
    });
  });
}
