# FTM research brief: top 50 fortunes

This brief is for the orchestrating agent in Claude Code. Read it fully before launching any subagent.

## Amendments, 8 November 2026

Decided with Théo after Phase 0, because the dataset had changed since this brief was written. Where an amendment conflicts with the text below, the amendment wins.

1. **Input.** The site file is `follow-the-money-preview.html` and the dataset is `window.FTM_DATA`, not `power-index-standalone-2.html` and `window.RESEARCH`. `scripts/extract.mjs` accepts both.
2. **Data model.** People have no `status`, `reviewed`, `note`, `evidence` or `tags`. Each person has five scores (`ecology`, `politics`, `social`, `legal`, `unresolved`), each with a `value` from 0 to 4, a `basis` (`documented` or `estimate`) and a `reason`, plus `counterweights` and `checked`. The rubric for every level is in `dimensions`. The site's colour (lower concern, mixed, high concern) is computed from the sum of the five values and shown only when `checked` is true. The editorial status is therefore the score values: **never change a value**. `checked` plays the role of `reviewed`. Generic sources are those with `kind: "research"`; the keys `politics` and `carbon` do not exist.
3. **Scope.** Phase 1 covers the 27 of the 38 people below who were still unchecked: 6, 8, 9, 10, 16, 20, 21, 23, 24, 25, 26, 27, 29, 32, 33, 34, 35, 36, 38, 39, 42, 43, 44, 45, 46, 49, 50. That makes 23 units: koch, mars, msc and chanel as groups, everyone else alone. The other 11 (1, 7, 11, 12, 13, 14, 18, 28, 37, 40, 47) already have specific sources and stay as they are, so the walmart group is out of scope. Phase 4 waits until Théo has reviewed Phases 1 to 3.
4. **Proposal format.** `proposal` holds score proposals (`value`, `basis`, `reason`, `finding_ids`) for the dimensions the findings speak to, plus `counterweights` and `rationale`; see the schema. A documented score must rest on findings that cite a source naming the subject. Source labels follow the site: `Publisher: short title (year)`.
5. **Merge.** This replaces the Phase 3 bullets.
   - New sources go into the global dictionary with `kind: "case"`, keyed `<entity_group or slug>-<source id>`. A URL already in the dataset reuses its key, so a group's shared sources appear once on the site.
   - The person keeps `forbes` and their existing case sources, gains the new keys, and loses generic keys, which stay in the global dictionary.
   - A proposed score is applied (basis and reason) only where its value equals the current value. Value changes go to REVIEW.md and are never applied.
   - A grey profile (`checked: false`) with any pending value change is held: none of its score text is applied and it stays grey. Applying part of it would show a colour computed from values its own research disputes.
   - `checked` goes from false to true when the profile is not held, a remaining finding cites a source with `names_subject: true`, and at least one score is documented. The merge never sets it from true to false; REVIEW.md lists those cases instead.
   - `counterweights` is replaced when the proposal gives a non-empty text, which must rest on counterweight findings.
   - `scripts/merge.mjs` refuses to run unless `scripts/validate.mjs` passes, fails if any score value differs from the original, and writes both `data/research.merged.json` and `REVIEW.md`.
6. **Method section.** It no longer hardcodes "36 dossiers": the checked count is computed from the data. Only the static fallback in `<span data-stat="checked">` needs updating when the HTML is rebuilt. REVIEW.md says so.
7. **Network.** Phases 1 and 2 need open web access, because subagents must open every page they cite. Run them in a cloud environment with Full network access. The Default environment allows package registries only and blocks every source host.
8. **Orchestration.** `node scripts/units.mjs` lists the units, `node scripts/units.mjs status` shows progress, and `node scripts/units.mjs prompt research <unit>` or `prompt verify <unit>` prints the exact prompt for a subagent, from the templates in `prompts/`. Pass it verbatim. A unit's verifier must be a different subagent from its researcher, and can start as soon as the unit's research files validate.
9. **Decisions delegated (8 November 2026, after Phase 3).** Théo asked the orchestrator to decide the proposed value changes. Decisions are recorded in `decisions.json`, each with a rationale and a numbered rule, and are applied by `scripts/merge.mjs`. The merge starts from `data/research.baseline.json`, the pre-merge snapshot, and still fails on any value change that has no decision. `decisions.json` also holds the counterweight decisions and the curated legal record: every legal matter with its nature and outcome, including matters dropped or won. `scripts/build.mjs` writes the merged data into the HTML, which shows the legal record in each profile. To revise a decision, edit `decisions.json`, then run `merge` and `build`.

## Goal

Replace sector-level screens and generic sources in the top 50 of the FTM dataset with findings that are specific to each person or their company, sourced, dated and verified. The output is one JSON file per person in `research/`, valid against `schema/person.schema.json`, then a merge into the dataset.

The site's editorial labels (red, orange, green) stay a human decision. Agents propose, they never apply a status change.

## Inputs

- `power-index-standalone-2.html` at the root of this folder. The dataset is the `window.RESEARCH` object inside its `<script>` tag.
- `schema/person.schema.json`.

