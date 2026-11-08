## Notes from the research run (read first)

Written by the orchestrating agent, 8 November 2026. `scripts/merge.mjs` includes this file verbatim; edit it here, not in REVIEW.md.

**How it ran.** 23 units, 27 people. Each unit was researched by one subagent and verified by a different one. Verifiers opened every cited URL. They deleted one finding and rewrote many claims down to what the sources support, often lowering a proposed score in the process (Ambani legal 3→1, Zhang legal 2→1, Pignataro legal 3→1, Ma social 3→2, Slim social 3→2).

**Decided, not held.** On 8 November Théo asked the orchestrator to decide the proposed changes (amendment 9 in RESEARCH_BRIEF.md). The decisions are in `decisions.json`. Each one cites a numbered rule, listed below, and section 1 sets it against the proposal. 59 proposals were accepted and 8 decided otherwise. The 27 profiles are now checked: 10 high concern, 17 mixed. To revise a decision, edit `decisions.json` and rerun `node scripts/merge.mjs` then `node scripts/build.mjs`. To go back to proposals only, run the merge with `--decisions none`.

**Where the decision differs from the proposal.**

- **Ellison:** legal 2, not 1. A $122m personal settlement is not "modest". Unresolved 3, not 2: he is a named defendant in a pending suit.
- **Ortega:** legal 2, not 1. A court upheld the slave-labour fines, which makes it a court finding.
- **Pignataro:** legal 2, not 1. A personal tax settlement, following the Simons precedent.
- **Son:** politics 2, not 3, because the ties are commercial and company-level. Legal 1, not 2: the WeWork settlement was paid in share purchases.
- **Li Ka-shing:** legal 1, not 2. The Panama ruling concerned the contract, not wrongdoing.
- **Zhang Yiming:** politics stays 2, not 3, because nothing personal is documented.
- **Slim:** unresolved 2 stays, but rests on findings now instead of an estimate.

**Weakest points**, where a reader is most likely to object.

- **Bettencourt Meyers, legal 3**, for a *mise en examen* dismissed in 2019. This follows the rubric's "even if later dropped" and the Adani precedent, and the reason states the dismissal.
- **Huang and Ellison, unresolved 3.** Being named in a pending securities suit is common for CEOs, and the rubric does not distinguish it from graver personal matters.
- **Buffett: subsidiaries as "his company".** Sources name BNSF, HomeServices and PacifiCorp, not Berkshire. Each claim says the subsidiary is Berkshire's.
- **Republished copies.** Several Reuters, Bloomberg and AP stories are cited through syndicated copies (Yahoo, Insurance Journal, SRN News, MarketScreener and others), because the originals blocked fetching. Verifiers checked that each copy carries the original byline. The OpenSecrets figures for Koch are cited through Raw Story.

**Legal record.** Each researched profile now lists its legal matters with their nature and outcome, including those dropped, dismissed, set aside or won (section 4b). The page shows the list under the scores. Robin Zeng has none. The 73 profiles outside Phase 1 have no list yet.

**Left out on purpose.**

- A 2025 DC Circuit ruling upholding dismissal of a cocoa child-labour suit against Mars. It was read but not included.
- The 2019 Black Money Act notices to Ambani family members: Ambani was not named.
- Pledges never shown as paid (Ma, Zhong, Zeng).

**Not researched.** Politics for the Mars and MSC groups (OpenSecrets was unreachable), and ecology for Schwarz and Mateschitz. Their current values stand.

**Phase 4 (refresh) was not run.** It is the natural next step, together with the rubric gaps below.
