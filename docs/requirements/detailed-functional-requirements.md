# ClearConsent DP1: Detailed Functional Requirements Specification

## Purpose and scope

This document specifies the observable behavior and acceptance criteria for the committed
ClearConsent minimum viable product (MVP). ClearConsent helps users interpret privacy policies
and terms of service submitted as pasted text or publicly accessible webpage URLs. It identifies
privacy practices, produces source-supported summaries, evaluates practices against saved privacy
preferences, answers document-specific questions, and retains completed analyses for authenticated
users.

These are required product behaviors, not a declaration that the current application implements
them. ClearConsent provides informational privacy interpretation, not legal advice, compliance
certification, or legal conclusions. Automated interpretation can be incomplete or incorrect;
source excerpts help users inspect the basis for findings. Coverage of every privacy practice or
jurisdiction is not promised.

### Traceability and reading conventions

The stable IDs FR-1 through FR-12 correspond to Section 3.5 of DP1. Each requirement has one
normative subsection below; the index, cross-references, and final matrix reference those same
requirements without creating additional IDs. Numeric performance and availability targets belong
in DP1 Section 3.6, the non-functional requirements.

Submission, general analysis, and document-specific questions do not require an account under these
requirements. Saving preferences, personalized evaluation, and account history require an
authenticated user. An unsigned-in user receives no personalized risk rating or account-history
guarantee. For an authenticated user without saved preferences, the system requests preference
configuration and identifies personalized evaluation as unavailable until preferences are saved.

A completed analysis contains validated source text, categorized findings (or an explicit
no-findings outcome), and a source-supported summary. When saved preferences are available,
personalized evaluation must also succeed before the analysis is considered complete. A valid
finding of insufficient evidence is an analysis outcome; a processing error is not. Saving is a
separate operation: a completed result must not be described as saved until persistence succeeds.
History preserves the result and preference context used at analysis time; updating preferences
does not silently rewrite earlier results.

### Requirement index

