#!/usr/bin/env node
// Validate research/*.json against schema/person.schema.json, then check the
// rules from RESEARCH_BRIEF.md that JSON Schema cannot express.
// Plain Node, no dependencies.
//
// Usage: node scripts/validate.mjs [research/a.json ...]
//
// Why not ajv: the schema uses about fifteen keywords. A small interpreter that
// reads the schema at runtime keeps the repo dependency-free, and it refuses any
// keyword it does not implement, so a schema change cannot be silently ignored.

import { readFileSync, existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import { ROOT, DATA_PATH, GROUPS, groupOf, listResearchFiles } from './lib.mjs';

const SCHEMA_PATH = join(ROOT, 'schema', 'person.schema.json');

/* ---------- Minimal JSON Schema interpreter ---------- */

const ANNOTATIONS = new Set(['$schema', '$id', 'title', 'description', '$defs']);
const SUPPORTED = new Set([
  'type', 'enum', 'required', 'properties', 'additionalProperties', 'items', 'minItems',
  'maxLength', 'pattern', 'minimum', 'maximum', 'format', '$ref',
]);

const isDate = (s) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};
const isUri = (s) => {
  try { new URL(s); return true; } catch { return false; }
};
const FORMATS = { date: isDate, uri: isUri };

const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v);
const typeMatches = (v, t) => t === typeOf(v) || (t === 'number' && typeof v === 'number');

function resolveRef(root, ref) {
  if (!ref.startsWith('#/')) throw new Error(`unsupported $ref ${ref}`);
  return ref.slice(2).split('/').reduce((node, key) => node?.[key], root);
}

function validateNode(root, schema, value, path, errors) {
  for (const key of Object.keys(schema)) {
    if (!SUPPORTED.has(key) && !ANNOTATIONS.has(key)) throw new Error(`schema keyword "${key}" at ${path} is not implemented by validate.mjs`);
  }
  if (schema.$ref) {
    const target = resolveRef(root, schema.$ref);
    if (!target) throw new Error(`unresolved $ref ${schema.$ref}`);
    validateNode(root, target, value, path, errors);
  }
  if (schema.type && !typeMatches(value, schema.type)) {
    errors.push(`${path}: expected ${schema.type}, got ${typeOf(value)}`);
    return;
  }
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path}: ${JSON.stringify(value)} is not one of ${schema.enum.join(', ')}`);
  if (typeof value === 'string') {
    if (schema.maxLength !== undefined && [...value].length > schema.maxLength) errors.push(`${path}: ${[...value].length} characters, max ${schema.maxLength}`);
    if (schema.pattern && !new RegExp(schema.pattern, 'u').test(value)) errors.push(`${path}: ${JSON.stringify(value)} does not match ${schema.pattern}`);
    if (schema.format) {
      const check = FORMATS[schema.format];
      if (!check) throw new Error(`format "${schema.format}" is not implemented by validate.mjs`);
      if (!check(value)) errors.push(`${path}: ${JSON.stringify(value)} is not a valid ${schema.format}`);
    }
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${path}: ${value} < ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${path}: ${value} > ${schema.maximum}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${path}: ${value.length} items, min ${schema.minItems}`);
    if (schema.items) value.forEach((item, i) => validateNode(root, schema.items, item, `${path}[${i}]`, errors));
  }
  if (typeOf(value) === 'object') {
    for (const key of schema.required ?? []) if (!(key in value)) errors.push(`${path}: missing required "${key}"`);
    const props = schema.properties ?? {};
    for (const [key, child] of Object.entries(value)) {
      if (props[key]) validateNode(root, props[key], child, `${path}.${key}`, errors);
      else if (schema.additionalProperties === false) errors.push(`${path}: unexpected property "${key}"`);
    }
  }
}

/* ---------- Rules from the brief ---------- */

