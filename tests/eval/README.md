# Synthetic privacy-policy evaluation fixtures

`fixtures/privacy-policy-cases.json` contains fictional privacy-policy and EULA excerpts for comparing extraction behavior across models. No clause was copied from a real policy, and no customer or private data is included.

The expected findings are draft human-authored labels. A project member should review and approve them before they are treated as ground truth. They intentionally cover:

- data collection;
- operational sharing and an explicit no-sale statement;
- advertising sharing or sale and opt-out rights;
- retention periods and backup retention;
- deletion rights and legal exceptions;
- qualified security claims;
- children's data and parental controls;
- ambiguous partner language;
- missing retention information; and
- the difference between precise and approximate location.

For a fair spot check, give every model configuration the same `policyText` and ask it to return findings using the same schema and instructions. Compare its response against `expectedFindings`; do not include those expected findings in the model prompt.

No API runner is included yet. These fixtures do not make network requests and are not part of the default Vitest or Playwright suites.
