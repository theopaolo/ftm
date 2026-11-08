#!/usr/bin/env node
// Write a dataset into the standalone HTML: replaces the window.FTM_DATA literal and the
// static fallback of the checked count (shown without JavaScript). Plain Node, no dependencies.
//
// Usage: node scripts/build.mjs [--data FILE] [--html FILE]
//   defaults: data/research.merged.json into follow-the-money-preview.html
// After building, `node scripts/extract.mjs` reads the same data back.

import { readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { ROOT, DIMS, readJSON } from './lib.mjs';

const fail = (m) => { console.error(`build: ${m}`); process.exit(1); };
const args = { data: join(ROOT, 'data', 'research.merged.json'), html: join(ROOT, 'follow-the-money-preview.html') };
for (let i = 2; i < process.argv.length; i += 2) {
  const flag = process.argv[i].replace(/^--/, '');
  if (!(flag in args) || process.argv[i + 1] === undefined) fail('usage: build.mjs [--data FILE] [--html FILE]');
  args[flag] = resolve(process.argv[i + 1]);
}

const data = readJSON(args.data);
for (const p of data.people) {
  for (const d of DIMS) if (!Number.isInteger(p.scores[d]?.value)) fail(`${p.slug} has no ${d} value`);
  for (const k of p.sources) if (!data.sources[k]) fail(`${p.slug} cites unknown source "${k}"`);
  for (const e of p.legal_record ?? []) for (const k of e.sources) if (!data.sources[k]) fail(`${p.slug} legal record cites unknown source "${k}"`);
}

let html = readFileSync(args.html, 'utf8');
const marker = 'window.FTM_DATA = ';
const start = html.indexOf(marker);
if (start < 0 || html.indexOf(marker, start + 1) >= 0) fail('expected exactly one "window.FTM_DATA = " in the HTML');
const end = html.indexOf(';</script>', start);
if (end < 0) fail('no ";</script>" after the data assignment');
// "</" inside JSON strings would close the script element early; escape it.
const literal = JSON.stringify(data).replace(/<\//g, '<\\/');
html = html.slice(0, start + marker.length) + literal + html.slice(end);

const checked = data.people.filter((p) => p.checked).length;
const fallback = /(<span data-stat="checked">)\d+(<\/span>)/;
if (!fallback.test(html)) fail('no static <span data-stat="checked"> fallback found');
html = html.replace(fallback, `$1${checked}$2`);

writeFileSync(args.html, html);
console.log(`build: ${relative(ROOT, args.data)} -> ${relative(ROOT, args.html)}; ${data.people.length} people, ${checked} checked, ${Object.keys(data.sources).length} sources`);
