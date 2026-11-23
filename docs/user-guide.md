# Field guide

## Assemble a small corpus

Choose 2–20 sources relevant to one question. For each source, provide its canonical URL, title, and the text you want to compare. Publication dates are optional. Include URLs that appear in the source's citations, because the citation graph uses those URLs as evidence.

Use **Add source** for a record, **Edit** for a correction, or **Import corpus** for a JSON file or pasted JSON. Imports replace the current corpus only after validation succeeds. Source removal is disabled at two records. Export your current corpus before replacing it if you want to retain your investigation.

## Read the graph

Solid arrows point from the citing source toward the cited source. They represent an exact normalized URL found in the supplied content. Dashed lines represent shared wording: either five-word containment above the configured threshold or a contiguous 12-word passage. A pair can have both kinds of relationship.

Select a graph node or corpus row to inspect it. Graph nodes also accept keyboard focus; Enter and Space select a node. The inspector lists related sources, the matching URL or shared phrase, per-source coverage of distinct normalized five-word phrases, and the source's literal text. A 12-word passage can trigger a relationship independently of the threshold. Coverage is a phrase-set ratio, not the share of raw words; titles are metadata and are not analyzed, so the tool does not label a match as headline or body text. Follow the source-domain link only when you intend to open that external website.

## Adjust wording families

The engine compares sets of normalized five-word phrases. The score is the number of shared phrases divided by the smaller phrase-set size. A separate 12-word contiguous match creates a relationship even when the shared passage is a small fraction of two long documents. Its evidence is normalized for case and punctuation.

The default containment threshold is 55%. Move the slider and release it to recalculate families. It does not suppress 12-word passage matches. **Collapse families** shows one node for each connected overlap group. Citation arrows between groups remain visible; internal links are hidden in that view. **Expand families** returns to individual records.

Group membership is transitive: A may overlap B, and B may overlap C, without A and C meeting the threshold directly. Inspect pair evidence before interpreting a family as one source.

## Treat dates as clues

The earliest dated record in a family is labeled a candidate. Missing dates and tied earliest dates are stated explicitly. The app does not verify the metadata, inspect revision histories, or know what was published outside your corpus. A supplied date never proves original authorship.

## Export and resume

**Export report** downloads the full source text, threshold, edges, wording families, date notes, and caveat. Import that report later to restore its sources. The UI uses the current slider threshold after import, so set the threshold to the recorded value if you need the same grouping. No source text persists automatically in the browser.

Use the CLI when you need repeatable analysis with an explicit threshold:

```sh
npm run analyze -- examples/corpus.json --threshold 0.55
```
