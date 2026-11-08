## Notes from the research run (read first)

Written by the orchestrating agent, 8 November 2026. `scripts/merge.mjs` includes this file verbatim; edit it here, not in REVIEW.md.

**How it ran.** 23 units, 27 people. Each unit was researched by one subagent and verified by a different one. Verifiers opened every cited URL. Across the run they deleted one finding and rewrote many claims down to what the sources support, often lowering a proposed score in the process (Ambani legal 3→1, Zhang legal 2→1, Pignataro legal 3→1, Ma social 3→2, Slim social 3→2). The figures in the summary above come from the files.

**Everything is held.** Every merged profile proposes at least one value change, so under amendment 5 every one of them stays grey and none of its score text is applied. What the merge does apply is new sources, removal of generic sources, and counterweight texts, which are not score text. In practice nothing changes colour on the site until you decide the value changes in section 1. Once you have set the values you accept in the HTML, run `node scripts/extract.mjs` and then the merge again: every proposed dimension whose value now matches is applied with its text, and the profile can be checked. A proposal you reject stays listed here.

**Judgement calls for you.** These are the places where the rubric could be read two ways, or where the sourcing is thinner than the rest.

- **Bettencourt Meyers, legal 0→3.** Rests on a 2016 *mise en examen* for witness tampering that ended in a *non-lieu* in 2019. The rubric's level 3 covers a "personal indictment even if later dropped"; whether a *mise en examen* counts as an indictment is your call. Without it, the cartel fine on L'Oréal supports 2.
- **Li Ka-shing, legal 0→2.** Rests on Panama's Supreme Court annulling the ports concession as unconstitutional. The rubric's level 2 says "court finding"; this ruling is about the contract, not wrongdoing by the company. The reason says so.
- **Fontbona, legal 0→2.** The 2014 Supreme Court restoration order stands; the later demolition order was annulled. The verifier kept 2 on that distinction.
- **Ma Huateng and Robin Zeng, politics 1→3.** Both rest on official political roles (NPC, CPPCC) and the Pentagon's 1260H listing, which both companies dispute. Applied the same way to both.
- **Zhang Yiming, politics 2→3, and Son, politics 1→3.** Zhang's rests on company-level facts only. For Son, the researcher considered 2 defensible.
- **Buffett: subsidiaries as "his company".** Sources name BNSF, HomeServices and PacifiCorp, not Berkshire. They were counted as naming the subject (`names_subject: true`) because each claim names the subsidiary and says it is Berkshire's. If you prefer a stricter reading, those findings stop qualifying for `checked`.
- **Counterweights without disbursed amounts.** The brief asks for amounts disbursed. Three texts fall short and say so: Dieter Schwarz (professorships endowed, no euro amounts published), MSC (UNICEF says the foundation "raised" $17m; MSC's own share is not stated) and Mateschitz (Wings for Life UK committed £2.25m in grants in 2024, of which £2.13m was still payable at year-end; a Red Bull company covers its running costs; this is not personal giving). The Chanel foundation figure is also grant expenditure counted when payable, not cash paid. Drop them if you want the strict rule.
- **Republished copies.** Several Reuters, Bloomberg and AP stories are cited through syndicated copies (Yahoo, Insurance Journal, SRN News, MarketScreener and others) because the originals blocked fetching. Verifiers checked each copy carries the original byline. The OpenSecrets figures for Koch are cited through Raw Story.
- **Left out on purpose.** A 2025 DC Circuit ruling upholding dismissal of a cocoa child-labour suit against Mars (read, not included). The 2019 Black Money Act notices to Ambani family members (Ambani not named). Pledges that were never shown as paid (Ma, Zhong, Zeng).
- **Not researched.** Politics for the Mars and MSC groups (OpenSecrets was unreachable); ecology for Schwarz and Mateschitz. The current values stay.

**Phase 4 (refresh) was not run**, as amendment 3 says.
