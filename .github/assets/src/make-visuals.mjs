#!/usr/bin/env node
// Draws the team diagram in the README, in light and dark versions.
// Usage: node .github/assets/src/make-visuals.mjs
// No dependencies. Text uses system fonts, because GitHub shows README SVGs
// as images, which can't load web fonts.

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ASSETS = join(dirname(fileURLToPath(import.meta.url)), '..');
const SANS = "ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI Variable Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const MONO = "ui-monospace, 'SF Mono', SFMono-Regular, 'Cascadia Mono', Consolas, Menlo, monospace";

// Neutrals follow GitHub's own palette so the diagram sits naturally on the page.
// Role colours passed a colour-blind-safety check on #ffffff and #0d1117.
const THEMES = {
  light: {
    surface: '#FFFFFF', border: '#D1D9E0', pill: '#F6F8FA', ink: '#1F2328', muted: '#59636E', faint: '#818B98', line: '#9AA4AF',
    you: '#1F2328', youIcon: '#FFFFFF', record: '#59636E', recordIcon: '#FFFFFF', tint: 0.95, edge: 0.74, bg: '#FFFFFF',
    role: { scout: '#0284C7', tester: '#7C3AED', verifier: '#059669', fixer: '#EA580C', lead: '#DB2777' },
  },
  dark: {
    surface: '#0D1117', border: '#3D444D', pill: '#151B23', ink: '#F0F6FC', muted: '#9198A1', faint: '#6E7681', line: '#5A626C',
    you: '#F0F6FC', youIcon: '#0D1117', record: '#9198A1', recordIcon: '#0D1117', tint: 0.93, edge: 0.7, bg: '#0D1117',
    role: { scout: '#0891D1', tester: '#8B5CF6', verifier: '#0A9E6E', fixer: '#EA580C', lead: '#E8489A' },
  },
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const r1 = (n) => Math.round(n * 10) / 10;

function mix(a, b, k) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, '0')).join('');
}

// Rough width of system-sans text, on the wide side so nothing collides.
function measure(str, size, weight = 400) {
  let w = 0;
  for (const ch of str) {
    if ("ilI.,:;|!'’".includes(ch) || ch === ' ') w += 0.28;
    else if ('fjrt()/'.includes(ch)) w += 0.37;
    else if ('mwMW'.includes(ch)) w += 0.86;
    else if (/[A-Z]/.test(ch)) w += 0.67;
    else w += 0.56;
  }
  return w * size * (weight >= 600 ? 1.05 : 1);
}

function text(x, y, str, { size = 13, weight = 400, fill, anchor = 'start', mono = false, ls = 0 } = {}) {
  return `<text x="${r1(x)}" y="${r1(y)}" font-family="${mono ? MONO : SANS}" font-size="${size}" font-weight="${weight}" fill="${fill}"`
    + `${anchor !== 'start' ? ` text-anchor="${anchor}"` : ''}${ls ? ` letter-spacing="${ls}"` : ''}>${esc(str)}</text>`;
}

const ICONS = {
  person: '<circle cx="12" cy="8.2" r="3.7"/><path d="M5 20c.9-3.6 3.7-5.6 7-5.6s6.1 2 7 5.6"/>',
  clipboard: '<rect x="5.5" y="4.5" width="13" height="16" rx="2.5"/><path d="M9.5 3h5v3h-5zM9 11h6M9 15h4"/>',
  folder: '<path d="M3.5 7.2a2 2 0 0 1 2-2h3.6l2 2.2h7.4a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
  compass: '<circle cx="12" cy="12" r="8.5"/><path d="M15.3 8.7l-2 4.6-4.6 2 2-4.6z"/>',
  pointer: '<path d="M6.5 4v13.6l3.6-3.3 2.5 5.6 2.4-1-2.5-5.6h5z"/>',
  verify: '<circle cx="10.8" cy="10.8" r="6.3"/><path d="M15.5 15.5l4.5 4.5M8.3 10.9l1.8 1.8 3.2-3.4"/>',
  wrench: '<path d="M14.6 4.1a4.8 4.8 0 0 0-5.5 6.4l-5 5a1.9 1.9 0 0 0 2.7 2.7l5-5a4.8 4.8 0 0 0 6.4-5.5l-2.8 2.8-2.5-.6-.6-2.5z"/>',
  lock: '<rect x="5.5" y="10.5" width="13" height="9.5" rx="2.2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
};

function ico(name, x, y, size, color, sw = 1.8) {
  return `<g transform="translate(${r1(x)} ${r1(y)}) scale(${r1((size / 24) * 1000) / 1000})" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</g>`;
}

// A thin line with a small open chevron at the end.
function arrow(x1, y, x2, color) {
  const d = x2 > x1 ? 1 : -1;
  return `<path d="M${x1} ${y}H${x2}" stroke="${color}" stroke-width="1.4" stroke-linecap="round"/>`
    + `<path d="M${x2 - 5 * d} ${y - 4}L${x2} ${y}L${x2 - 5 * d} ${y + 4}" fill="none" stroke="${color}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>`;
}

// A pill-shaped node with a round badge, a name and a short line.
function node(t, x, y, w, { badge, icon, iconColor, name, line, mono = false }) {
  return `<rect x="${x}" y="${y}" width="${w}" height="52" rx="26" fill="${t.pill}" stroke="${t.border}"/>`
    + `<circle cx="${x + 27}" cy="${y + 26}" r="15" fill="${badge}"/>`
    + ico(icon, x + 27 - 8.5, y + 26 - 8.5, 17, iconColor)
    + text(x + 52, y + 23, name, { size: mono ? 15.5 : 16, weight: 600, fill: t.ink, mono })
    + text(x + 52, y + 40.5, line, { size: 13.5, fill: t.muted });
}