const QUOTE = /["“«]([^"”»]+)["”»]/g;
const words = (s) => s.trim().split(/\s+/).filter(Boolean).length;

function briefRules(record, file, dataset, today) {
  const errors = [];
  const warnings = [];
  const sources = record.sources ?? [];
  const findings = record.findings ?? [];
  const byId = new Map(sources.map((s) => [s.id, s]));

  if (basename(file) !== `${record.slug}.json`) errors.push(`file name should be ${record.slug}.json`);

  const person = dataset?.people.find((p) => p.id === record.id);
  if (dataset && !person) errors.push(`id ${record.id} is not in data/research.json`);
  if (person && person.slug !== record.slug) errors.push(`slug "${record.slug}" does not match dataset slug "${person.slug}" for id ${record.id}`);
  if (person && person.name !== record.name) errors.push(`name "${record.name}" does not match dataset name "${person.name}"`);

  const dupes = (list) => list.filter((x, i) => list.indexOf(x) !== i);
  for (const id of dupes(sources.map((s) => s.id))) errors.push(`duplicate source id "${id}"`);
  for (const id of dupes(findings.map((f) => f.id))) errors.push(`duplicate finding id "${id}"`);
  for (const url of dupes(sources.map((s) => s.url))) warnings.push(`the same URL is listed twice: ${url}`);

  const cited = new Set();
  for (const f of findings) {
    for (const sid of f.source_ids ?? []) {
      if (!byId.has(sid)) errors.push(`${f.id} cites unknown source "${sid}"`);
      cited.add(sid);
    }
    const citedSources = (f.source_ids ?? []).map((sid) => byId.get(sid)).filter(Boolean);
    if (citedSources.length && !citedSources.some((s) => s.names_subject)) {
      warnings.push(`${f.id} cites no source that names the subject or their company`);
    }
    if (f.level === 'individual' && citedSources.length && !citedSources.some((s) => s.names_subject)) {
      errors.push(`${f.id} is an individual-level finding but no cited source names the subject`);
    }
    if (f.theme === 'epstein' && citedSources.length && !citedSources.some((s) => ['court', 'government', 'legislature', 'press'].includes(s.publisher_type))) {
      errors.push(`${f.id} uses the epstein theme without a primary document or press report`);
    }
    for (const m of (f.claim ?? '').matchAll(QUOTE)) {
      if (words(m[1]) > 15) errors.push(`${f.id} quotes ${words(m[1])} words; the limit is 15`);
    }
    if (f.date && f.date > today) errors.push(`${f.id} is dated in the future (${f.date})`);
  }
  for (const s of sources) {
    if (!cited.has(s.id)) errors.push(`source "${s.id}" is not cited by any finding`);
    if (s.accessed > today) errors.push(`source "${s.id}" accessed in the future (${s.accessed})`);
  }
  if (record.researched_at > today) errors.push(`researched_at is in the future (${record.researched_at})`);

  if (record.outcome === 'no_specific_source_found' && findings.length) errors.push('outcome is no_specific_source_found but findings is not empty');
  if (record.outcome === 'specific_sources_found' && !findings.length) errors.push('outcome is specific_sources_found but findings is empty');

  if (record.entity_group) {
    const members = GROUPS[record.entity_group];
    if (!members) errors.push(`unknown entity_group "${record.entity_group}"`);
    else if (!members.includes(record.id)) errors.push(`id ${record.id} is not a member of group "${record.entity_group}"`);
  } else {
    const group = groupOf(record.id);
    if (group) errors.push(`id ${record.id} belongs to group "${group}" but entity_group is not set`);
  }

  const v = record.verification;
  if (v) {
    const results = new Map();
    for (const r of v.results) {
      if (results.has(r.finding_id)) errors.push(`verification lists ${r.finding_id} twice`);
      results.set(r.finding_id, r);
    }
    const present = new Set(findings.map((f) => f.id));
    for (const f of findings) {
      const r = results.get(f.id);
      if (!r) errors.push(`verification has no result for ${f.id}`);
      else if (v.passed && r.verdict !== 'supported') errors.push(`passed is true but ${f.id} is "${r.verdict}"`);
      else if (r.verdict === 'unsupported') errors.push(`${f.id} is unsupported and must be deleted, not kept`);
    }
    for (const [id, r] of results) {
      // Results for findings that no longer exist are the audit trail of deletions.
      if (!present.has(id) && !['unsupported', 'unreachable'].includes(r.verdict)) {
        errors.push(`verification result for deleted finding ${id} has verdict "${r.verdict}"`);
      }
      if (!present.has(id) && !r.comment) errors.push(`deleted finding ${id} needs a comment giving the reason`);
    }
    if (v.checked_at > today) errors.push(`verification.checked_at is in the future (${v.checked_at})`);
    if (v.checked_at < record.researched_at) errors.push('verification.checked_at is before researched_at');
  }

  // Proposal: every documented score rests on remaining findings that name the subject.
  const p = record.proposal;
  if (p && record.outcome === 'no_specific_source_found') errors.push('no_specific_source_found must not carry a proposal');
  if (p) {
    const findingById = new Map(findings.map((f) => [f.id, f]));
    for (const [dim, score] of Object.entries(p.scores)) {
      for (const fid of score.finding_ids) if (!findingById.has(fid)) errors.push(`proposal.scores.${dim} cites unknown or deleted finding "${fid}"`);
      if (score.basis === 'documented') {
        if (!score.finding_ids.length) errors.push(`proposal.scores.${dim} is documented but cites no finding`);
        const named = score.finding_ids.some((fid) => (findingById.get(fid)?.source_ids ?? []).some((sid) => byId.get(sid)?.names_subject));
        if (score.finding_ids.length && !named) errors.push(`proposal.scores.${dim} is documented but none of its findings cites a source naming the subject`);
      } else if (score.finding_ids.length) {
        errors.push(`proposal.scores.${dim} is an estimate and must not cite findings`);
      }
      const current = person?.scores?.[dim];
      if (current && current.value !== score.value && !p.rationale.trim()) errors.push(`proposal.scores.${dim} changes the value but rationale is empty`);
    }
    if (p.counterweights.trim() && !findings.some((f) => f.direction === 'counterweight')) {
      errors.push('proposal.counterweights is set but there is no counterweight finding');
    }
  }

  return { errors, warnings };
}

// Company-level findings must be identical across a group (brief, "Shared company groups").
function groupRules(records) {
  const errors = [];
  const fingerprint = (rec) => {
    const url = new Map(rec.sources.map((s) => [s.id, s.url]));
    return rec.findings
      .filter((f) => f.level === 'company')
      .map((f) => JSON.stringify([f.direction, f.theme, f.entity, f.claim, f.evidence_type, f.date, f.source_ids.map((id) => url.get(id)).sort()]))
      .sort()
      .join('\n');
  };
  for (const [group, ids] of Object.entries(GROUPS)) {
    const members = records.filter((r) => r.data.entity_group === group);
    if (members.length < 2) continue;
    const [first, ...rest] = members;
    const ref = fingerprint(first.data);
    for (const other of rest) {
      if (fingerprint(other.data) !== ref) errors.push(`group "${group}": company-level findings in ${basename(other.file)} differ from ${basename(first.file)}`);
    }
    const missing = ids.filter((id) => !members.some((m) => m.data.id === id));
    if (missing.length && members.length) errors.push(`group "${group}": no file for id ${missing.join(', ')}`);
  }
  return errors;
}

/* ---------- Main ---------- */

function main() {
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
  const dataset = existsSync(DATA_PATH) ? JSON.parse(readFileSync(DATA_PATH, 'utf8')) : null;
  if (!dataset) console.warn('validate: data/research.json not found; run scripts/extract.mjs to check ids and names');
  const today = new Date().toISOString().slice(0, 10);

  const files = process.argv.length > 2 ? process.argv.slice(2) : listResearchFiles();
  if (!files.length) {
    console.log('validate: no files in research/');
    return 0;
  }

  let failed = 0;
  let warned = 0;
  const records = [];
  for (const file of files) {
    let data;
    try {
      data = JSON.parse(readFileSync(file, 'utf8'));
    } catch (error) {
      console.log(`FAIL ${basename(file)}\n  not valid JSON: ${error.message}`);
      failed++;
      continue;
    }
    const errors = [];
    validateNode(schema, schema, data, '$', errors);
    const brief = errors.length ? { errors: [], warnings: [] } : briefRules(data, file, dataset, today);
    errors.push(...brief.errors);
    records.push({ file, data, ok: !errors.length });
    const status = errors.length ? 'FAIL' : data.verification?.passed ? 'PASS' : 'ok  ';
    const detail = data.verification ? (data.verification.passed ? 'verified' : 'verification not passed') : 'not verified';
    console.log(`${status} ${basename(file)} (${data.findings?.length ?? 0} findings, ${detail})`);
    for (const e of errors) console.log(`  error: ${e}`);
    for (const w of brief.warnings) console.log(`  warning: ${w}`);
    if (errors.length) failed++;
    if (brief.warnings.length) warned++;
  }

  const groupErrors = groupRules(records.filter((r) => r.ok));
  for (const e of groupErrors) console.log(`FAIL ${e}`);

  console.log(`\nvalidate: ${files.length} files, ${failed} failed, ${warned} with warnings, ${groupErrors.length} group errors`);
  return failed || groupErrors.length ? 1 : 0;
}

process.exit(main());
