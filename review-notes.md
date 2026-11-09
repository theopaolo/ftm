## Notes from the research runs (read first)

Written by the orchestrating agent, 8–9 November 2026. `scripts/merge.mjs` includes this file verbatim; edit it here, not in REVIEW.md.

**What was done.** All 50 of the top 50 have now been researched, verified and decided, in two runs:

- **Phases 1–3:** the 27 profiles that were still grey, as 23 units.
- **Phase 4:** a refresh of the 23 top-50 profiles that were checked before, as 20 units (amendment 10). It refreshed their legal status, researched every dimension still on a default, and recorded each legal matter as its own finding.

Each unit was researched by one subagent and verified by a different one. Verifiers opened every cited URL, deleted one finding, and rewrote many claims down to what the sources support. That often lowered a proposed score. On 8 November Théo delegated the decisions on proposed values (amendment 9). They are in `decisions.json`, each citing a numbered rule, and section 1 sets each one against the proposal it answers. To revise one, edit `decisions.json`, then run `node scripts/merge.mjs` and `node scripts/build.mjs`. To go back to proposals only, run the merge with `--decisions none`.

**Where the decision differs from the proposal.** All in the Phase 1–3 profiles; every Phase 4 proposal was accepted.

- **Ellison:** legal 2, not 1. A $122m personal settlement is not "modest". Unresolved 3, not 2: he is a named defendant in a pending suit.
- **Ortega:** legal 2, not 1. A court upheld the slave-labour fines.
- **Pignataro:** legal 2, not 1. A personal tax settlement, following the Simons precedent.
- **Son:** politics 2, not 3 (commercial ties at company level). Legal 1, not 2: the WeWork settlement was paid in share purchases.
- **Li Ka-shing:** legal 1, not 2. The Panama ruling concerned the contract, not wrongdoing.
- **Zhang Yiming:** politics stays 2, not 3, because nothing personal is documented.
- **Slim:** unresolved 2 stays, but rests on findings now instead of an estimate.

**What the result shows, and what it does not.** Every one of the top 50 is now checked: 30 high concern, 20 mixed, none lower concern. Two profiles that were lower concern on thinner research, Ballmer (4 → 10) and Devasini (4 → 12), are now high.

This is partly what the research found and partly a property of the instrument. Research only adds points, because counterweights never lower a score. And a dimension left at a default 0 counts as 0 until someone looks. Totals are therefore comparable within the top 50, where every dimension has now been looked at, but not with ranks 51–100, where most dimensions are still sector estimates.

**Weakest points**, where a reader is most likely to object.

- **Larrea, social 4.** This is the rubric read literally: deaths documented in operations he controls (Pasta de Conchos, 65 miners). No one has been held legally responsible, and the reason says so.
- **Personal legal 3 for old or minor personal matters.**
  - Gates: a $800,000 FTC penalty in 2004.
  - Bettencourt Meyers: a *mise en examen*, dismissed in 2019.
  - Devasini: a plea bargain reported in 1995, with no court record found. It was scored 3 and not 4, because an Italian *patteggiamento* is not an admission of guilt.
  - Each follows a rule (R2) and a precedent, and each reason states the date and outcome.
- **Unresolved 3 for being named in a pending civil suit** (R6). This applies to Ellison, Huang, Zuckerberg, Arnault, Ballmer, Bloomberg, Zhao and Devasini. It is common for executives, and the rubric does not separate it from graver personal matters.
- **Paywalled pages.** Five citations (three Bloomberg Law, two MLex) rest only on the summary text these pages show without a subscription. The orchestrator checked on 9 November that each cited fact is in that free text. Zuckerberg's unresolved 3 rests on one of them: the denial of his motion to dismiss in the D.C. suit.
- **Republished copies.** Several Reuters, Bloomberg and AP stories are cited through syndicated copies, because the originals blocked fetching. Verifiers checked that each copy carries the original byline. OpenSecrets was unreachable throughout, so political totals rest on Election Law Blog, CNN or Newsweek, citing OpenSecrets data.
- **Buffett: subsidiaries as "his company".** Each claim names the subsidiary and says it is Berkshire's.
- **Epstein files.** Gates, Brin and Page: each claim states only what the cited document or major outlet shows, with the person's denial or non-response.

**Legal record.** 49 of the top 50 now list their legal matters, 263 in all, each with its nature, outcome category and outcome, including matters dropped, dismissed, set aside, pardoned or won. Robin Zeng has none. The entries were drafted by a subagent from the verified findings and reviewed by the orchestrator. A few items were removed as not being proceedings against the person: a subpoena in someone else's suit, and senators' letters and partisan reports.

**Left out on purpose.**

- A 2025 DC Circuit ruling upholding dismissal of a cocoa child-labour suit against Mars.
- The 2019 Black Money Act notices to Ambani family members.
- Pledges never shown as paid.

**Counterweight texts not re-sourced.** Musk's "On the other side" text (electric cars, launch costs) predates this research and has no source behind it. The researcher found no sourced replacement: the foundation's giving went mostly to his own entities. Decide whether to keep it or clear it.

**Not researched.** Politics for the Mars and MSC groups, and ecology for Schwarz, Mateschitz, Adani and Frist. Their current values stand. Ranks 51–100 have not been through any of this.

**Next steps worth considering.**

- Settle the three rubric gaps listed below.
- Decide whether verified counterweights should ever lower a score.
- Extend the same process to ranks 51–100.
