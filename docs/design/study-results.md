# Fixed sample study walkthrough

Follow-up to the user-study navigation, requested by Russell.

1. Sign in. The dashboard opens with URL input selected and a fixed-sample study callout.
2. Read the fictional sample policy. All participants use this same policy.
3. Choose Submit study sample on the policy page or dashboard to open its prepared result.
4. Check the prepared-example notice, summary, takeaways, and source excerpts.
5. In Preferences, select Quick scan, Balanced, or Detailed and repeat the sample route.
6. Return to the dashboard or try URL and Paste Text using their Use study sample buttons.

Quick scan displays summary and takeaways; Balanced adds findings; Detailed opens
quoted evidence. Source excerpts remain available through a disclosure in every
level. The selected detail level travels in the URL, including the sample-policy
and return links. Other preference controls remain local preview controls and
are labeled accordingly.

Only the exact local sample URL or matching sample text (ignoring whitespace)
opens prepared results. Other inputs retain extraction/validation behavior.
The sample URL is handled locally without a network extraction request. Results
are explicitly prepared examples, make no live AI calls, and are not saved.

Validation: run npm run check, npm test, npm run lint, npm run build, and the
study-results Playwright test with a confirmed study test account. Check that
edited sample text and unrelated URLs never open the prepared result.