| ID    | Requirement                                                               |
| ----- | ------------------------------------------------------------------------- |
| FR-1  | [Account Authentication](#fr-1--account-authentication)                   |
| FR-2  | [Privacy Preferences](#fr-2--privacy-preferences)                         |
| FR-3  | [URL Submission](#fr-3--url-submission)                                   |
| FR-4  | [Text Submission](#fr-4--text-submission)                                 |
| FR-5  | [Content Retrieval](#fr-5--content-retrieval)                             |
| FR-6  | [Content Validation](#fr-6--content-validation)                           |
| FR-7  | [Privacy-Practice Identification](#fr-7--privacy-practice-identification) |
| FR-8  | [Plain-Language Summary](#fr-8--plain-language-summary)                   |
| FR-9  | [Personalized Risk Evaluation](#fr-9--personalized-risk-evaluation)       |
| FR-10 | [Results Presentation](#fr-10--results-presentation)                      |
| FR-11 | [Document-Specific Questions](#fr-11--document-specific-questions)        |
| FR-12 | [Analysis History](#fr-12--analysis-history)                              |

## FR-1 — Account Authentication

### Requirement statement

The system shall allow users to create an account, sign in, sign out, and recover account access.

### Purpose

Establish account identity for personal preferences and private analysis history.

### Intended user

A visitor creating or recovering an account, or an account holder signing in or out.

### Preconditions

The user can access the account interface. Sign-in requires an existing account; successful
recovery requires proof of control through the supported recovery method.

### Expected workflow

1. The user selects account creation, sign-in, or recovery and supplies the required information.
2. The system validates the request and completes the applicable identity checks.
3. Successful account creation is confirmed; successful sign-in establishes an authenticated session.
4. Recovery verifies account control before allowing access to be restored.
5. The authenticated user selects sign-out, ending the session's account access.

### Acceptance criteria

- [ ] Valid account-creation information creates an account that can subsequently sign in.
- [ ] Missing or invalid required information prevents account creation and identifies the correction needed.
- [ ] A repeated registration for an existing account does not create a duplicate account.
- [ ] Valid sign-in information grants access to that user's preferences and history; invalid information grants no access.
- [ ] Valid recovery proof allows the account holder to restore sign-in access; invalid or expired proof does not.
- [ ] Sign-out invalidates the session's access to protected operations, including requests made from an already-open page.
- [ ] Unauthenticated requests for account data prompt sign-in or return an access error without returning protected data.

### Exceptions and failure behavior

Authentication or recovery service failures and timeouts display an actionable failure message and
allow retry without claiming success. Sign-in and recovery errors do not reveal whether another
person's account exists. An expired session requires renewed authentication for protected actions.
Failed identity checks never fall back to authenticated access.

## FR-2 — Privacy Preferences

### Requirement statement

The system shall allow authenticated users to configure and update personal privacy preferences used during policy evaluation.

### Purpose

Capture the user's privacy choices as the basis for personalized risk indicators in FR-9.

### Intended user

An authenticated user configuring or changing their own privacy preferences.

### Preconditions

The user is authenticated through FR-1 and can access the preference interface.

### Expected workflow

1. The system displays available preference categories and any previously saved choices.
2. The user selects or changes choices and submits them for saving.
3. The system validates the choices, saves them to the user's account, and confirms success.
4. Subsequent personalized evaluations use the saved choices.

### Acceptance criteria

- [ ] Each offered preference explains the privacy practice it concerns and the meaning of its choices.
- [ ] Saving valid choices and reopening preferences displays those same choices for the same user.
- [ ] Updating choices replaces the user's previously saved choices only after the save succeeds.
- [ ] An evaluation started after a confirmed preference update uses the updated saved choices.
- [ ] Unsaved edits are not treated as saved preferences by FR-9.
- [ ] Missing required choices or invalid values produce a correction message and do not overwrite saved preferences.
- [ ] A user cannot read or change another account's preferences by altering an account identifier or request.

### Exceptions and failure behavior

A failed save or timeout is reported as unconfirmed, and the interface does not claim the update
was saved. The user can reload to verify persisted choices before retrying. Expired or unauthorized
sessions cannot update preferences. If saved preferences cannot be loaded, personalized evaluation
reports that dependency as unavailable instead of substituting assumed preferences.

## FR-3 — URL Submission

### Requirement statement

The system shall allow users to submit the URL of a publicly accessible privacy policy or terms-of-service webpage.

### Purpose

Provide a webpage-based entry point into policy ingestion.

### Intended user

Any user with a public policy webpage URL.

### Preconditions

The submission interface is available and the user has selected URL input.

### Expected workflow

1. The user enters a URL and requests analysis.
2. The system checks the input through FR-6.
3. A valid public webpage URL is passed to FR-5 for retrieval.
4. The interface displays the submission's processing state or an actionable error.

### Acceptance criteria

- [ ] The interface provides a URL field and an explicit action to submit it.
- [ ] A valid public HTTP or HTTPS webpage URL proceeds to retrieval.
- [ ] Leading or trailing whitespace does not prevent an otherwise valid URL from being accepted.
- [ ] Blank, malformed, or unsupported-scheme input is rejected with a correction message before retrieval.
- [ ] The submitted URL remains associated with the analysis as its source reference.
- [ ] URL submission does not require uploading a file or providing credentials for the source website.

### Exceptions and failure behavior

Input acceptance does not imply that retrieval or analysis succeeded. An inaccessible or unsupported
destination produces the relevant FR-5 or FR-6 error. A failed submission or timeout leaves the user
able to correct the URL or retry without showing a completed result.

## FR-4 — Text Submission

### Requirement statement

The system shall allow users to paste policy text directly for analysis.

### Purpose

Allow analysis of user-supplied policy text without webpage retrieval.

### Intended user

Any user with privacy policy or terms-of-service text to analyze.

### Preconditions

The submission interface is available and the user has selected text input.

### Expected workflow

1. The user pastes policy text into the text input area.
2. The user requests analysis.
3. The system validates the text through FR-6 and passes accepted text to FR-7 and FR-8.

### Acceptance criteria

- [ ] The interface accepts multiline pasted text and provides an explicit submission action.
- [ ] Accepted text proceeds to analysis without requiring a URL or a file upload.
- [ ] Empty or whitespace-only text is rejected with an understandable correction message.
- [ ] The submitted wording remains available as the source for excerpts; normalization does not change its meaning.
- [ ] Text beyond a supported processing limit is explicitly rejected rather than silently truncated and described as fully analyzed.
- [ ] Results identify the source as pasted text and do not invent a source URL.

### Exceptions and failure behavior

Unsupported or unusable text is handled through FR-6. Submission failures and timeouts report that
analysis did not complete and allow correction or retry. The interface preserves the current input
for correction while the submission page remains open.

## FR-5 — Content Retrieval

### Requirement statement

The system shall retrieve policy content from a submitted public URL and extract the relevant readable text.

### Purpose

Convert a supported webpage into source text suitable for policy analysis.

### Intended user

A user submitting a policy webpage through FR-3.

### Preconditions

FR-6 has accepted the URL format and public-destination eligibility for retrieval.

### Expected workflow

1. The system requests the submitted webpage and checks any redirect destination for eligibility.
2. The system extracts the readable policy body from the retrieved page.
3. The extracted text is checked through FR-6.
4. Accepted text and its source reference proceed to analysis.

### Acceptance criteria

- [ ] A supported public policy page yields its readable policy body for analysis.
- [ ] Navigation, scripts, and unrelated page controls are excluded from policy text where they are distinguishable from the body.
- [ ] Excerpts can be traced to the extracted source; extraction does not substitute generated text for retrieved wording.
- [ ] Each redirect is checked before retrieval, and a private or otherwise unsupported destination is rejected.
- [ ] The analysis retains the submitted URL and, when redirected, the final source URL.
- [ ] Login pages, access-denied pages, and paywall notices are not accepted as successful policy extraction.
- [ ] An empty or unusable extraction stops analysis with an extraction error.

### Exceptions and failure behavior

Unreachable pages, external service outages, retrieval timeouts, unsupported page formats, and
extraction failures produce distinct understandable errors and allow retry or pasted-text input.
The system does not bypass access controls, request source-site credentials, retrieve private
network resources, or interpret a downloadable PDF as a supported webpage. Pages whose readable
policy cannot be extracted by the supported retrieval method are reported as unprocessable.

## FR-6 — Content Validation

### Requirement statement

The system shall validate submitted content and provide an understandable error when the URL or text cannot be processed.

### Purpose

Prevent unusable or unsupported input from being represented as an analyzed policy.

### Intended user

Any user submitting a URL or pasted text.

### Preconditions

The user has submitted input, or FR-5 has produced retrieved content for validation.

### Expected workflow

1. The system checks the selected input mode for required values and supported format.
2. For URLs, the system checks public-destination eligibility before retrieval and validates extracted text afterward.
3. The system checks whether the text is readable and processable within supported input limits.
4. Accepted content proceeds to analysis; rejected content receives a specific correction or alternative action.

### Acceptance criteria

- [ ] Empty URL input, malformed URLs, unsupported URL schemes, and private destinations do not proceed to analysis.
- [ ] Empty, whitespace-only, or unreadable text does not proceed to analysis.
- [ ] An extracted error page or content without a usable policy body is rejected rather than summarized as a policy.
- [ ] Unsupported content or content exceeding supported limits receives a stated reason for rejection.
- [ ] Validation applies to submitted requests even when interface-level checks are bypassed.
- [ ] Error messages identify the affected input or processing stage and an available next action, such as correcting input, pasting text, or retrying.
- [ ] A validation failure produces no completed analysis or successful history entry.

### Exceptions and failure behavior

If validation cannot finish because a dependency fails or times out, the system reports that it
could not validate the input, rather than declaring the content valid or invalid without evidence.
Validation establishes processability; it does not certify policy completeness, truthfulness, or
legal validity. Accepted text with no supported privacy findings is handled as an explicit
no-findings outcome under FR-7.

## FR-7 — Privacy-Practice Identification

### Requirement statement

The system shall identify and categorize significant privacy practices contained in the submitted policy.

### Purpose

Organize privacy-relevant statements so users can inspect practices and FR-9 can evaluate them.

### Intended user

A user analyzing validated policy text.

### Preconditions

FR-6 has accepted readable source text from FR-4 or FR-5.

### Expected workflow

1. The system processes the accepted source text for privacy-relevant statements.
2. Identified practices are assigned descriptive categories, such as collection, use, sharing, retention, or user choices.
3. Findings retain their supporting source passages and any material qualifications or uncertainty.
4. Findings proceed to summary, personalized evaluation when applicable, and results presentation.

### Acceptance criteria

- [ ] A test policy with explicit collection, use, and sharing statements produces corresponding categorized findings supported by that text.
- [ ] Every displayed practice has a descriptive category and at least one supporting passage from the analyzed source.
- [ ] Conditional statements preserve their conditions rather than being presented as unconditional practices.
- [ ] Conflicting or ambiguous source statements are identified as such rather than resolved into an unsupported certainty.
- [ ] When no supported practices are identified, the result explicitly reports that outcome without claiming the policy has no privacy risks.
- [ ] Absence of a statement is not presented as proof that a practice never occurs.

### Exceptions and failure behavior

An unavailable analysis service, AI-processing failure, or timeout produces an analysis error and
retry option. Failed processing is not shown as a successful no-findings result. Unsupported
generated findings must not be presented as source-established facts. Identification does not
guarantee exhaustive coverage of all practices.

## FR-8 — Plain-Language Summary

### Requirement statement

The system shall generate a plain-language summary of the analyzed policy and provide supporting excerpts from the source content.

### Purpose

Explain the policy's significant privacy statements in readable language with inspectable evidence.

### Intended user

A user seeking an understandable explanation of the submitted policy.

### Preconditions

Validated source text and the FR-7 findings or explicit no-findings outcome are available.

### Expected workflow

1. The system summarizes significant source-supported privacy statements using everyday language.
2. It associates substantive summary statements with supporting excerpts.
3. It preserves qualifications and identifies relevant uncertainty or missing information.
4. The summary and excerpts become available to FR-10.

### Acceptance criteria

- [ ] The summary explains identified significant practices using everyday wording and explains technical terms it retains.
- [ ] Each substantive claim about the policy is accompanied by or linked to an excerpt that supports it.
- [ ] Excerpts reproduce source wording and remain distinguishable from generated interpretation; omissions do not reverse meaning.
- [ ] The summary preserves material exceptions and conditions found in the supporting text.
- [ ] Missing information or ambiguous language is described as unknown or uncertain rather than filled in with invented policy terms.
- [ ] The summary identifies its informational purpose and does not declare the policy legal, illegal, or compliant with a jurisdiction's law.

### Exceptions and failure behavior

Unavailable external services, AI failures, and timeouts are reported as summary-generation failures.
A missing or unusable summary prevents the overall analysis from being marked complete. Any
available findings may remain visible only with an incomplete-processing label. The user can retry;
the system does not substitute an unrelated or unsupported summary.

## FR-9 — Personalized Risk Evaluation

### Requirement statement

The system shall compare identified privacy practices with the authenticated user’s saved preferences and assign personalized risk indicators with explanations.

### Purpose

Explain how the analyzed practices align or conflict with the user's own privacy choices.

### Intended user

An authenticated user with saved privacy preferences.

### Preconditions

FR-1 establishes the user's identity, FR-2 provides saved preferences, and FR-7 provides findings
and source evidence. The preference values used are fixed for that evaluation.

### Expected workflow

1. The system obtains the authenticated user's saved preferences for the evaluation.
2. It compares relevant identified practices with the corresponding preferences.
3. It assigns indicators distinguishing alignment, conflict, and insufficient evidence.
4. It explains each indicator using the relevant preference and source-supported finding.
5. The indicators, explanations, and preference context become part of the result.

### Acceptance criteria

- [ ] A test policy explicitly allowing a practice the user has marked unacceptable receives a conflict indicator and an explanation naming that preference and practice.
- [ ] A finding explicitly consistent with the relevant saved preference receives an alignment indicator with supporting evidence.
- [ ] Missing or ambiguous evidence for a saved preference receives an insufficient-evidence indicator rather than an assumption of alignment.
- [ ] Each indicator explains its meaning and identifies the saved preference and relevant finding, or the evidence gap, on which it depends.
- [ ] Evaluations of the same explicit practice against opposing saved choices reflect the respective choices in their indicators and explanations.
- [ ] Unsigned-in users receive no purported personalized rating; authenticated users without saved preferences receive a prompt to configure them.
- [ ] A preference change during processing does not mix old and new choices within a single evaluation.

### Exceptions and failure behavior

If authentication expires or saved preferences cannot be retrieved, the system reports that
personalized evaluation is unavailable. Evaluation service failures, AI failures, and timeouts do
not produce a default reassuring indicator or a completed personalized analysis. General findings
may still be viewed with the missing evaluation clearly labeled. Indicators describe preference
alignment, not legal conclusions or guarantees that a service is safe.

## FR-10 — Results Presentation

### Requirement statement

The system shall present the policy summary, categorized findings, personalized risk indicators, explanations, and supporting excerpts in a consolidated results view.

### Purpose

Let users inspect the analysis and its evidence together without confusing missing results with
successful processing.

### Intended user

A user viewing a current analysis or an authenticated user reopening a saved analysis.

### Preconditions

An analysis request exists. Completed components are available for display, or a processing or
failure state is available to report.

### Expected workflow

1. The system displays the analysis source and processing state.
2. Available summary, findings, explanations, and excerpts are grouped in one results view.
3. Personalized indicators are displayed when FR-9 succeeds; otherwise their absence is explained.
4. The user inspects evidence and can access document-specific questions through FR-11.
5. For authenticated users, the view reports whether the completed analysis was saved under FR-12.

### Acceptance criteria

- [ ] A completed personalized analysis displays its summary, categories, risk indicators, explanations, and supporting excerpts in a consolidated view.
- [ ] The view identifies whether the source was a URL or pasted text and associates all displayed components with that analysis.
- [ ] Each displayed finding or indicator allows the user to inspect its supporting excerpt or stated evidence gap.
- [ ] Processing, completion, failure, and incomplete results are visibly distinguishable.
- [ ] Unavailable personalized evaluation is labeled with its reason, such as missing preferences, rather than represented as low risk.
- [ ] Opening another analysis does not show the previous analysis's findings as if they belonged to the newly selected source.
- [ ] The view states that interpretations are informational and may be incomplete or incorrect, and distinguishes saved results from unsaved results.

### Exceptions and failure behavior

If result retrieval fails or times out, the view reports a load failure and supports retry. A missing
component is labeled rather than concealed behind a completed state. Unauthorized requests for a
saved result reveal none of its content. Partial processing output is not presented as a completed
saved analysis.

## FR-11 — Document-Specific Questions

### Requirement statement

The system shall allow users to ask questions about the analyzed document and shall generate responses grounded in that document’s content.

### Purpose

Clarify the current document through source-supported answers.

### Intended user

A user viewing an analyzed document they are authorized to access.

### Preconditions

The analyzed document and its source text are available in the current results context. Access to
a saved document requires the owning user's authenticated session.

### Expected workflow

1. The user submits a question from the document's results view.
2. The system checks that the question is nonempty and within the document-specific scope.
3. It generates an answer using the current document's content and provides supporting passages.
4. If the document cannot support an answer, the system states that limitation.

### Acceptance criteria

- [ ] A question about an explicit policy statement receives an answer grounded in that statement with a supporting excerpt.
- [ ] A question whose answer is absent from the source receives an explicit insufficient-information response without inventing an answer.
- [ ] Requests unrelated to the analyzed document receive a scope message directing the user to document-specific questions.
- [ ] Requests for legal advice or legal conclusions receive a limitation message; any accompanying explanation remains a source-grounded description of the document.
- [ ] Empty or whitespace-only questions are rejected before answer generation.
- [ ] Switching documents changes the answer context; content from another user's analysis is never used or disclosed.
- [ ] Instructions embedded in the source or question cannot authorize access to other accounts or turn the feature into general-purpose chat.

### Exceptions and failure behavior

Answer-service outages, AI-processing failures, and timeouts display a failed-answer state and
allow retry without inventing a response. If the analyzed source is unavailable, the system states
that it cannot provide a grounded answer. An expired session or lost authorization blocks questions
against protected saved documents without exposing their contents. Ambiguous source language is
acknowledged in the answer.

## FR-12 — Analysis History

### Requirement statement

The system shall save completed analyses to the authenticated user’s account and allow the user to retrieve previously saved results from an analysis history.

### Purpose

Let account holders revisit their completed results and supporting evidence.

### Intended user

An authenticated user saving or retrieving their own analyses.

### Preconditions

Saving requires a completed analysis and an authenticated owner. Retrieval requires an
authenticated user and access to their history; an account may have no saved entries.

### Expected workflow

1. On analysis completion, the system saves the result to the authenticated user's account.
2. The results view confirms saving only when persistence succeeds.
3. The user opens history and sees their saved analyses with source identification and analysis date.
4. Selecting an entry reopens its saved result in FR-10, including its evidence and applicable preference context.

### Acceptance criteria

- [ ] A completed analysis for an authenticated user is saved and remains retrievable after sign-out and a later sign-in.
- [ ] Each history entry identifies its source or pasted-text analysis and analysis date sufficiently to select the intended result.
- [ ] Reopening a saved entry preserves its summary, findings, supporting source text and excerpts, and any personalized indicators, explanations, and preference context.
- [ ] Reopening does not require the source webpage to remain available and does not silently perform a new analysis of changed webpage content.
- [ ] Preference updates do not silently alter saved indicators; the reopened result identifies the preference context used at analysis time.
- [ ] An account with no saved analyses displays an explicit empty-history state.
- [ ] A user cannot list or retrieve another account's analyses, including by changing a result identifier or requesting a direct result URL.
- [ ] Failed or incomplete analyses do not appear as completed history entries, and unsigned-in analyses are not saved to an arbitrary account.

### Exceptions and failure behavior

A storage failure or timeout leaves the completed result visibly marked as not confirmed saved and
allows a save retry while the result is available. Retrying a save for the same completed analysis
does not create duplicate history entries. History-load failures show an error rather than an
empty-history claim. Expired authentication requires sign-in before saving or retrieving account
data; the system does not assign an analysis to a different account on retry. Missing or unauthorized
entries return an access or unavailable-result message without disclosing another user's content.

## MVP exclusions

The committed MVP excludes:

- PDF upload, general document upload, and ingestion of downloadable files as policy webpages.
- Retrieval of inaccessible, authenticated, paywalled, or private webpages, including bypassing access controls.
- Policy comparison, browser extensions, mobile apps, automatic policy monitoring, and relationship maps.
- General-purpose chat or answers based on unrelated documents or unsupported external knowledge.
- Legal advice, legal conclusions, compliance certification, and guarantees of perfect AI accuracy or complete practice or jurisdiction coverage.

Performance thresholds and other non-functional targets are specified separately in DP1 Section
3.6. This document assigns no team members or implementation owners.

## Traceability matrix

| DP1 Section 3.5 ID | Requirement                     | MVP feature group               |
| ------------------ | ------------------------------- | ------------------------------- |
| FR-1               | Account Authentication          | Account and Preferences         |
| FR-2               | Privacy Preferences             | Account and Preferences         |
| FR-3               | URL Submission                  | Policy Submission and Ingestion |
| FR-4               | Text Submission                 | Policy Submission and Ingestion |
| FR-5               | Content Retrieval               | Policy Submission and Ingestion |
| FR-6               | Content Validation              | Policy Submission and Ingestion |
| FR-7               | Privacy-Practice Identification | Policy Analysis and Summary     |
| FR-8               | Plain-Language Summary          | Policy Analysis and Summary     |
| FR-9               | Personalized Risk Evaluation    | Personalized Risk Evaluation    |
| FR-10              | Results Presentation            | Results and Document Chat       |
| FR-11              | Document-Specific Questions     | Results and Document Chat       |
| FR-12              | Analysis History                | Analysis History                |
