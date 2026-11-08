#!/usr/bin/env node
// Phase 1-2 work units: one per person, or one per shared company group.
// Plain Node, no dependencies.
//
//   node scripts/units.mjs                       list the units and their output files
//   node scripts/units.mjs status                where each unit stands (missing, researched, verified, passed)
//   node scripts/units.mjs prompt research <unit>   print the research subagent prompt for a unit
//   node scripts/units.mjs prompt verify <unit>     print the verification subagent prompt for a unit
//   Add --phase 4 first to work on the Phase 4 refresh units (prompts/refresh.md for research).

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, GROUPS, PHASE1_IDS, PHASE4_IDS, loadDataset, groupOf, readJSON } from './lib.mjs';

const argv = process.argv.slice(2);
const phaseAt = argv.indexOf('--phase');
const PHASE = phaseAt >= 0 ? argv.splice(phaseAt, 2)[1] : '1';
if (!['1', '4'].includes(PHASE)) { console.error('--phase must be 1 or 4'); process.exit(1); }
const SCOPE = PHASE === '4' ? PHASE4_IDS : PHASE1_IDS;

const data = loadDataset();
const byId = new Map(data.people.map((p) => [p.id, p]));
const today = new Date().toISOString().slice(0, 10);

function buildUnits() {
  const units = [];
  const seen = new Set();
  for (const id of SCOPE) {
    if (seen.has(id)) continue;
    const group = groupOf(id);
    const ids = group ? GROUPS[group].filter((m) => SCOPE.includes(m)) : [id];
    ids.forEach((m) => seen.add(m));
    const people = ids.map((m) => {
      const p = byId.get(m);
      if (!p) throw new Error(`id ${m} is not in data/research.json`);
      return p;
    });
    units.push({ key: group ?? people[0].slug, group, people, files: people.map((p) => `research/${p.slug}.json`) });
  }
  return units;
}

function stateOf(file) {
  const path = join(ROOT, file);
  if (!existsSync(path)) return 'missing';
  let rec;
  try { rec = readJSON(path); } catch { return 'invalid JSON'; }
  if (!rec.verification) return 'researched';
  return rec.verification.passed ? 'passed' : 'verified, not passed';
}

function render(kind, unit) {
  const file = PHASE === '4' && kind === 'research' ? 'refresh' : kind;
  const template = readFileSync(join(ROOT, 'prompts', `${file}.md`), 'utf8');
  const records = unit.people.map((p) => ({
    ...p,
    sources_resolved: Object.fromEntries(p.sources.map((k) => [k, data.sources[k]])),
  }));
  const names = unit.people.map((p) => p.name).join(', ');
  const groupNote = unit.group
    ? `This is the ${unit.group} group: ${names} share ${unit.people[0].company.replace(/\.$/, '')}. Write one file per member, with entity_group set to "${unit.group}". Company-level findings must be identical in every member file (same id, claim, sources and date); the validator checks this. An individual-level finding goes only in the file of the person its source names.\n\n`
    : '';
  const values = {
    root: ROOT,
    today,
    unit_label: unit.group ? `the ${unit.group} group (${names})` : `${names} (id ${unit.people[0].id})`,
    files: unit.files.join(' '),
    records: JSON.stringify(records, null, 2),
    group_note: groupNote,
  };
  const out = template.replace(/\{\{(\w+)\}\}/g, (m, key) => {
    if (!(key in values)) throw new Error(`prompts/${kind}.md uses unknown placeholder ${m}`);
    return values[key];
  });
  return out;
}

const units = buildUnits();
const [cmd, kind, key] = argv;

if (!cmd) {
  for (const u of units) console.log(`${u.key.padEnd(40)} ${u.people.map((p) => p.id).join(',').padEnd(12)} ${u.files.join(' ')}`);
  console.log(`\n${units.length} units, ${units.reduce((n, u) => n + u.people.length, 0)} people`);
} else if (cmd === 'status') {
  const tally = {};
  for (const u of units) {
    const states = u.files.map(stateOf);
    for (const s of states) tally[s] = (tally[s] ?? 0) + 1;
    console.log(`${u.key.padEnd(40)} ${states.join(', ')}`);
  }
  console.log('\n' + Object.entries(tally).map(([s, n]) => `${n} ${s}`).join(', '));
} else if (cmd === 'prompt' && ['research', 'verify'].includes(kind)) {
  const unit = units.find((u) => u.key === key);
  if (!unit) {
    console.error(`unknown unit "${key}". Units: ${units.map((u) => u.key).join(', ')}`);
    process.exit(1);
  }
  process.stdout.write(render(kind, unit));
} else {
  console.error('usage: units.mjs [status | prompt research <unit> | prompt verify <unit>]');
  process.exit(1);
}
