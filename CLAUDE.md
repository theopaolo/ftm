# FTM (Follow the Money)

An interactive research site on the world's 100 largest fortunes (Forbes, March 2026 snapshot). The site is one standalone HTML file, `follow-the-money-preview.html`. The dataset is `window.FTM_DATA` inside it; `node scripts/extract.mjs` writes it to `data/research.json`.

- For the research task on the top 50, follow `RESEARCH_BRIEF.md`, starting with its Amendments section.
- Research output format: `schema/person.schema.json`. Check files with `node scripts/validate.mjs`.
- Use plain Node scripts with no dependencies by default. Justify any dependency you add.
- Never change a person's editorial status (red, orange, green). In this build the colour is computed from the five score values, so never change a score `value`. Propose changes in `REVIEW.md` instead.
