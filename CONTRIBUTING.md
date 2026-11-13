# Contributing

Useful contributions make a relationship easier to inspect or an uncertainty harder to miss.

Use Node.js 24 LTS. Run `npm ci`, `npm run dev`, and then `npm run typecheck`, `npm test`, and `npm run build` before opening a pull request. For CLI changes, run `npm run analyze -- examples/corpus.json` and check `--help` behavior.

Keep changes focused. Add a synthetic regression case for new normalization or scoring behavior. Preserve the distinction between declared citations, shared wording, and factual support. Do not introduce a truth score or claim that missing edges prove independence without a separately justified design.

Collector changes require tests for private/reserved network targets, URL credentials, redirects, limits, and failures. Never weaken address pinning or silently send source text to another service. Do not add website collection to tests that run in CI.

Issues should include expected/observed behavior, input shape, threshold, browser or Node version, and a minimal non-sensitive example. Use original synthetic text rather than private or copyrighted full articles. Security issues follow [SECURITY.md](SECURITY.md). Contributions are submitted under the MIT license.
