# ClearConsent dashboard navigation for user study

The dashboard at `/dashboard/overview` is the walkthrough screen and opens the URL input by default. Its URL and Paste Text cards switch between the existing forms. The root `/` shows the authentication entry from [PR #43](https://github.com/UNLV-CS472-672/2026-F-GROUP2-ClearConsent/pull/43). Successful login and returning sessions go to the dashboard.

## Current routes

```mermaid
flowchart TD
    Entry["Auth entry: /"] --> Login["Login or register"]
    Login -->|"Confirmed account"| Dashboard
    Dashboard["Dashboard: /dashboard/overview"] -->|"Opens by default"| URL["URL input: /dashboard/overview/extract"]
    Dashboard --> Text["Paste Text: /dashboard/overview/text"]
    Dashboard --> Preferences["Preferences: /preferences"]
    Dashboard --> History["History table: sample entries"]
    URL --> ExtractOutput["Extracted text or retrieval error"]
    Text --> TextOutput["Validated text, hash, and time"]
```

The dashboard requires a session. The input forms do not yet produce a complete analysis. The Preferences page offers temporary privacy-topic, detail-level, and answer-style controls. Detail and style change only an illustrative example on that page; no choices are saved or sent to analysis. History rows are sample data. The Stage 1 server analysis endpoint is not connected to the dashboard. Search is a disabled coming-soon card, and history View controls do not lead to working results.

Answer style and detail level are study concepts, not accepted requirements or implemented analysis settings. [FR-8](../requirements/detailed-functional-requirements.md#fr-8--plain-language-summary) requires plain language, source support, and preservation of conditions and uncertainty at every level. The current [Stage 2 contract](../stage-2-consolidation.md#preferences) uses privacy preferences only for relevance and ordering. Connecting presentation choices to real output needs a separate design decision and tests that the underlying findings and evidence stay intact.

## Auth handoff

[Dashboard PR #33](https://github.com/UNLV-CS472-672/2026-F-GROUP2-ClearConsent/pull/33) provides `/dashboard` and redirects it to `/dashboard/overview`. [Auth PR #43](https://github.com/UNLV-CS472-672/2026-F-GROUP2-ClearConsent/pull/43) provides login and registration from `/`. This branch sends successful login and returning sessions to `/dashboard/overview`; `/auth/callback` remains available while email confirmation establishes a session.

```mermaid
flowchart LR
    Site["clearconsent.site /"] --> Auth["Authentication entry: PR #43"]
    Auth --> Login["Login or register with a confirmed account"]
    Login --> Dashboard["Dashboard: /dashboard/overview"]
    Dashboard --> URL["Enter policy URL"]
    Dashboard --> Text["Paste policy text"]
```

The [detailed requirements](../requirements/detailed-functional-requirements.md) also allow unsigned-in visitors to submit a policy and see general analysis. The current auth hook gates every feature behind login. The team needs to settle the guest path before describing this diagram as the final product flow.

## Intended analysis journey

The [detailed requirements](../requirements/detailed-functional-requirements.md) and DP1 frontend flow describe submission, general results, optional personalization, and history. These steps remain a design target:

```mermaid
flowchart TD
    Visitor["Visitor"] --> Submit["Submit public URL or pasted policy text"]
    Submit --> General["Source-supported general analysis and questions"]
    General --> SignIn{"Signed in with saved preferences?"}
    SignIn -->|"No"| GeneralOnly["General results only"]
    SignIn -->|"Yes"| Personalized["Personalized indicators"]
    Personalized --> Saved["Save completed analysis to account history"]
```

DP1 feedback asked the team to distinguish signed-in and unsigned-in paths and describe saving consistently. [UI issue #18](https://github.com/UNLV-CS472-672/2026-F-GROUP2-ClearConsent/issues/18) sketches the page layout.

For the study walkthrough, prepare a confirmed test account and start each participant at `/`. After login, confirm that the URL form opens automatically, then try Paste Text and Preferences. Use the same example policy or policy text for each participant. Record observations of implemented screens separately from reactions to the intended journey. The complete signed-in route still needs a live smoke test on the deployed build before participants use it.