## Scope

38 people. The other 12 in the top 50 already have a specific source (see the optional refresh phase).

Sector screen only (27): 6, 7, 8, 10, 13, 16, 20, 21, 23, 26, 27, 28, 32, 33, 34, 36, 37, 38, 39, 42, 43, 44, 45, 46, 47, 49, 50.

Marked as reviewed but only linked to a generic report (11): 1, 9, 11, 12, 14, 18, 24, 25, 29, 35, 40.

Shared company groups. One subagent handles each whole group, so company-level findings are identical across its members:

- walmart: 11, 12, 14, 40
- koch: 24, 25
- mars: 38, 39
- msc: 44, 45
- chanel: 49, 50

Every other person gets their own subagent.

## Phases

### Phase 0: setup

Write `scripts/extract.mjs` (plain Node, no dependencies). It reads the HTML, extracts the `window.RESEARCH = {...};` assignment, parses it with `JSON.parse`, and writes `data/research.json`. Fail loudly if parsing fails. Also write `scripts/validate.mjs`, which validates every file in `research/` against the schema. A small hand-written validator is acceptable. If you add a dependency such as `ajv`, say why.

### Phase 1: research

Run subagents in parallel, about 6 at a time. Give each one: this brief, the schema, its person record(s) from `data/research.json`, and today's date. Each subagent writes `research/<slug>.json` and nothing else.

What to look for, in this order of source preference:

1. Court decisions, indictments, guilty pleas and settlements published by courts, prosecutors or regulators.
2. Regulator and government actions: penalties, sanctions, warning letters, official investigations.
3. Legislative reports and hearings.
4. Company filings and disclosures (annual reports, sustainability reports, foundation grant reports).
5. Investigative reporting from outlets with a public corrections policy.
6. NGO and academic reports, only when they name the person or the company.

Themes to cover when relevant to the sector: labour and supply chains, climate and environment, political spending and lobbying, tax arrangements, market power and antitrust, public money and procurement, inherited control. Also look for counterweights: philanthropy with amounts actually disbursed (not pledged), decarbonisation with verifiable results, labour agreements. Aim for 2 to 5 findings per person, in both directions when they exist.

### Phase 2: verification

A different subagent, one that did not do the research, checks each file. It opens every URL and checks that the source supports the claim as written, including the level (individual or company) and the evidence type. It fills the `verification` block.

- `unsupported`: delete the finding. Do not rewrite it to fit.
- `partial`: rewrite the claim down to what the source supports, then mark it `supported`.
- `unreachable`: keep it only if an archived copy confirms it, and replace the URL with the archive URL. Otherwise delete it.

Delete sources that no remaining finding cites. Set `passed: true` only when every remaining finding is supported.

### Phase 3: merge

Write `scripts/merge.mjs` (plain Node). For each `research/*.json` file with `verification.passed === true`:

- Add each source to the global `sources` dictionary under the key `<slug>-<source id>`, with `label` and `url`.
- Set the person's `sources` to the new keys plus `forbes`. Remove generic keys (`oxfam`, `politics`, `carbon`) from the person, but keep them in the global dictionary since the research cards use them.
- Set `reviewed` to true only if at least one remaining finding cites a source with `names_subject: true`. Otherwise false.
- Replace `note` and `evidence` with the proposal's values, and replace `tags` with the proposal's tags.
- Never change `status`.

Write the result to `data/research.merged.json`. Do not edit the HTML yet.

Then write `REVIEW.md`, a report for Théo containing:

- every proposed status change, with the rationale and the findings it relies on;
- every person with `no_specific_source_found`;
- every finding deleted during verification, with the reason;
- the new count of people where `reviewed` is true;
- a note that the methods section hardcodes "36 dossiers" and must be updated to match.

### Optional phase 4: refresh

For the 12 people who already have a specific source (2, 3, 4, 5, 15, 17, 19, 22, 30, 31, 41, 48), check whether the legal status has changed since the source date. Examples: a pending case that has been decided, an indictment that has been dropped or tried, a remedy that has been appealed. Use the same file format and the same verification phase.

## Rules for every subagent

- Only cite URLs you actually opened. Never build a URL from memory.
- Write claims in your own words. No quote longer than 15 words, at most one quote per source.
- A company's act stays a company's act. Write "Amazon was found to..." and never "Bezos was found to..." unless the source names the individual.
- Label allegations as allegations. An indictment or a pending case is not a finding of guilt.
- Do not describe intentions, character or motives unless a court or regulator stated them.
- Leave out private life (family, health, relationships). The only exception is when it is the public conduct under examination and is documented by a primary source or a major outlet.
- The `epstein` theme requires a primary document or a major outlet's report, and the claim must state exactly what is documented (contact, meeting, correspondence) and nothing more.
- Date every finding. If something is older than ten years, say so in the claim when it matters.
- If you find nothing specific, set `outcome` to `no_specific_source_found`, leave `findings` empty, and list the queries you ran. An empty result is a valid result. Do not fill the gap with sector generalities.
- Write in English, in the same register as the existing `note` fields: state what is established and what is not.
