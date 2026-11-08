// Shared constants and helpers for the FTM scripts. Plain Node, no dependencies.

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const DATA_PATH = join(ROOT, 'data', 'research.json');
export const RESEARCH_DIR = join(ROOT, 'research');

// Shared company groups (RESEARCH_BRIEF.md, "Shared company groups").
export const GROUPS = {
  walmart: [11, 12, 14, 40],
  koch: [24, 25],
  mars: [38, 39],
  msc: [44, 45],
  chanel: [49, 50],
};

// Phase 1 scope, decided on 2026-11-08: the brief's 38 ids that were still
// unchecked in follow-the-money-preview.html on that date. The other 11
// (1, 7, 11, 12, 13, 14, 18, 28, 37, 40, 47) already had specific sources.
export const PHASE1_IDS = [6, 8, 9, 10, 16, 20, 21, 23, 24, 25, 26, 27, 29, 32, 33, 34, 35, 36, 38, 39, 42, 43, 44, 45, 46, 49, 50];

export const DIMS = ['ecology', 'politics', 'social', 'legal', 'unresolved'];

export const readJSON = (path) => JSON.parse(readFileSync(path, 'utf8'));

export function loadDataset() {
  if (!existsSync(DATA_PATH)) throw new Error('data/research.json not found; run node scripts/extract.mjs first');
  return readJSON(DATA_PATH);
}

export const listResearchFiles = (dir = RESEARCH_DIR) =>
  existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => join(dir, f)) : [];

export const groupOf = (id) => Object.keys(GROUPS).find((g) => GROUPS[g].includes(id)) ?? null;

// Same rule as the page script: a colour only for checked profiles, from the plain total.
export const totalOf = (scores) => DIMS.reduce((sum, d) => sum + scores[d].value, 0);
export const bandOf = (person, bands) => (person.checked ? bands.find((b) => totalOf(person.scores) <= b.max).key : 'unchecked');
