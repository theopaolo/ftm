#!/usr/bin/env node
// Phase 3: merge verified research files into a copy of the dataset, then write
// REVIEW.md. Never edits the HTML. Changes a score value only where decisions.json
// records a decision on that value (amendment 9); without it, never.
// Plain Node, no dependencies.
//
// Usage: node scripts/merge.mjs [--research DIR] [--out FILE] [--review FILE] [--decisions FILE|none]
// If review-notes.md exists at the root, it is included in REVIEW.md after the summary.
// decisions.json (default) holds value decisions, counterweight decisions and the
// curated legal record; pass --decisions none to merge proposals only.
//
// Mapping onto window.FTM_DATA (decided 2026-11-08, see RESEARCH_BRIEF.md amendments):
// - Sources: added to the global dictionary with kind "case", keyed
//   <entity_group or slug>-<source id>; an URL already in the dataset reuses its key.
//   The person keeps forbes and existing case sources, gains the new keys, and loses
//   generic research-kind keys (which stay in the global dictionary).
// - Scores: a proposed dimension is applied (basis and reason) only when its value
//   equals the current value. Value changes are listed in REVIEW.md, not applied.
// - Counterweights: replaced when the proposal gives a non-empty text.
// - Baseline: data/research.baseline.json when present, else data/research.json.
// - checked: false -> true when a finding cites a source naming the subject and at
//   least one score is documented after the merge. Never true -> false automatically.

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, relative, resolve } from 'node:path';
import { ROOT, DIMS, RESEARCH_DIR, loadDataset, listResearchFiles, readJSON, totalOf, bandOf } from './lib.mjs';

function fail(message) {
  console.error(`merge: ${message}`);
  process.exit(1);
}

const args = { research: RESEARCH_DIR, out: join(ROOT, 'data', 'research.merged.json'), review: join(ROOT, 'REVIEW.md'), decisions: join(ROOT, 'decisions.json') };
for (let i = 2; i < process.argv.length; i += 2) {
  const flag = process.argv[i].replace(/^--/, '');
  if (!(flag in args) || process.argv[i + 1] === undefined) fail(`usage: merge.mjs [--research DIR] [--out FILE] [--review FILE] [--decisions FILE|none]`);
  args[flag] = flag === 'decisions' && process.argv[i + 1] === 'none' ? null : resolve(process.argv[i + 1]);
}
const D = args.decisions && existsSync(args.decisions) ? readJSON(args.decisions) : null;

const files = listResearchFiles(args.research);
if (!files.length) fail(`no research files in ${relative(ROOT, args.research) || '.'}`);

// Refuse to merge anything unless every file passes validation.
try {
  execFileSync(process.execPath, [join(ROOT, 'scripts', 'validate.mjs'), ...files], { stdio: 'pipe', encoding: 'utf8' });
} catch (error) {
  process.stderr.write(error.stdout ?? '');
  fail('validation failed; fix the research files before merging');
}

// The merge starts from the dataset as it was before any research was merged
// (data/research.baseline.json, snapshot of 8 November 2026), so it can be rerun after
// the HTML has been rebuilt from its output. Without a baseline it uses data/research.json.
const BASELINE = join(ROOT, 'data', 'research.baseline.json');
const original = existsSync(BASELINE) ? readJSON(BASELINE) : loadDataset();
const data = structuredClone(original);
const { bands } = data;
const people = new Map(data.people.map((p) => [p.id, p]));
const urlToKey = new Map(Object.entries(data.sources).map(([k, s]) => [s.url, k]));
const checkedBefore = data.people.filter((p) => p.checked).length;

const log = {
  merged: [], skipped: [], noSpecific: [], valueChanges: [], applied: [], counterweights: [],
  switches: [], stillUnchecked: [], uncheckProposals: [], removedGeneric: [], deleted: [], rewritten: [],
  decided: [], counterweightsDropped: [], legal: [],
};
if (D?.legal_status) data.legal_status = D.legal_status;
const decidedValue = new Map(); // `${id}:${dim}` -> value set by a decision

const records = files.map((file) => ({ file, rec: readJSON(file) })).sort((a, b) => a.rec.id - b.rec.id);

