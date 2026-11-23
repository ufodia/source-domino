# Corpus and report contracts

## Corpus input

Provide a JSON array of sources or an object with a `sources` array. The browser text limit is 2.5 MB. Supply 2–20 sources, each with:

| Field | Contract |
| --- | --- |
| `id` | Optional. 1–60 ASCII letters, digits, `_`, or `-`. Invalid/missing IDs become `source-N`; duplicate IDs are rejected. |
| `url` | Required HTTP(S) URL, at most 4,096 characters, with no credentials. Normalized URLs must be unique. |
| `title` | Required, 1–500 characters after trimming. |
| `content` | Required, 1–100,000 characters after trimming. Treated as literal text. |
| `publishedAt` | Optional real calendar date in `YYYY-MM-DD` format. No independent verification is performed. |

URL normalization removes fragments and known tracking parameters (`utm_*`, `fbclid`, `gclid`), sorts remaining query parameters, normalizes the host, and removes the root slash only when no query remains. Path trailing slashes and other query parameters remain significant. It does not establish that two different URLs serve identical content.

## Report output

`schemaVersion: 1` contains validated `sources`, numeric `threshold`, `edges`, `groups`, and a `caveat`. A citation edge has `from`, `to`, `kind: citation`, `score: 1`, and the matching normalized URL as evidence. Its score indicates an exact URL match, not confidence in a claim.

An overlap edge has `kind: overlap`, a five-word containment score from 0 to 1 rounded to four decimals, normalized evidence, and `phraseCoverage: { shared, fromTotal, toTotal }`. These counts are the number of shared distinct normalized five-word phrases and the total distinct phrases in each source's supplied `content`; the UI derives per-source percentages from them. `basis` is `passage` for a contiguous shared 12-word passage, or `containment` for a threshold-qualified shared five-word phrase. A passage edge may have a score below the configured threshold. `from` and `to` are unordered for overlap edges. `score` uses the smaller phrase set as its denominator; `phraseCoverage` exposes both denominators. Neither percentage is raw word coverage or a probability. Source titles are metadata and are not analyzed.

Groups contain member IDs, an optional `earliestCandidate`, and a date explanation. Ties or no dates produce a null candidate. Missing dates prevent any claim that the known earliest record is actually the origin.

## TypeScript API

```ts
import { analyzeSources, demoSources } from './src/core';

const report = analyzeSources(demoSources, 0.55);
console.log(report.groups.length);
```

`analyzeSources(input, threshold)` validates the corpus. Threshold must be finite and between 0.1 and 1. `parseSources(json)` validates JSON text and applies the text-size limit. `overlap(left, right)` returns a score and a shared phrase. `extractUrls(text)` returns unique normalized HTTP(S) URLs found in literal text. Use these utilities with the same caveats as the UI.
