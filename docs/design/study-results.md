# Fixed sample study walkthrough

Follow-up to the user-study navigation, requested by Russell.

1. Sign in and open Preferences.
2. Select Quick scan, Balanced, or Detailed, then Continue with study sample.
3. Read the linked fictional sample policy. All participants use this same policy.
4. In URL or Paste Text, choose Use study sample, then submit.
5. Confirm the Study example results notice and matching summary and takeaways.
6. Use the result navigation to return to the dashboard or try the other input.

Quick scan displays summary and takeaways; Balanced adds findings; Detailed adds
quoted evidence. The selected detail level travels in the URL. Other preference
controls remain local preview controls and are labeled accordingly.

Only the exact local sample URL or matching sample text (ignoring whitespace)
opens prepared results. Other inputs retain extraction/validation behavior.
The sample URL is handled locally without a network extraction request. Results
are explicitly prepared examples, make no live AI calls, and are not saved.

Validation: run npm run check, npm test, npm run lint, npm run build, and the
study-results Playwright test with a confirmed study test account. Check that
edited sample text and unrelated URLs never open the prepared result.
