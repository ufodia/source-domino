# Changelog

## Reliability fixes — 2026-11-13

- Preserve literal plain-text responses in the public URL collector.
- Keep balanced parentheses in citation URLs and trim long delimiter suffixes in linear time.
- Compute source shingles once per analysis instead of reparsing every pair.
- Cancel superseded corpus imports, including when the dialog closes with Escape.
- Add focused collector, URL, and browser race regressions.

## 0.1.0 — 2026-11-13

Initial version: validated 2–20-source corpus, exact citation URL relationships, five-word containment evidence, wording families, date uncertainty, selectable graph and inspector, corpus editing/import, report export, local analysis CLI, bounded explicit public URL collector, synthetic corpus/report, regression tests, and project guides.
