# Optional public URL collector

The browser never fetches source pages. The separate Node CLI provides an explicit collection step:

```sh
npm run collect -- --out collected-sources.json https://example.com https://example.org
npm run analyze -- collected-sources.json
```

Provide 2–20 explicit URLs. The collector downloads them sequentially and writes a corpus only if all requested sources complete and validate. Existing output files are not overwritten. If a request fails, no partial output file is written; already completed requests have still reached their websites.

## Request boundary

- HTTP and HTTPS only, without URL credentials and on standard ports.
- Local/internal hostnames and non-public IPv4/IPv6 ranges are blocked.
- Every hostname resolves to addresses that are all checked. A validated address is pinned to the request to avoid a second DNS lookup selecting another destination.
- Each redirect repeats URL and DNS validation. At most three redirects are accepted.
- DNS resolution and each request have a 12-second bound. Redirects can therefore take more than 12 seconds in total.
- Each response is limited to 2,000,000 bytes. HTML, XHTML, and plain text are accepted. Compressed HTTP responses are rejected even if the server ignores `Accept-Encoding: identity`.
- No cookies, authorization, browser session, referrer, or local files are sent. Only the explicit URL is requested. Query parameters are sent to the target website.
- Links are not crawled and page scripts are not executed.

Public-address filtering is intentionally conservative; some globally reachable special-purpose ranges are blocked. Keep the request boundary when changing this code. This small collector is not a general web security product.

## Extraction

HTML and XHTML responses use a bounded, simple HTML-to-text pass. Script/style/noscript/template blocks are removed, common entities decoded, and quoted anchor URLs retained as absolute citations. The HTML title becomes the source title. Plain-text responses retain literal angle brackets, entities, and markup-like examples; their title is the final hostname. Publication dates are left unknown. Content is truncated to the first 100,000 characters to satisfy the corpus contract.

The collector assumes UTF-8, does not render JavaScript, and does not reliably remove site navigation, footers, or boilerplate. HTML extraction is not browser-equivalent. Review and edit every collected source before interpreting its relationships. Use your own authorized plain-text excerpts for paywalled, authenticated, non-UTF-8, or JavaScript-only sources.

## Privacy and rights

Each target observes your network address, user agent, and requested URL. Only collect URLs you intentionally choose. Respect the site's access conditions and the rights attached to the content. Collecting text does not give you permission to republish it. Corpus files and reports are local; do not accidentally commit them.