for (const { file, rec } of records) {
  const person = people.get(rec.id);
  const name = `${person.name} (#${person.rank})`;
  const v = rec.verification;
  const present = new Set(rec.findings.map((f) => f.id));

  // Audit trail from verification, whether or not the file is merged.
  for (const r of v?.results ?? []) {
    if (!present.has(r.finding_id)) log.deleted.push({ name, id: r.finding_id, verdict: r.verdict, comment: r.comment });
    else if (/^rewritten:/i.test(r.comment ?? '')) log.rewritten.push({ name, id: r.finding_id, comment: r.comment });
  }

  if (!v?.passed) {
    log.skipped.push({ file: relative(ROOT, file), reason: v ? 'verification did not pass' : 'not verified yet' });
    continue;
  }
  if (rec.outcome === 'no_specific_source_found') {
    log.noSpecific.push({ name, queries: rec.queries });
    continue;
  }

  // Sources.
  const prefix = rec.entity_group ?? rec.slug;
  const keyFor = new Map();
  for (const s of rec.sources) {
    let key = urlToKey.get(s.url);
    if (!key) {
      key = `${prefix}-${s.id}`;
      if (data.sources[key]) fail(`${relative(ROOT, file)}: key "${key}" already points to ${data.sources[key].url}`);
      data.sources[key] = { label: s.label, url: s.url, kind: 'case' };
      urlToKey.set(s.url, key);
    }
    keyFor.set(s.id, key);
  }
  const newKeys = new Set(keyFor.values());
  const generic = person.sources.filter((k) => data.sources[k]?.kind === 'research' && !newKeys.has(k));
  const kept = person.sources.filter((k) => k !== 'forbes' && !generic.includes(k));
  person.sources = [...new Set(['forbes', ...kept, ...newKeys])];
  if (generic.length) log.removedGeneric.push({ name, keys: generic });

  // Scores: apply only where the value is unchanged.
  const findingById = new Map(rec.findings.map((f) => [f.id, f]));
  const sourceById = new Map(rec.sources.map((s) => [s.id, s]));
  const proposedScores = rec.proposal?.scores ?? {};
  // Who the evidence behind a score is about: the person, the family, the company or a
  // foundation, from the level of each finding it cites. Documented scores only.
  const LEVEL_ORDER = ['individual', 'family', 'company', 'foundation'];
  const levelsOf = (ids) => {
    const set = new Set((ids ?? []).map((id) => findingById.get(id)?.level).filter(Boolean));
    return set.size ? { levels: LEVEL_ORDER.filter((l) => set.has(l)) } : {};
  };
  const sameValue = [];
  const changes = [];
  for (const dim of DIMS) {
    const prop = proposedScores[dim];
    if (!prop) continue;
    const cur = person.scores[dim];
    const entry = { dim, from: { ...cur }, to: prop, findings: prop.finding_ids.map((id) => findingById.get(id)) };
    if (prop.value !== cur.value) changes.push(entry);
    else if (prop.basis !== cur.basis || prop.reason !== cur.reason) sameValue.push(entry);
  }
  // Decisions (decisions.json): a decided dimension takes the decided value, with the
  // decision's basis, reason and findings where given, otherwise the proposal's.
  const dec = D?.people?.[rec.slug] ?? {};
  for (const dim of Object.keys(dec)) {
    if (!DIMS.includes(dim)) fail(`decisions.json: ${rec.slug} has unknown dimension "${dim}"`);
    const prop = proposedScores[dim];
    const d = dec[dim];
    if (!prop) fail(`decisions.json: ${rec.slug} ${dim} has no proposal to decide on`);
    if (d.accept !== (d.value === prop.value)) fail(`decisions.json: ${rec.slug} ${dim}: accept must be true exactly when value equals the proposed ${prop.value}`);
    const ids = d.finding_ids ?? prop.finding_ids;
    for (const id of ids) if (!findingById.has(id)) fail(`decisions.json: ${rec.slug} ${dim} cites unknown finding ${id}`);
    const basis = d.basis ?? prop.basis;
    if (basis === 'documented' && !ids.some((id) => findingById.get(id).source_ids.some((s) => sourceById.get(s)?.names_subject)))
      fail(`decisions.json: ${rec.slug} ${dim} is documented but no cited finding has a source naming the subject`);
    const cur = person.scores[dim];
    const to = { value: d.value, basis, reason: d.reason ?? prop.reason, ...levelsOf(ids) };
    log.decided.push({ name, slug: rec.slug, dim, from: { ...cur }, proposed: prop, to, accept: d.accept, why: d.why, ownText: Boolean(d.reason), findings: ids.map((id) => findingById.get(id)), sourceById, keyFor });
    person.scores[dim] = to;
    decidedValue.set(`${rec.id}:${dim}`, d.value);
  }
  const undecided = changes.filter((c) => !(c.dim in dec));
  const decidedDims = new Set(Object.keys(dec));
  for (let i = sameValue.length - 1; i >= 0; i--) if (decidedDims.has(sameValue[i].dim)) sameValue.splice(i, 1);

  // A grey profile with a pending value change is held entirely: applying only its
  // same-value text would turn it to a colour computed from values its own research
  // disputes. It stays grey until the value changes are decided.
  const held = !person.checked && undecided.length > 0;
  if (!held) {
    for (const a of sameValue) {
      log.applied.push({ name, dim: a.dim, from: a.from, to: a.to });
      person.scores[a.dim] = { value: a.from.value, basis: a.to.basis, reason: a.to.reason, ...levelsOf(a.to.finding_ids) };
    }
  }
  if (undecided.length) {
    const accepted = Object.fromEntries(DIMS.map((d) => [d, proposedScores[d] ?? person.scores[d]]));
    log.valueChanges.push({
      name, held, changes: undecided, heldText: held ? sameValue : [], sourceById, keyFor,
      rationale: rec.proposal.rationale,
      totalNow: totalOf(person.scores), totalIfAccepted: totalOf(accepted),
      bandIfAccepted: bandOf({ checked: true, scores: accepted }, bands),
    });
  }

  // Counterweights.
  const cw = rec.proposal?.counterweights?.trim();
  const cwDecision = D?.counterweights?.[rec.slug];
  if (cw && cwDecision?.keep === false) {
    log.counterweightsDropped.push({ name, text: cw, why: cwDecision.why, kept: person.counterweights });
  } else if (cw && cw !== person.counterweights) {
    log.counterweights.push({ name, from: person.counterweights, to: cw });
    person.counterweights = cw;
  }

  // Legal record: every legal matter in the findings, with its nature and outcome,
  // including matters dropped, dismissed, set aside or ruled in the subject's favour.
  const legal = D?.legal_record?.[rec.slug];
  if (legal) {
    person.legal_record = legal.map((e) => {
      const f = findingById.get(e.f);
      if (!f) fail(`decisions.json: legal_record for ${rec.slug} cites unknown finding ${e.f}`);
      if (!e.nature || !e.outcome) fail(`decisions.json: legal_record for ${rec.slug} ${e.f} needs nature and outcome`);
      if (!(e.status in (D.legal_status ?? {}))) fail(`decisions.json: legal_record for ${rec.slug} ${e.f} has unknown status "${e.status}"`);
      return { date: f.date, nature: e.nature, outcome: e.outcome, status: e.status, level: f.level, entity: f.entity, summary: f.claim, sources: f.source_ids.map((id) => keyFor.get(id)) };
    }).sort((a, b) => b.date.localeCompare(a.date));
    log.legal.push({ name, entries: person.legal_record });
  }

  // checked.
  const named = rec.findings.some((f) => f.source_ids.some((id) => sourceById.get(id)?.names_subject));
  const documented = DIMS.filter((d) => person.scores[d].basis === 'documented');
  if (!person.checked && !held && named && documented.length) {
    person.checked = true;
    log.switches.push({ name, band: bandOf(person, bands), total: totalOf(person.scores), documented });
  } else if (!person.checked) {
    const reason = held ? 'held, its proposal changes a value (section 1)'
      : !named ? 'no remaining finding cites a source that names the subject'
      : 'no documented score was proposed';
    log.stillUnchecked.push({ name, reason });
  } else if (!named) {
    log.uncheckProposals.push({ name });
  }
  log.merged.push(name);
}

