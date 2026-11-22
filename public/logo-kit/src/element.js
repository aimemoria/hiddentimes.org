// <ht-logo>: the HiddenTimes logo as an HTML element.
//
//   <script type="module" src="/logo-kit/src/element.js"></script>
//   <ht-logo></ht-logo>
//
// Attributes
//   variant  = full (default) | mark | wordmark
//   tagline  = "false" to hide "Discover the Unknown"
//   theme    = light (default) | dark | mono | auto (reads the background behind it) | system (follows OS dark mode)
//   animate  = any of: draw  reveal  hover  loop   (space separated, e.g. animate="draw hover")
//   label    = accessible name (default "HiddenTimes")
//
// Size it with CSS height:  ht-logo { height: 48px }
// Recolour it with CSS:     ht-logo { --ht-ink: #fff; --ht-accent: #F2A603; --ht-mark-bg: #fff; --ht-mark-fg: #000 }
// Animate your own way:     ht-logo::part(symbol) { ... }   parts: svg mark circle symbol wordmark letter tagline tagline-letter
//                           each letter has --i (its index) for staggered timing.
// Replay an animation:      document.querySelector('ht-logo').replay()

import { renderLogo, THEMES } from './render.js';

const STYLE = `
:host {
  display: inline-block;
  height: 48px;
  line-height: 0;
  vertical-align: middle;
  --ht-ease: cubic-bezier(.2, .7, .2, 1);
}
:host([hidden]) { display: none; }
:host { max-width: 100%; }
svg { height: 100%; width: auto; max-width: 100%; display: block; overflow: visible; }
.ht-mark, .ht-circle, .ht-symbol, .ht-letter, .ht-tagline-letter, .ht-wordmark, .ht-tagline {
  transform-box: fill-box;
  transform-origin: center;
}

/* draw: badge pops in, symbol draws itself, letters rise one by one, tagline fades in */
:host([animate~="draw"]) .ht-wait .ht-mark,
:host([animate~="draw"]) .ht-wait .ht-letter,
:host([animate~="draw"]) .ht-wait .ht-tagline-letter,
:host([animate~="reveal"]) .ht-wait .ht-mark,
:host([animate~="reveal"]) .ht-wait .ht-wordmark,
:host([animate~="reveal"]) .ht-wait .ht-tagline { opacity: 0; }

:host([animate~="draw"]) .ht-play .ht-circle { animation: ht-pop .7s var(--ht-ease) both; }
:host([animate~="draw"]) .ht-play .ht-symbol { stroke-dasharray: 1 1; animation: ht-draw 1.1s .3s var(--ht-ease) both; }
:host([animate~="draw"]) .ht-play .ht-letter { animation: ht-rise .6s calc(.35s + var(--i) * 45ms) var(--ht-ease) both; }
:host([animate~="draw"]) .ht-play .ht-tagline-letter { animation: ht-fade .5s calc(.95s + var(--i) * 28ms) ease both; }

/* reveal: badge rolls in, wordmark and tagline wipe in from the left */
:host([animate~="reveal"]) .ht-play .ht-mark { animation: ht-roll .9s var(--ht-ease) both; }
:host([animate~="reveal"]) .ht-play .ht-wordmark { animation: ht-wipe .9s .25s var(--ht-ease) both; }
:host([animate~="reveal"]) .ht-play .ht-tagline { animation: ht-wipe .8s .6s var(--ht-ease) both; }

/* hover: symbol redraws and the tagline nudges when the pointer is over the logo */
:host([animate~="hover"]:hover) .ht-symbol { stroke-dasharray: 1 1; animation: ht-draw .9s var(--ht-ease) both; }
:host([animate~="hover"]:hover) .ht-tagline-letter { animation: ht-nudge .5s calc(var(--i) * 18ms) var(--ht-ease) both; }

/* loop: symbol keeps drawing. Use it as a loading indicator */
:host([animate~="loop"]) .ht-symbol { stroke-dasharray: 1 1; animation: ht-loop 2.2s var(--ht-ease) infinite; }

@keyframes ht-pop   { from { transform: scale(.6); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes ht-draw  { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
@keyframes ht-rise  { from { transform: translateY(28%); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes ht-fade  { from { opacity: 0; transform: translateX(-12%); } to { opacity: 1; transform: none; } }
@keyframes ht-roll  { from { transform: rotate(-120deg) scale(.7); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes ht-wipe  { from { clip-path: inset(0 100% 0 0); opacity: 1; } to { clip-path: inset(0 0 0 0); opacity: 1; } }
@keyframes ht-nudge { 40% { transform: translateY(-14%); } }
@keyframes ht-loop  { 0% { stroke-dashoffset: 1; } 55% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: -1; } }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; opacity: 1 !important; }
}
`;

