#!/usr/bin/env node
// Extract the dataset embedded in the standalone HTML and write data/research.json.
// Plain Node, no dependencies.
//
// Usage: node scripts/extract.mjs [path/to/site.html]
//
// The brief names the file power-index-standalone-2.html and the variable
// window.RESEARCH. The current build is follow-the-money-preview.html with
// window.FTM_DATA. Both are accepted so the script works on either version.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CANDIDATES = ['follow-the-money-preview.html', 'power-index-standalone-2.html'];
const OUT = join(ROOT, 'data', 'research.json');

function fail(message) {
  console.error(`extract: ${message}`);
  process.exit(1);
}

const input = process.argv[2] ?? CANDIDATES.map((f) => join(ROOT, f)).find(existsSync);
if (!input || !existsSync(input)) fail(`no input HTML found (tried ${CANDIDATES.join(', ')})`);

const html = readFileSync(input, 'utf8');

// Find the assignment, then the end of its <script> element. The JSON itself is
// never scanned with a regex, so braces or semicolons inside strings are safe.
const assign = /window\.(FTM_DATA|RESEARCH)\s*=\s*/g;
const matches = [...html.matchAll(assign)].filter((m) => html[m.index + m[0].length] === '{');
if (matches.length === 0) fail(`no "window.FTM_DATA = {" or "window.RESEARCH = {" in ${input}`);
if (matches.length > 1) fail(`found ${matches.length} data assignments in ${input}; expected exactly one`);

const start = matches[0].index + matches[0][0].length;
const end = html.indexOf('</script>', start);
if (end === -1) fail('data assignment is not followed by </script>');

const literal = html.slice(start, end).trim().replace(/;$/, '');
let data;
try {
  data = JSON.parse(literal);
} catch (error) {
  fail(`window.${matches[0][1]} is not valid JSON: ${error.message}`);
}

// Integrity checks the merge relies on.
const problems = [];
for (const key of ['meta', 'sources', 'people']) if (!(key in data)) problems.push(`missing top-level "${key}"`);
const people = Array.isArray(data.people) ? data.people : [];
const ids = new Set();
const slugs = new Set();
for (const p of people) {
  if (ids.has(p.id)) problems.push(`duplicate id ${p.id}`);
  if (slugs.has(p.slug)) problems.push(`duplicate slug ${p.slug}`);
  ids.add(p.id);
  slugs.add(p.slug);
  for (const key of p.sources ?? []) {
    if (!data.sources?.[key]) problems.push(`${p.slug} cites unknown source "${key}"`);
  }
}
if (problems.length) fail(`dataset is inconsistent:\n  ${problems.join('\n  ')}`);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(data, null, 2) + '\n');
console.log(`extract: window.${matches[0][1]} from ${input.replace(ROOT + '/', '')}`);
console.log(`extract: ${people.length} people, ${Object.keys(data.sources).length} sources -> data/research.json`);
