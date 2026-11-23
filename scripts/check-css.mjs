#!/usr/bin/env node
// Design-system checks ESLint can't see, run by `npm run lint`.
//   node scripts/check-css.mjs [file.module.css …]   (default: every src/**/*.module.css)
// 1. An animation in a CSS module must name a @keyframes defined in that same
//    module: CSS Modules scopes animation names, so a keyframe from
//    src/shared/styles/keyframes.css resolves to nothing and the animation
//    silently never runs (947cb9d: the ticker marquee, the live dots, the radar).
// 2. No raw hex colour in a CSS module: colours come from
//    src/shared/styles/tokens.css (design/DESIGN-SYSTEM.md).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const KEYWORDS = new Set([
  'none', 'infinite', 'linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out', 'step-start', 'step-end',
  'normal', 'reverse', 'alternate', 'alternate-reverse', 'forwards', 'backwards', 'both',
  'running', 'paused', 'initial', 'inherit', 'unset', 'revert', 'auto',
]);

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (f.endsWith('.module.css')) out.push(p);
  }
  return out;
}

const files = process.argv.slice(2).length ? process.argv.slice(2) : walk('src');
const errors = [];
for (const file of files) {
  const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const defined = new Set([...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]));
  const line = (i) => css.slice(0, i).split('\n').length;
  for (const m of css.matchAll(/animation(-name)?\s*:\s*([^;}]+)/g)) {
    for (const part of m[2].split(',')) {
      const tokens = part.replace(/\([^)]*\)/g, '').trim().split(/\s+/);
      for (const t of tokens) {
        if (!/^[a-zA-Z_][\w-]*$/.test(t) || KEYWORDS.has(t) || t.startsWith('var')) continue;
        if (!defined.has(t))
          errors.push(`${relative('.', file)}:${line(m.index)}  animation "${t}" has no @keyframes ${t} in this module. CSS Modules scopes animation names, so a keyframe defined elsewhere (src/shared/styles/keyframes.css) resolves to nothing. Define @keyframes ${t} in this file.`);
      }
    }
  }
  for (const m of css.matchAll(/#[0-9a-fA-F]{3,8}\b/g))
    errors.push(`${relative('.', file)}:${line(m.index)}  raw colour ${m[0]}. Use a token from src/shared/styles/tokens.css (var(--…)); add one there if none fits.`);
}
for (const e of errors) console.error(e);
if (errors.length) {
  console.error(`\n✖ check-css: ${errors.length} problem${errors.length > 1 ? 's' : ''}`);
  process.exit(1);
}