const dark = matchMedia('(prefers-color-scheme: dark)');

// Is the colour behind this element dark?
function backgroundIsDark(el) {
  let node = el.parentElement || el.getRootNode().host;
  while (node && node !== document.documentElement.parentNode) {
    const bg = getComputedStyle(node).backgroundColor;
    const m = bg && bg.match(/rgba?\(([^)]+)\)/);
    if (m) {
      const [r, g, b, a = 1] = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
      if (a > 0.1) return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.5;
    }
    node = node.parentElement || (node.getRootNode && node.getRootNode().host) || null;
  }
  return dark.matches && getComputedStyle(document.documentElement).colorScheme.includes('dark');
}

export class HTLogo extends HTMLElement {
  static get observedAttributes() { return ['variant', 'tagline', 'theme', 'animate', 'label']; }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._onScheme = () => this._render();
  }

  connectedCallback() {
    this._render();
    dark.addEventListener('change', this._onScheme);
    // themes that depend on the page re-check when the page switches theme (class / data-theme on <html> or <body>)
    this._mo = new MutationObserver(() => { if (this._dynamicTheme()) this._render(); });
    for (const n of [document.documentElement, document.body]) {
      if (n) this._mo.observe(n, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });
    }
  }

  disconnectedCallback() {
    dark.removeEventListener('change', this._onScheme);
    if (this._mo) this._mo.disconnect();
    if (this._io) this._io.disconnect();
  }

  attributeChangedCallback() { if (this.isConnected) this._render(); }

  /** Play the entrance animation again. */
  replay() {
    const svg = this.shadowRoot.querySelector('svg');
    if (!svg) return;
    svg.classList.remove('ht-play');
    svg.classList.add('ht-wait');
    void svg.getBoundingClientRect(); // restart CSS animations
    svg.classList.remove('ht-wait');
    svg.classList.add('ht-play');
  }

  /** Re-read the background (for theme="auto"). Call this after you change the page colours yourself. */
  refresh() { this._render(); }

  _dynamicTheme() { const t = this.getAttribute('theme'); return t === 'auto' || t === 'system'; }

  _theme() {
    const t = this.getAttribute('theme') || 'light';
    if (t === 'auto') return backgroundIsDark(this) ? 'dark' : 'light';
    if (t === 'system') return dark.matches ? 'dark' : 'light';
    return ['light', 'dark', 'mono'].includes(t) ? t : 'light';
  }

  _render() {
    const theme = this._theme();
    const mono = theme === 'mono';

    // Rebuild the SVG only when its shape changes; colour changes just swap CSS variables,
    // so switching light/dark never interrupts or replays an animation.
    const key = [this.getAttribute('variant'), this.getAttribute('tagline'), this.getAttribute('label'), mono].join('|');
    if (key !== this._key) {
      const firstPaint = !this._key;
      this._key = key;
      this.shadowRoot.innerHTML = `<style>${STYLE}</style><style class="ht-vars"></style>` + renderLogo({
        variant: this.getAttribute('variant') || 'full',
        tagline: this.getAttribute('tagline') !== 'false',
        theme: mono ? 'mono' : { ink: 'var(--_ink)', accent: 'var(--_accent)', markBg: 'var(--_mark-bg)', markFg: 'var(--_mark-fg)' },
        css: true,
        title: this.getAttribute('label') ?? 'HiddenTimes',
      });
      if (firstPaint) this._queueEntrance();
    }

    const c = THEMES[theme];
    this.shadowRoot.querySelector('.ht-vars').textContent = mono ? '' :
      `:host { --_ink: ${c.ink}; --_accent: ${c.accent}; --_mark-bg: ${c.markBg}; --_mark-fg: ${c.markFg}; }
       .ht-circle, .ht-symbol, .ht-wordmark, .ht-tagline { transition: fill .3s, stroke .3s; }`;
  }

  _queueEntrance() {
    const svg = this.shadowRoot.querySelector('svg');
    svg.classList.add('ht-wait');
    // start the entrance animation when the logo scrolls into view
    if ('IntersectionObserver' in window) {
      this._io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) { this._io.disconnect(); this.replay(); }
      });
      this._io.observe(this);
    } else this.replay();
  }
}

if (!customElements.get('ht-logo')) customElements.define('ht-logo', HTLogo);
