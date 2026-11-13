# Security policy

The initial `0.1.x` series is maintained. No response or remediation service-level agreement is promised.

Use [GitHub private vulnerability reporting](https://github.com/ufodia/source-domino/security/advisories/new) when enabled. If it is unavailable, open a public issue requesting a private channel without exploit details or sensitive content. Include a small synthetic reproduction, affected version, environment, and impact after a private channel is available.

## Important boundaries

The browser must treat imported text as text and perform no automatic source fetching or data uploads. The optional collector must validate public HTTP(S) destinations and DNS results, pin the selected address, repeat validation for redirects, send no credentials, and enforce MIME/size/time limits.

Do not submit private source corpora, signed URLs, access tokens, customer documents, or internal hostnames in public issues. Keep Node, npm dependencies, and your browser current. The collector's conservative network checks are intended for explicit public source collection, not a general-purpose proxy or security certification.
