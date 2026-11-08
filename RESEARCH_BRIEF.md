# FTM research brief: top 50 fortunes

This brief is for the orchestrating agent in Claude Code. Read it fully before launching any subagent.

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
