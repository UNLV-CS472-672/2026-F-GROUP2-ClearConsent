# URL ingestion boundary

The signed-in URL form sends a public HTTP(S) URL to `/api/extract`. The server validates the initial URL and each redirect before fetching the next destination. Fetch uses `redirect: 'manual'`, with at most five redirects. The current policy rejects IP literals, single-label/local-use names, embedded credentials, and custom ports. The response must be HTML or PDF; existing PDF support is an implementation extension beyond FR-5's webpage wording.

The extractor reads at most 1,000,000 response bytes, rejects URLs longer than the Stage 1 metadata limit (2,048 UTF-16 code units), and rejects extracted text beyond the current Stage 1 limit (60,000 UTF-16 code units). An empty or oversized result is not saved. The URL form keeps the user's input and shows a retryable error for retrieval, malformed-response, and save failures.

These checks are deterministic hostname and response checks. They do **not** prove that a public-looking DNS name resolves only to public addresses, or that an HTML login page contains a usable policy. Cloudflare Worker routing and a controlled live test need separate verification before claiming complete FR-5/FR-6 protection. The source table currently stores the final URL only; the original submitted URL is not retained separately after a redirect, so that FR-5 acceptance item remains incomplete.

Run the local unit cases with `npm run test:coverage`. `src/lib/server/extract/index.test.ts` mocks fetch and covers URL eligibility, redirects, content types, size limits, and failures. `src/extract-route.test.ts` covers auth and owned source-save behavior. `src/url-input.test.ts` covers visible error and navigation states. No test calls an external site or paid provider.

Cloudflare documents the manual redirect mode and warns that automatic redirects forward request headers to the new destination: [Workers Request API](https://developers.cloudflare.com/workers/runtime-apis/request/). It also recommends bounded reads because Worker memory is finite: [Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/).