function team(theme) {
  const t = THEMES[theme];
  const W = 960; const H = 368;
  let s = `<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="18" fill="${t.surface}" stroke="${t.border}"/>`;

  // Top row: you, the lead, and the record the lead keeps.
  s += node(t, 42, 50, 192, { badge: t.you, icon: 'person', iconColor: t.youIcon, name: 'You', line: 'Product owner' });
  s += node(t, 364, 50, 232, { badge: t.role.lead, icon: 'clipboard', iconColor: '#FFFFFF', name: 'Lead', line: 'Runs each pass' });
  s += node(t, 726, 50, 192, { badge: t.record, icon: 'folder', iconColor: t.recordIcon, name: 'qa/', line: 'Your QA record', mono: true });
  s += arrow(247, 69, 351, t.line) + text(299, 60, 'go', { size: 13, fill: t.muted, anchor: 'middle' });
  s += arrow(351, 83, 247, t.line) + text(299, 101, 'report', { size: 13, fill: t.muted, anchor: 'middle' });
  s += arrow(609, 76, 713, t.line) + text(661, 67, 'writes', { size: 13, fill: t.muted, anchor: 'middle' });

  // The lead briefs every role.
  const cw = 192; const cy = 156; const ch = 146; const xs = [42, 270, 498, 726];
  const c = xs.map((x) => x + cw / 2);
  s += `<path d="M480 102V132M${c[0]} ${cy - 1}V140Q${c[0]} 132 ${c[0] + 8} 132H${c[3] - 8}Q${c[3]} 132 ${c[3]} 140V${cy - 1}M${c[1]} 132V${cy - 1}M${c[2]} 132V${cy - 1}" fill="none" stroke="${t.line}" stroke-width="1.4" stroke-linecap="round"/>`;

  const roles = [
    { k: 'scout', name: 'Scout', icon: 'compass', d: ['Maps your app and', 'writes the checklist'], ro: true },
    { k: 'tester', name: 'Testers', icon: 'pointer', d: ['Use it like real', 'people, with evidence'], ro: true },
    { k: 'verifier', name: 'Verifier', icon: 'verify', d: ['Reproduces every bug,', 're-checks every fix'], ro: true },
    { k: 'fixer', name: 'Fixer', icon: 'wrench', d: ['One commit per bug,', 'failing test first'], ro: false },
  ];
  roles.forEach((r, i) => {
    const x = xs[i]; const col = t.role[r.k];
    s += `<rect x="${x}" y="${cy}" width="${cw}" height="${ch}" rx="16" fill="${mix(col, t.bg, t.tint)}" stroke="${mix(col, t.bg, t.edge)}"/>`;
    s += `<rect x="${x + 18}" y="${cy + 18}" width="34" height="34" rx="10" fill="url(#g-${r.k})"/>`;
    s += ico(r.icon, x + 26, cy + 26, 18, '#FFFFFF', 1.9);
    if (r.ro) s += ico('lock', x + cw - 32, cy + 20, 14, t.faint, 1.8);
    s += text(x + 18, cy + 80, r.name, { size: 16.5, weight: 600, fill: t.ink, ls: -0.1 });
    r.d.forEach((line, j) => { s += text(x + 18, cy + 104 + j * 20, line, { size: 14, fill: t.muted }); });
  });

  // Work flows left to right; every fix goes back to the verifier.
  const mid = cy + ch / 2;
  s += arrow(xs[0] + cw + 7, mid, xs[1] - 7, t.line);
  s += arrow(xs[1] + cw + 7, mid, xs[2] - 7, t.line);
  s += arrow(xs[2] + cw + 7, mid - 7, xs[3] - 7, t.line);
  s += arrow(xs[3] - 7, mid + 7, xs[2] + cw + 7, t.line);

  // Legend
  s += ico('lock', 42, 325, 15, t.faint, 1.8) + text(63, 337, 'Read-only: can’t change your code', { size: 13.5, fill: t.muted });
  s += text(918, 337, 'Every fix is re-checked by the verifier', { size: 13.5, fill: t.muted, anchor: 'end' });

  const grads = Object.entries(t.role).map(([k, v]) => `<linearGradient id="g-${k}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${mix(v, '#FFFFFF', 0.14)}"/><stop offset="1" stop-color="${v}"/></linearGradient>`).join('');
  const desc = 'You, the product owner, say go and get a report from the lead, who runs each pass and writes the qa/ record in your repo. '
    + 'The lead briefs four roles. The scout maps your app and writes the checklist. Three testers use it like real people, with evidence. '
    + 'The verifier reproduces every bug and re-checks every fix. The fixer makes one commit per bug, with a failing test first. '
    + 'Work flows from scout to testers to verifier to fixer, and every fix goes back to the verifier. The scout, testers and verifier are read-only.';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title desc">\n`
    + `<title id="title">How the enhance-qa team works</title>\n<desc id="desc">${esc(desc)}</desc>\n`
    + `<defs>${grads}</defs>\n${s}\n</svg>\n`;
}

for (const theme of ['light', 'dark']) writeFileSync(join(ASSETS, `team-${theme}.svg`), team(theme));
console.log('Wrote team-light.svg and team-dark.svg to', ASSETS);