// Guards: no score value changed, and every person's source key resolves.
for (const p of original.people) {
  const m = people.get(p.id);
  for (const d of DIMS) {
    const allowed = decidedValue.get(`${p.id}:${d}`) ?? p.scores[d].value;
    if (m.scores[d].value !== allowed) fail(`internal error: ${p.slug} ${d} value changed without a decision`);
  }
  for (const k of m.sources) if (!data.sources[k]) fail(`internal error: ${p.slug} cites unknown source "${k}"`);
}

mkdirSync(dirname(args.out), { recursive: true });
writeFileSync(args.out, JSON.stringify(data, null, 2) + '\n');
const checkedAfter = data.people.filter((p) => p.checked).length;
writeFileSync(args.review, review());

console.log(`merge: ${log.merged.length} of ${files.length} files merged -> ${relative(ROOT, args.out)}`);
console.log(`merge: checked ${checkedBefore} -> ${checkedAfter}; ${log.decided.filter((x) => x.from.value !== x.to.value).length} values changed by decision; ${log.valueChanges.length} people with undecided value changes; review -> ${relative(ROOT, args.review)}`);

/* ---------- REVIEW.md ---------- */

function review() {
  const L = [];
  const label = (d) => data.dimensions[d].label;
  const score = (s) => `${s.value} (${s.basis})`;
  const today = new Date().toISOString().slice(0, 10);
  const none = (list, text) => { if (!list.length) L.push(text, ''); return !list.length; };

  L.push('# Review: research merge', '');
  L.push(D
    ? `Generated by \`scripts/merge.mjs\` on ${today} from ${files.length} research files and \`decisions.json\`. The merge wrote \`data/research.merged.json\`. Score values changed only where a decision in \`decisions.json\` says so; section 1 lists every decision next to the proposal it answers.`
    : `Generated by \`scripts/merge.mjs\` on ${today} from ${files.length} research files. The merge wrote \`data/research.merged.json\` and did not touch the HTML. It never changes a score value, so the colour logic stays a human decision: every value change below waits for you.`, '');

  L.push('## Summary', '');
  L.push(`- Files merged: ${log.merged.length} of ${files.length}. Not merged: ${log.skipped.length}. No specific source found: ${log.noSpecific.length}.`);
  L.push(`- Profiles checked: ${checkedBefore} before, **${checkedAfter} after**, of ${data.people.length}.`);
  if (D) {
    const changed = log.decided.filter((x) => x.from.value !== x.to.value);
    L.push(`- Decisions: ${log.decided.length} on ${new Set(log.decided.map((x) => x.slug)).size} people; ${log.decided.filter((x) => x.accept).length} proposals accepted, ${log.decided.filter((x) => !x.accept).length} decided otherwise. Values changed: ${changed.length} (${changed.filter((x) => x.to.value > x.from.value).length} up, ${changed.filter((x) => x.to.value < x.from.value).length} down).`);
    L.push(`- Legal record entries: ${log.legal.reduce((n, l) => n + l.entries.length, 0)} on ${log.legal.filter((l) => l.entries.length).length} people.`);
  }
  L.push(`- People with undecided value changes (not applied): ${log.valueChanges.length}.`);
  L.push(`- Grey profiles that now show a colour: ${log.switches.length}.`);
  L.push(`- Findings deleted during verification: ${log.deleted.length}. Claims rewritten down: ${log.rewritten.length}.`, '');

  // Hand-written notes from the research run (judgement calls for the reviewer), kept
  // in review-notes.md so that regenerating this file does not lose them.
  const notesPath = join(ROOT, 'review-notes.md');
  if (existsSync(notesPath)) L.push(readFileSync(notesPath, 'utf8').trim(), '');

  if (D) {
    L.push('## Rules used for the decisions', '');
    for (const r of D.rules) L.push(`- ${r}`);
    L.push('', 'Rubric gaps to settle:', '');
    for (const r of D.rubric_gaps) L.push(`- ${r}`);
    L.push('');
    L.push('## 1. Decisions on proposed scores', '');
    L.push('Each row is one proposed dimension. "Decided" is what the merged data now holds. Rows where the decision differs from the proposal are in bold. A decision with its own text replaced the proposed reason; otherwise the proposed reason was applied.', '');
    const short = (s) => `${s.value} ${s.basis === 'documented' ? 'doc' : 'est'}`;
    L.push('| Person | Dimension | Current | Proposed | Decided | Why |', '|---|---|---|---|---|---|');
    for (const x of log.decided) {
      const b = x.accept ? (t) => t : (t) => `**${t}**`;
      L.push(`| ${x.name} | ${label(x.dim)} | ${short(x.from)} | ${short(x.proposed)} | ${b(short(x.to))} | ${x.why.replace(/\|/g, '/')} |`);
    }
    L.push('');
    const own = log.decided.filter((x) => x.ownText);
    if (own.length) {
      L.push('Reasons written for the decision (replacing the proposed text):', '');
      for (const x of own) L.push(`- ${x.name}, ${label(x.dim)} ${x.to.value}: ${x.to.reason}`);
      L.push('');
    }
    if (log.counterweightsDropped.length) {
      L.push('Counterweight texts not applied:', '');
      for (const c of log.counterweightsDropped) L.push(`- ${c.name}: ${c.why} Proposed text: "${c.text}"${c.kept ? ` Kept: "${c.kept}"` : ' Kept: none.'}`);
      L.push('');
    }
  }

  L.push(D ? '## 1b. Undecided proposed changes (not applied)' : '## 1. Proposed score changes (not applied)', '');
  L.push('The merge kept the current value, basis and reason for each of these dimensions. "If accepted" assumes the whole proposal for that person is accepted and the profile is checked.', '');
  L.push('A profile marked **held** was grey and stays grey: none of its score text was applied either, because a colour computed now would rest on values its own research disputes.', '');
  if (log.valueChanges.length) {
    const short = { ecology: 'eco', politics: 'pol', social: 'soc', legal: 'leg', unresolved: 'unr' };
    L.push('| Person | Proposed value changes | Total now → if accepted | Band if accepted |', '|---|---|---|---|');
    for (const v of log.valueChanges) {
      const changes = v.changes.map((c) => `${short[c.dim]} ${c.from.value}→${c.to.value}`).join(', ');
      L.push(`| ${v.name}${v.held ? ' (held)' : ''} | ${changes} | ${v.totalNow} → ${v.totalIfAccepted} | ${v.bandIfAccepted} |`);
    }
    L.push('');
  }
  const item = (v, c, note = '') => {
    L.push(`- **${label(c.dim)}: ${score(c.from)} → ${score(c.to)}**${note}`);
    L.push(`  - Current reason: ${c.from.reason}`);
    L.push(`  - Proposed reason: ${c.to.reason}`);
    for (const f of c.findings) {
      const cites = f.source_ids.map((id) => { const s = v.sourceById.get(id); return `[${s.label}](${s.url}) \`${v.keyFor.get(id)}\``; }).join('; ');
      L.push(`  - ${f.id} · ${f.direction} · ${f.level} · ${f.evidence_type.replace(/_/g, ' ')} · ${f.date}: ${f.claim} ${cites}`);
    }
  };
  if (!none(log.valueChanges, 'None.')) {
    for (const v of log.valueChanges) {
      L.push(`### ${v.name}${v.held ? ' (held)' : ''}`, '');
      L.push(`Total now ${v.totalNow} of 20; if accepted ${v.totalIfAccepted}, band **${v.bandIfAccepted}**.`, '');
      L.push(`Rationale: ${v.rationale}`, '');
      for (const c of v.changes) item(v, c);
      for (const c of v.heldText) item(v, c, ' (same value, held)');
      L.push('');
    }
  }

  L.push('## 2. Grey profiles that now show a colour', '');
  L.push('The merge set `checked` to true for these profiles because a finding cites a source naming the person or their company and at least one score is now documented. The page computes the colour from the current values, documented and estimated together.' + (D ? ' Values are as decided in section 1.' : ' No value was changed.'), '');
  if (!none(log.switches, 'None.')) {
    for (const s of log.switches) L.push(`- ${s.name}: **${s.band}**, total ${s.total} of 20. Documented: ${s.documented.map(label).join(', ')}.`);
    L.push('');
  }
  if (log.stillUnchecked.length) {
    L.push('Merged but still grey (sources added, `checked` left false):', '');
    for (const s of log.stillUnchecked) L.push(`- ${s.name}: ${s.reason}.`);
    L.push('');
  }
  if (log.uncheckProposals.length) {
    L.push('Already checked, but no remaining finding names the subject. The brief would set `checked` to false; the merge left it, because that would remove a colour:', '');
    for (const s of log.uncheckProposals) L.push(`- ${s.name}`);
    L.push('');
  }

  L.push('## 3. Text applied by the merge', '');
  L.push('Basis and reason replaced where the proposed value equals the current one. These texts are now in the merged data as written.', '');
  if (!none(log.applied, 'None.')) {
    for (const a of log.applied) L.push(`- ${a.name}, ${label(a.dim)} ${a.to.value}: ${a.from.basis} → ${a.to.basis}. ${a.to.reason}`);
    L.push('');
  }
  if (log.counterweights.length) {
    L.push('Counterweights replaced:', '');
    for (const c of log.counterweights) L.push(`- ${c.name}: ${c.to}${c.from ? ` (was: ${c.from})` : ''}`);
    L.push('');
  }

  L.push('## 4. No specific source found', '');
  if (!none(log.noSpecific, 'None.')) {
    for (const n of log.noSpecific) {
      L.push(`- ${n.name}: ${n.queries.length} queries.`, '', '  <details><summary>Queries run</summary>', '');
      for (const q of n.queries) L.push(`  - ${q}`);
      L.push('', '  </details>', '');
    }
  }

  if (log.legal.length) {
    L.push('## 4b. Legal record', '');
    L.push('Every legal matter found, including those dropped, dismissed, set aside or decided in the subject\'s favour. The merged data carries it as `legal_record` on each person. Newest first.', '');
    for (const l of log.legal) {
      if (!l.entries.length) { L.push(`- **${l.name}**: none found.`); continue; }
      L.push(`- **${l.name}**`);
      for (const e of l.entries) L.push(`  - ${e.date} · ${e.nature} · ${e.level}: ${e.outcome}.`);
    }
    L.push('');
  }

  L.push('## 5. Findings deleted during verification', '');
  if (!none(log.deleted, 'None.')) {
    for (const d of log.deleted) L.push(`- ${d.name}, ${d.id} (${d.verdict}): ${d.comment}`);
    L.push('');
  }
  if (log.rewritten.length) {
    L.push('Claims rewritten down to what the source supports:', '');
    for (const r of log.rewritten) L.push(`- ${r.name}, ${r.id}: ${r.comment}`);
    L.push('');
  }

  L.push('## 6. Generic sources removed from profiles', '');
  L.push('Removed from the person only. They stay in the global dictionary, where the site lists every research source.', '');
  if (!none(log.removedGeneric, 'None.')) {
    for (const g of log.removedGeneric) L.push(`- ${g.name}: ${g.keys.map((k) => `\`${k}\``).join(', ')}`);
    L.push('');
  }

  if (log.skipped.length) {
    L.push('## 7. Not merged', '');
    for (const s of log.skipped) L.push(`- \`${s.file}\`: ${s.reason}.`);
    L.push('');
  }

  L.push(`## ${log.skipped.length ? 8 : 7}. Checked count and the method section`, '');
  L.push(`Profiles with \`checked: true\` after the merge: **${checkedAfter} of ${data.people.length}** (was ${checkedBefore}).`, '');
  L.push(`The brief says the method section hardcodes "36 dossiers". The current build (\`follow-the-money-preview.html\`) no longer does: the hero figure "Profiles checked against sources" is filled from the data at load time (\`data-stat="checked"\`). Only its static fallback, \`<span data-stat="checked">${checkedBefore}</span>\`, which shows without JavaScript, must be changed to ${checkedAfter} when the HTML is rebuilt from the merged data.`, '');
  return L.join('\n');
}
