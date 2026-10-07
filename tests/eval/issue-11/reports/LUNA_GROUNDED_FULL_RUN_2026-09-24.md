# GPT-6 Luna: source-grounded full-policy retest

**Bottom line:** Keeping Luna at `medium`, the revised extraction returned 75 findings across the same two complete archived policies. Every cited line ID existed, so the application could copy the source lines exactly—including Markdown links. It also captured Spotify's previously missed 90-day retention qualification. But it **missed Facebook's explicit no-sale statement**, which the earlier full-policy run found. This is a useful improvement in citation handling, not proof of better overall accuracy or coverage.

## What changed

The model still decides what each policy says. The application numbers each nonempty raw Markdown line and asks Luna for supporting line IDs rather than a hand-copied quote. It then resolves each ID back to the exact source line or flags an unknown ID. Each finding also has a required `qualifications` array, where Luna can state conditions or exceptions with their own supporting IDs. The prompt asks Luna to cover materially distinct practices throughout the document and preserve uncertainty and negation.

This division matters: code can guarantee that retrieved text is copied exactly; it **cannot** guarantee that Luna chose the right lines, interpreted them correctly, or found every important practice. The earlier run asked Luna to copy free-text `evidence` directly, and its three Facebook failures came from flattening Markdown links. The [first full-policy report](LUNA_FULL_RUN_2026-09-24.md) is kept unchanged for comparison.

## Run setup and results

| Setting              | Value                                                                         |
| -------------------- | ----------------------------------------------------------------------------- |
| Run time             | September 24, 2026, 03:10:14 UTC                                              |
| Model                | `gpt-6-luna`, `medium` reasoning                                              |
| Inputs               | Same complete Spotify and Facebook archive files; numbered raw Markdown lines |
| Calls                | One per policy, two total; no retries                                         |
| Output caps          | Spotify 11,000; Facebook 14,000 tokens, including reasoning                   |
| Configuration digest | `2aac25582046d22c4b6564c18edfaf6c71744435a20b7108a29598d6e220c177`            |

| Policy    | Completed / schema-valid | Findings | Qualifications | Resolvable source IDs | Input / output tokens |     Latency | Estimated token cost |
| --------- | ------------------------ | -------: | -------------: | --------------------- | --------------------: | ----------: | -------------------: |
| Spotify   | Yes / yes                |       39 |             45 | All                   |        11,094 / 8,642 |      54.3 s |             $0.00571 |
| Facebook  | Yes / yes                |       36 |             66 | All                   |       71,928 / 10,272 |      65.6 s |             $0.01413 |
| **Total** | **2 / 2**                |   **75** |        **111** | **All**               |   **83,022 / 18,914** | **119.9 s** |         **$0.01983** |

The estimated token cost is about **1.98 cents**, including reported cache-write usage at the [official Luna rate](https://developers.openai.com/api/docs/models/gpt-6-luna); it is not an invoice. The pre-run conservative allowance was $0.09995. No high-reasoning, Terra, or automatic retry call was made. The raw result log is local at [`results/grounded-full-run-2026-09-24T03-10-14.345Z-2aac25582046.jsonl`](../results/grounded-full-run-2026-09-24T03-10-14.345Z-2aac25582046.jsonl) and is Git-ignored.

## Targeted review of known failure points

| Check                                 | First full-policy run                                                           | Source-grounded retest                                                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Spotify search-query retention caveat | Omitted the “subject to other applicable retention rules” qualification.        | Finding `retention_by_purpose_and_data_type` records that qualification, citing `L0280`.                                   |
| Facebook marketing-vendor citation    | Rewrote the Markdown-linked phrase as plain text, so its quote was not literal. | Finding `vendor_and_service_provider_sharing` cites raw source line `L1195`; code copies the Markdown text exactly.        |
| Facebook Accounts Center citation     | Rewrote a Markdown-linked phrase, failing the literal-quote check.              | Finding `cross_account_and_device_use` cites raw source line `L0665`.                                                      |
| Facebook legal-request support        | Quoted only a list heading despite a more detailed summary.                     | Finding `legal_and_safety_disclosures` cites substantive lines including `L1731`.                                          |
| Facebook no-sale statement            | Found the explicit negative sale claim.                                         | **Missed it.** Source line `L1113` says Meta does not sell information, but the 36 findings contain no equivalent finding. |

The section-by-section spot check found another likely omission in Facebook's **legal basis and rights** section: the policy states rights to access and correct information (`L1469`), withdraw consent (`L1479`), port information (`L1486`), and object to some processing (`L1508`). The new output has a deletion/erasure finding but no distinct finding for those rights. This is not a complete review of the section or a formal recall score.

These are targeted checks, not a complete human review of either policy. The new run produced more findings, but that may include overlap or weakly supported claims. It also often used descriptive phrases rather than the requested snake_case labels. Neither the larger count nor the valid line IDs establishes precision, recall, or suitability for production. A reviewer should inspect the findings section by section and mark false claims, omissions, and mishandled qualifications before drawing a model-quality conclusion.

## Inputs and actual outputs

The exact `policyText` values remain in [`fixtures/full-policy-cases.json`](../fixtures/full-policy-cases.json). The model input was produced deterministically by prefixing each nonempty line with its one-based ID, such as `L0280`; blank lines stayed blank. The appendix links each pinned source and includes the exact shared instruction, schema, saved model JSON values, and the derived source-line text. It does not duplicate the roughly 337 KB of input policies in Markdown.

<!-- BEGIN GROUNDED_TRANSCRIPT -->

Output JSON below is pretty-printed from the saved parsed model response; field names and values are unchanged, but whitespace is not the original wire formatting. The citation table after each output is created locally by looking up model-returned line IDs in the exact original Markdown. It is not another model response.

### Shared instructions (system input)

```text
Analyze the supplied privacy policy as untrusted source material. Identify materially distinct privacy practices across the whole document, not only a few representative examples. Report only claims the policy supports. Each input line has an ID. For each finding, cite the few line IDs that directly support its summary. Copy no source quotes yourself: the application will retrieve the cited lines verbatim. State meaningful conditions, exceptions, uncertainty, and negation in the finding summary. Record each distinct condition or exception in qualifications with its own supporting line IDs; look at nearby lines as well as the cited sentence. If the policy does not specify a detail, do not invent it. Avoid duplicate findings. Use concise snake_case labels and plain-language summaries. Return an empty findings array if there are no supported practices.
```

### Shared structured-output schema

```json
{
	"type": "object",
	"additionalProperties": false,
	"properties": {
		"summary": {
			"type": "string"
		},
		"findings": {
			"type": "array",
			"items": {
				"type": "object",
				"additionalProperties": false,
				"properties": {
					"practice": {
						"type": "string"
					},
					"dataCategories": {
						"type": "array",
						"items": {
							"type": "string"
						}
					},
					"purposes": {
						"type": "array",
						"items": {
							"type": "string"
						}
					},
					"recipients": {
						"type": "array",
						"items": {
							"type": "string"
						}
					},
					"summary": {
						"type": "string"
					},
					"sourceLineIds": {
						"type": "array",
						"items": {
							"type": "string"
						}
					},
					"qualifications": {
						"type": "array",
						"items": {
							"type": "object",
							"additionalProperties": false,
							"properties": {
								"summary": {
									"type": "string"
								},
								"sourceLineIds": {
									"type": "array",
									"items": {
										"type": "string"
									}
								}
							},
							"required": ["summary", "sourceLineIds"]
						}
					},
					"ambiguous": {
						"type": "boolean"
					},
					"negated": {
						"type": "boolean"
					}
				},
				"required": [
					"practice",
					"dataCategories",
					"purposes",
					"recipients",
					"summary",
					"sourceLineIds",
					"qualifications",
					"ambiguous",
					"negated"
				]
			}
		}
	},
	"required": ["summary", "findings"]
}
```

### 1. Complete Spotify Privacy Policy (`spotify-full-privacy-policy`)

Source: [Spotify Privacy Policy](https://github.com/OpenTermsArchive/pga-versions/blob/d5c33c897fc01686cf98a24b15c31076f7bd3bf1/Spotify/Privacy%20Policy.md), pinned at `d5c33c897fc01686cf98a24b15c31076f7bd3bf1`.

Input: [full-policy-cases.json](../fixtures/full-policy-cases.json), case `spotify-full-privacy-policy`, `policyText` (46,993 UTF-8 bytes; blob SHA `4f3bab7ee5bea212ac906292ba4d5ee9c16a8e03`). Each nonempty source line received its one-based `L####` prefix before being sent.

**Actual Luna output**

```json
{
	"summary": "Spotify describes collecting account, usage, optional-feature, and third-party-sourced data; using it to provide, improve, secure, and promote its services; and disclosing it to users, partners, service providers, and authorities in specified circumstances. The policy also describes user controls, retention limits, international-transfer safeguards, and security measures.",
	"findings": [
		{
			"practice": "account_data_collection",
			"dataCategories": ["User Data"],
			"purposes": ["Create and operate an account", "Enable use of the Spotify Service"],
			"recipients": [],
			"summary": "Spotify collects account information such as contact and profile details, credentials, date of birth, and country when users sign up or update their account. Which information is collected can vary.",
			"sourceLineIds": ["L0137", "L0140"],
			"qualifications": [
				{
					"summary": "The data collected depends on the Service Option, how the account is created, the user's country, and whether a third-party sign-in service is used.",
					"sourceLineIds": ["L0140"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "street_address_processing",
			"dataCategories": ["Street Address Data"],
			"purposes": [
				"Check eligibility",
				"Deliver legally required notices and support",
				"Billing and tax administration",
				"Deliver purchased or requested physical goods or gifts"
			],
			"recipients": ["Third-party address-verification applications"],
			"summary": "Spotify may ask for and process a street address for eligibility, notices, support, billing, tax, and delivery purposes. It may use a third-party application to help verify the address.",
			"sourceLineIds": ["L0141"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "service_usage_and_device_data_collection",
			"dataCategories": [
				"Usage Data",
				"Search queries",
				"Streaming history",
				"Playlists and library",
				"Browsing history",
				"Account settings",
				"User interactions and content",
				"Technical data",
				"General location",
				"Device sensor data"
			],
			"purposes": [
				"Understand use of the Spotify Service",
				"Provide relevant content, advertising, and recommendations",
				"Meet geographic content requirements",
				"Provide features requiring sensor data"
			],
			"recipients": [],
			"summary": "Spotify collects data generated through use of its services, including activity and content, interactions, technical and device information, and general location. It may collect motion- or orientation-generated sensor data when needed for a service feature.",
			"sourceLineIds": ["L0145", "L0146"],
			"qualifications": [
				{
					"summary": "General location is non-precise and may be inferred from technical information such as IP address or device language, or from payment currency.",
					"sourceLineIds": ["L0146"]
				},
				{
					"summary": "Sensor data is collected only if needed for a Spotify feature that requires it.",
					"sourceLineIds": ["L0146"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "optional_voice_and_message_data",
			"dataCategories": ["Voice Data", "Message Data"],
			"purposes": ["Provide voice or messaging features"],
			"recipients": [],
			"summary": "Spotify collects voice recordings when a user chooses to use an available voice feature, and messages sent directly to another user when a user chooses to use available messaging.",
			"sourceLineIds": ["L0151", "L0152"],
			"qualifications": [
				{
					"summary": "Voice and messaging collection applies only where the feature is available in the user's market and the user chooses to use it.",
					"sourceLineIds": ["L0151", "L0152"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "age_check_data_processing",
			"dataCategories": ["Age Check Data", "Identity document photo", "Face photo"],
			"purposes": ["Verify or estimate age", "Obtain parental consent for a Managed Account"],
			"recipients": ["Third-party age-check providers"],
			"summary": "For an Age Check, Spotify may process information provided for an age-restricted feature or parental consent, including an identity-document photo and, in some cases, a face photo. The checks are powered by a third-party provider.",
			"sourceLineIds": ["L0153"],
			"qualifications": [
				{
					"summary": "Age Check Data is deleted immediately after the Age Check is complete.",
					"sourceLineIds": ["L0153", "L0292"]
				},
				{
					"summary": "A face photo may be used with identity-document verification in some cases; facial age estimation uses a face photo to estimate age.",
					"sourceLineIds": ["L0153"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "payment_data_processing",
			"dataCategories": [
				"Payment and Purchase Data",
				"Name",
				"Date of birth",
				"Payment method details",
				"ZIP/postal code",
				"Mobile phone number",
				"Purchase and payment history"
			],
			"purposes": [
				"Process payments and purchases",
				"Provide subscriptions, trials, or purchased items"
			],
			"recipients": [],
			"summary": "When a user purchases from Spotify or signs up for certain Service Options or a trial, Spotify processes payment and purchase information. The information collected varies by payment method.",
			"sourceLineIds": ["L0154", "L0195"],
			"qualifications": [
				{
					"summary": "Spotify says it never stores a user's full credit or debit card number.",
					"sourceLineIds": ["L0154"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "precise_location_processing",
			"dataCategories": ["Precise Location Data"],
			"purposes": [
				"Improve personalized recommendations and the Spotify experience",
				"Recommend nearby concerts and events",
				"Show what is trending at a location"
			],
			"recipients": [],
			"summary": "Spotify may use precise location data to provide location-based features and recommendations, and information learned from listening in one location may inform suggestions to other users nearby.",
			"sourceLineIds": ["L0155", "L0186"],
			"qualifications": [
				{
					"summary": "Spotify says it uses precise location data only with the user's permission, which can be granted through an in-app prompt and device settings; the listed improvement purpose applies where the data is available and explicitly permitted.",
					"sourceLineIds": ["L0155", "L0186"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "survey_and_customer_service_data",
			"dataCategories": ["Survey and Research Data", "Customer Service Data"],
			"purposes": ["Conduct research and surveys", "Respond to or support customer contacts"],
			"recipients": [],
			"summary": "Spotify collects information users provide in surveys or user research, as described in the relevant survey or research, and information about their Customer Service contacts, including chats and email correspondence.",
			"sourceLineIds": ["L0156", "L0157", "L0197"],
			"qualifications": [
				{
					"summary": "Survey and research data use is described in the particular survey or research.",
					"sourceLineIds": ["L0156"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "third_party_source_data",
			"dataCategories": ["User Data", "Usage Data", "Payment and Purchase Data"],
			"purposes": [
				"Create accounts",
				"Enable integrations",
				"Provide services and features",
				"Process payments and purchases",
				"Deliver and measure advertising and marketing",
				"Enhance services and offerings"
			],
			"recipients": [
				"Authentication partners",
				"Connected third-party applications, services, and devices",
				"Technical service partners",
				"Payment partners and merchants",
				"Advertising and marketing partners",
				"Acquired companies"
			],
			"summary": "Spotify receives personal data from several kinds of third parties, including sign-in providers, connected services and devices, technical and payment partners, merchants, advertising and marketing partners, and companies it acquires.",
			"sourceLineIds": ["L0159", "L0164", "L0165", "L0166", "L0167", "L0168", "L0169"],
			"qualifications": [
				{
					"summary": "Spotify says it will ask permission before collecting information from certain connected third parties; the policy does not say this applies to every such collection.",
					"sourceLineIds": ["L0165"]
				},
				{
					"summary": "Data from advertising and marketing partners may include device identifiers such as hashed contact information and partner inferences about interests and preferences.",
					"sourceLineIds": ["L0168"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "logged_out_app_data",
			"dataCategories": ["Usage Data"],
			"purposes": [
				"Understand access and use",
				"Provide an appropriate experience based on country or region"
			],
			"recipients": [],
			"summary": "When someone uses the Spotify mobile app while logged out, Spotify collects limited information about their use. If they later create an account, Spotify combines that data with the account data.",
			"sourceLineIds": ["L0171"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "service_provision_and_personalization",
			"dataCategories": [
				"User Data",
				"Street Address Data",
				"Usage Data",
				"Voice Data",
				"Message Data",
				"Payment and Purchase Data",
				"Survey and Research Data",
				"Age Check Data"
			],
			"purposes": [
				"Set up accounts",
				"Personalize accounts and recommendations",
				"Provide the app and optional features",
				"Enable sharing links to Spotify content",
				"Provide age-appropriate experiences"
			],
			"recipients": [],
			"summary": "Spotify uses listed account, usage, and other data categories to provide the Spotify Service, including account setup, personalization, app delivery, optional features, content-link sharing, and age-appropriate experiences.",
			"sourceLineIds": ["L0183", "L0185"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "service_diagnostics",
			"dataCategories": [
				"User Data",
				"Usage Data",
				"Voice Data",
				"Message Data",
				"Customer Service Data"
			],
			"purposes": ["Diagnose, troubleshoot, and fix service issues"],
			"recipients": [],
			"summary": "Spotify uses the listed data categories to diagnose, troubleshoot, and fix issues with its service.",
			"sourceLineIds": ["L0187"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "feature_development_and_model_training",
			"dataCategories": [
				"User Data",
				"Usage Data",
				"Voice Data",
				"Survey and Research Data",
				"Customer Service Data"
			],
			"purposes": [
				"Evaluate and develop features, technologies, and service improvements",
				"Develop and train algorithmic and machine-learning models",
				"Improve recommendations and user experience",
				"Enforce platform rules and guidelines"
			],
			"recipients": [],
			"summary": "Spotify uses listed data to evaluate and develop features and service improvements, including developing and training algorithmic and machine-learning models. Examples include recommendation improvements, AI features, and enforcement of its rules and guidelines.",
			"sourceLineIds": ["L0188"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "marketing_and_advertising_use",
			"dataCategories": ["User Data", "Usage Data", "Survey and Research Data"],
			"purposes": ["Tailor advertising to interests", "Send email marketing"],
			"recipients": [],
			"summary": "Spotify uses the listed data categories for marketing and advertising, including tailoring ads to interests and sending email marketing.",
			"sourceLineIds": ["L0189"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "legal_and_contractual_processing",
			"dataCategories": [
				"User Data",
				"Street Address Data",
				"Usage Data",
				"Voice Data",
				"Message Data",
				"Payment and Purchase Data",
				"Survey and Research Data",
				"Precise Location Data",
				"Customer Service Data"
			],
			"purposes": [
				"Comply with legal obligations",
				"Fulfill contractual obligations with third parties",
				"Establish, exercise, or defend legal claims"
			],
			"recipients": ["Third-party rightsholders", "Lawyers"],
			"summary": "Spotify uses personal data to comply with legal obligations, fulfill third-party contracts, and establish, exercise, or defend legal claims. It gives pseudonymized listening data to a rightsholder as an example of fulfilling a third-party agreement and may provide information to its lawyers in litigation.",
			"sourceLineIds": ["L0190", "L0191", "L0193"],
			"qualifications": [
				{
					"summary": "The listed legal-obligation data categories do not include Age Check Data in the policy's table.",
					"sourceLineIds": ["L0190"]
				},
				{
					"summary": "The example of listening data provided to a rightsholder is pseudonymized, meaning it is identified by a code rather than a name or other directly identifying information.",
					"sourceLineIds": ["L0191"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "business_planning_and_research",
			"dataCategories": [
				"User Data",
				"Usage Data",
				"Payment and Purchase Data",
				"Voice Data",
				"Survey and Research Data"
			],
			"purposes": ["Business planning, reporting, and forecasting", "Conduct research and surveys"],
			"recipients": [],
			"summary": "Spotify uses data for business planning, reporting, and forecasting, including analysis of aggregated user data, and conducts research and surveys, such as asking users for feedback.",
			"sourceLineIds": ["L0194", "L0197"],
			"qualifications": [
				{
					"summary": "The business-planning example uses aggregated user data.",
					"sourceLineIds": ["L0194"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "security_and_fraud_prevention",
			"dataCategories": [
				"User Data",
				"Street Address Data",
				"Message Data",
				"Usage Data",
				"Payment and Purchase Data",
				"Customer Service Data"
			],
			"purposes": ["Keep the service secure", "Detect and prevent fraud"],
			"recipients": [],
			"summary": "Spotify uses the listed data categories to keep its service secure and to detect and prevent fraud, including by analyzing Usage Data for fraudulent use.",
			"sourceLineIds": ["L0196"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "profile_and_content_visibility",
			"dataCategories": [
				"Profile name",
				"Profile photo",
				"Public playlists and associated details",
				"Posted content",
				"Follower and following counts"
			],
			"purposes": ["Make profile and user-posted information available to other Spotify users"],
			"recipients": ["Other Spotify users"],
			"summary": "Certain profile information, public playlists, posted content, and follow counts are available to other Spotify users.",
			"sourceLineIds": ["L0204", "L0206", "L0208", "L0209", "L0210", "L0211", "L0212"],
			"qualifications": [
				{
					"summary": "A profile photo is included if the user chooses to upload one; visibility of followed users' profiles may depend on settings.",
					"sourceLineIds": ["L0209", "L0212"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "user_initiated_external_sharing",
			"dataCategories": [
				"Profile",
				"Posted content and details",
				"Playlists and associated details"
			],
			"purposes": ["Enable sharing through third-party services"],
			"recipients": ["Third-party social media and messaging services"],
			"summary": "A user or another user can share certain profile and Spotify content through third-party services. The third party may retain a copy to support its features.",
			"sourceLineIds": ["L0214", "L0216", "L0217", "L0218", "L0220"],
			"qualifications": [
				{
					"summary": "The policy describes this sharing as something a user or another user can do; it does not state that Spotify itself controls the third party's retention.",
					"sourceLineIds": ["L0214", "L0220"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "feature_enabled_or_permitted_disclosure",
			"dataCategories": ["User Data", "Usage Data", "Message Data"],
			"purposes": [
				"Enable user-selected features, integrations, or services",
				"Share service activity with other users",
				"Provide Support Community functionality",
				"Send artist or partner news and promotional offers"
			],
			"recipients": [
				"Connected third-party applications, services, and devices",
				"Support Community users",
				"Other Spotify users",
				"Artists and record labels"
			],
			"summary": "Spotify discloses specified data to certain recipients when the user chooses a feature or connected third-party service and disclosure is needed for it, or when the user otherwise gives permission. Examples include integrations, community profiles and posts, social sharing, and artist or label offers.",
			"sourceLineIds": ["L0222", "L0224", "L0226", "L0227", "L0231", "L0232", "L0233", "L0234"],
			"qualifications": [
				{
					"summary": "Users can view and remove many connected third-party connections in their account.",
					"sourceLineIds": ["L0231"]
				},
				{
					"summary": "Support Community profile names and posted questions or comments are publicly displayed to anyone using that community.",
					"sourceLineIds": ["L0232"]
				},
				{
					"summary": "Users may change their mind and withdraw consent for sharing User Data with artists, labels, or other partners for news or promotional offers.",
					"sourceLineIds": ["L0234"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "service_provider_disclosure",
			"dataCategories": [
				"User Data",
				"Street Address Data",
				"Usage Data",
				"Voice Data",
				"Message Data",
				"Payment and Purchase Data",
				"Survey and Research Data",
				"Age Check Data"
			],
			"purposes": [
				"Provide services to Spotify, including customer support, infrastructure, security, marketing, and eligibility verification"
			],
			"recipients": ["Service providers"],
			"summary": "Spotify discloses the listed data categories to service providers so they can provide services to Spotify, including customer support, technical infrastructure, security, marketing, and eligibility checks.",
			"sourceLineIds": ["L0240", "L0242"],
			"qualifications": [
				{
					"summary": "Eligibility verification is given as an example for certain Service Options, such as Spotify Premium Student.",
					"sourceLineIds": ["L0242"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "payment_partner_disclosure",
			"dataCategories": ["User Data", "Payment and Purchase Data"],
			"purposes": ["Process payments", "Prevent fraud"],
			"recipients": ["Payment partners"],
			"summary": "Spotify discloses User Data and Payment and Purchase Data to payment partners for payment processing and anti-fraud purposes.",
			"sourceLineIds": ["L0243"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "advertising_partner_disclosure",
			"dataCategories": ["User Data", "Usage Data"],
			"purposes": [
				"Deliver more relevant advertising on Spotify and online",
				"Measure advertising effectiveness"
			],
			"recipients": ["Advertising partners"],
			"summary": "Spotify discloses User Data and Usage Data to advertising partners to deliver relevant advertising on Spotify and online and to help measure ad effectiveness.",
			"sourceLineIds": ["L0244"],
			"qualifications": [
				{
					"summary": "Spotify says it does not disclose personal data to advertising partners for users under 18.",
					"sourceLineIds": ["L0244"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "marketing_partner_disclosure",
			"dataCategories": ["User Data", "Usage Data"],
			"purposes": [
				"Enable promotions and bundled offers",
				"Promote Spotify on other online services",
				"Measure promotion effectiveness",
				"Present relevant offers and marketing"
			],
			"recipients": ["Marketing partners"],
			"summary": "Spotify discloses certain User Data and Usage Data to marketing partners for promotions, advertising, and measuring promotion effectiveness. Spotify and partners may use the disclosed information with other data they collect to present offers and marketing.",
			"sourceLineIds": ["L0245"],
			"qualifications": [
				{
					"summary": "For users under 18, Spotify says it does not disclose personal data to marketing partners by default; the policy does not describe the circumstances, if any, in which that default changes.",
					"sourceLineIds": ["L0245"]
				}
			],
			"ambiguous": true,
			"negated": false
		},
		{
			"practice": "ticketing_partner_disclosure",
			"dataCategories": ["User Data", "Name", "Email", "Order details"],
			"purposes": ["Verify ticket purchasers at event check-in"],
			"recipients": ["Ticketing agents", "Event venues and box offices"],
			"summary": "For events where Spotify sells tickets, Spotify discloses the purchaser's name, email, or other order details to event partners so the purchaser can check in as a verifiable guest.",
			"sourceLineIds": ["L0246"],
			"qualifications": [
				{
					"summary": "The disclosure is described for each event for which Spotify sells tickets.",
					"sourceLineIds": ["L0246"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "podcast_hosting_disclosure",
			"dataCategories": ["Usage Data", "IP address"],
			"purposes": ["Enable podcast hosting and delivery"],
			"recipients": ["Podcast hosting platforms"],
			"summary": "When a user plays a podcast, Spotify discloses certain data, such as the user's IP address, to the platform hosting the podcast. Spotify also allows streaming of podcasts hosted on platforms it does not own.",
			"sourceLineIds": ["L0247"],
			"qualifications": [
				{
					"summary": "The policy directs users to the hosting platform's own privacy policy for its use of disclosed data; the show or episode description should identify the hosting platform.",
					"sourceLineIds": ["L0247"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "pseudonymized_research_disclosure",
			"dataCategories": ["User Data", "Usage Data"],
			"purposes": ["Statistical analysis", "Academic study"],
			"recipients": ["Academic researchers"],
			"summary": "Spotify discloses User Data and Usage Data to academic researchers for activities such as statistical analysis and academic study, only in pseudonymized format.",
			"sourceLineIds": ["L0248"],
			"qualifications": [
				{
					"summary": "The policy limits this disclosure to pseudonymized data.",
					"sourceLineIds": ["L0248"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "group_company_disclosure",
			"dataCategories": [
				"User Data",
				"Street Address Data",
				"Usage Data",
				"Voice Data",
				"Message Data",
				"Payment and Purchase Data",
				"Survey and Research Data"
			],
			"purposes": [
				"Daily business operations",
				"Maintain, improve, and provide Spotify and acquired-company services",
				"Measure ad campaigns and understand listening trends"
			],
			"recipients": ["Spotify group companies", "Companies Spotify acquires"],
			"summary": "Spotify discloses the listed data categories within its corporate group, including acquired companies, for business operations and to maintain, improve, and provide services.",
			"sourceLineIds": ["L0249"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "business_transaction_disclosure",
			"dataCategories": [
				"User Data",
				"Street Address Data",
				"Usage Data",
				"Voice Data",
				"Message Data",
				"Payment and Purchase Data",
				"Survey and Research Data"
			],
			"purposes": ["Transfer data as part of a sale or potential sale of a business"],
			"recipients": ["Buyer or potential buyer", "Successor or affiliate"],
			"summary": "If Spotify sells or negotiates to sell any part of its business, it may transfer the listed personal data to a successor or affiliate as part of the transaction.",
			"sourceLineIds": ["L0250"],
			"qualifications": [
				{
					"summary": "The disclosure is described as conditional on a sale or negotiation to sell any part of Spotify's business.",
					"sourceLineIds": ["L0250"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "legal_request_disclosure",
			"dataCategories": ["Personal data; categories depend on the request"],
			"purposes": [
				"Comply with legal obligations or valid legal process",
				"Support investigations or litigation",
				"Protect safety or prevent imminent harm"
			],
			"recipients": [
				"Courts",
				"Authorities",
				"Parties to litigation",
				"Other authorized third parties"
			],
			"summary": "Spotify may process and share personal data in response to requests from courts, authorities, litigation parties, or other authorized third parties when it believes in good faith the disclosure is necessary for the specified legal or safety purposes.",
			"sourceLineIds": ["L0252", "L0254", "L0255", "L0256", "L0258"],
			"qualifications": [
				{
					"summary": "Spotify says the categories of data shared depend on the nature of the specific request.",
					"sourceLineIds": ["L0258"]
				},
				{
					"summary": "The policy describes disclosure when Spotify believes in good faith it is necessary, including for legal compliance, valid legal process, investigations, litigation, safety, or preventing death or imminent bodily harm.",
					"sourceLineIds": ["L0252", "L0254", "L0255", "L0256"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "tailored_advertising_and_opt_out",
			"dataCategories": [
				"Information about the user used to personalize ads",
				"Registration information",
				"Real-time Spotify usage"
			],
			"purposes": ["Make advertising more relevant"],
			"recipients": [],
			"summary": "Spotify uses information about users to personalize ads. Users can opt out through account settings, a website privacy-choice link when logged out or without an account, certain podcast controls, or a recognized preference signal.",
			"sourceLineIds": ["L0114", "L0116", "L0117", "L0121", "L0122", "L0123", "L0124"],
			"qualifications": [
				{
					"summary": "When a user opts out, Spotify may still show less-relevant ads, including on free or paid Service Options as applicable, based on registration information and real-time Spotify use.",
					"sourceLineIds": ["L0126"]
				},
				{
					"summary": "Controls for some podcasts apply when the content provider inserts ads; the hosting provider, which may not be Spotify, manages those controls.",
					"sourceLineIds": ["L0123"]
				},
				{
					"summary": "A preference signal may need to be renewed on another device or browser, or after cookies are cleared.",
					"sourceLineIds": ["L0124"]
				},
				{
					"summary": "Younger users may have tailored advertising off by default and begin receiving it on reaching the appropriate age; Spotify says it will notify them and provide a settings link.",
					"sourceLineIds": ["L0128", "L0130"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "privacy_rights_and_request_verification",
			"dataCategories": ["Personal data processed by Spotify"],
			"purposes": [
				"Provide access, correction, deletion, portability, consent withdrawal, and tailored-advertising opt-out controls",
				"Verify and respond to privacy requests"
			],
			"recipients": [],
			"summary": "Spotify provides U.S. residents ways to request access, correction, deletion, and portability, withdraw consent when processing is based solely on consent, and opt out of tailored advertising. It may ask for account-related details to verify access, deletion, or correction requests.",
			"sourceLineIds": ["L0076", "L0088", "L0089", "L0090", "L0091", "L0092", "L0094", "L0098"],
			"qualifications": [
				{
					"summary": "Spotify says it may be unable to delete data when it remains necessary, it has an overriding interest, a legal retention obligation applies, or data is needed for legal claims.",
					"sourceLineIds": ["L0090"]
				},
				{
					"summary": "For people without an account, Spotify says it lacks sufficient information to verify identity and link them to a prior visit, so it will be unable to verify and honor their requests.",
					"sourceLineIds": ["L0098"]
				},
				{
					"summary": "Consent withdrawal is available when Spotify processes the personal data solely on the basis of consent.",
					"sourceLineIds": ["L0094"]
				},
				{
					"summary": "Spotify says exercising privacy rights will not result in discriminatory treatment.",
					"sourceLineIds": ["L0083"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "no_significant_automated_decisions",
			"dataCategories": ["Personal data used for decisions"],
			"purposes": ["Automated decision-making"],
			"recipients": [],
			"summary": "Spotify says it does not make decisions in the Spotify Service based solely on automated decision-making, including profiling, that have a legal or similarly significant effect on a person.",
			"sourceLineIds": ["L0093"],
			"qualifications": [],
			"ambiguous": false,
			"negated": true
		},
		{
			"practice": "retention_by_purpose_and_data_type",
			"dataCategories": [
				"Personal data processed through the Spotify Service",
				"Search-query data",
				"Account and profile information",
				"Streaming history"
			],
			"purposes": [
				"Provide the service",
				"Support legitimate and essential business purposes",
				"Comply with law and resolve disputes",
				"Provide retrospective playlists and recommendations"
			],
			"recipients": [],
			"summary": "Spotify retains personal data for as long as necessary to provide the service and for legitimate, essential business purposes. Retention varies by data type: some user-managed information remains while the user chooses, search-query data has a stated 90-day period, and some account data remains until account deletion.",
			"sourceLineIds": [
				"L0263",
				"L0265",
				"L0266",
				"L0267",
				"L0268",
				"L0272",
				"L0276",
				"L0280",
				"L0282",
				"L0284"
			],
			"qualifications": [
				{
					"summary": "Where users can see and update their own personal data, Spotify keeps it for as long as they choose unless a limited purpose described in the policy applies.",
					"sourceLineIds": ["L0276"]
				},
				{
					"summary": "Personal data entered as search queries is given as an example of data deleted after 90 days, subject to other applicable retention rules in the section.",
					"sourceLineIds": ["L0280"]
				},
				{
					"summary": "Some data, including username and profile information, is kept until account deletion; streaming history is kept for the life of the account. On account deletion, this category is deleted or de-identified.",
					"sourceLineIds": ["L0284"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "post_deletion_limited_retention",
			"dataCategories": [
				"Personal data retained after account deletion",
				"Data removed from the Spotify Service"
			],
			"purposes": [
				"Meet legal or contractual obligations",
				"Preserve data for investigations or litigation",
				"User safety",
				"Protect against harmful content"
			],
			"recipients": [],
			"summary": "After account deletion, Spotify may retain some data for longer periods for limited purposes, including legal or contractual obligations, investigations, litigation, user safety, and protection against harmful content.",
			"sourceLineIds": ["L0286", "L0288", "L0290", "L0291"],
			"qualifications": [
				{
					"summary": "The policy says data removed from the service may be kept for a limited period for safety or harmful-content purposes.",
					"sourceLineIds": ["L0288", "L0290", "L0291"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "international_data_transfers",
			"dataCategories": ["Personal data"],
			"purposes": ["Carry out activities described in the policy"],
			"recipients": ["Spotify group companies", "Subcontractors", "Partners"],
			"summary": "Because its business is global, Spotify transfers personal data internationally to group companies, subcontractors, and partners. It says it uses legal-compliance tools and, as appropriate, additional protections such as encryption, pseudonymization, and processes to challenge certain government requests.",
			"sourceLineIds": ["L0297", "L0299", "L0301", "L0303", "L0304"],
			"qualifications": [
				{
					"summary": "Additional protections are selected as appropriate for each transfer; encryption, pseudonymization, and processes to challenge requests are examples.",
					"sourceLineIds": ["L0301", "L0303", "L0304"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "security_safeguards",
			"dataCategories": ["Personal data"],
			"purposes": [
				"Protect data security",
				"Guard against unauthorized access and unnecessary retention"
			],
			"recipients": [],
			"summary": "Spotify says it uses technical and organizational measures and safeguards, including pseudonymization, encryption, access controls, and retention policies, to help protect personal data and guard against unauthorized access and unnecessary retention.",
			"sourceLineIds": ["L0309", "L0311"],
			"qualifications": [
				{
					"summary": "Spotify cautions that no system is ever completely secure.",
					"sourceLineIds": ["L0309"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "children_data_handling",
			"dataCategories": ["Personal data of children under the applicable Age Limit"],
			"purposes": [
				"Operate age-limited services",
				"Delete data collected from under-age children when discovered"
			],
			"recipients": [],
			"summary": "Spotify says it does not knowingly collect or use personal data from children under the applicable Age Limit in the standard Spotify Service and will take reasonable steps to delete such data if it learns it has collected it.",
			"sourceLineIds": ["L0327", "L0330", "L0332", "L0334", "L0336"],
			"qualifications": [
				{
					"summary": "The policy does not apply to Managed Accounts or Spotify Kids except where those services' own notices say it does.",
					"sourceLineIds": ["L0330"]
				},
				{
					"summary": "A person under the Age Limit is told not to use the standard service; a minor above that limit may use it only with parent or legal-guardian consent.",
					"sourceLineIds": ["L0334"]
				},
				{
					"summary": "If Spotify discovers it collected data from a child under the applicable Age Limit, deletion may require deleting the child's Spotify account.",
					"sourceLineIds": ["L0336"]
				}
			],
			"ambiguous": false,
			"negated": true
		},
		{
			"practice": "third_party_link_tracking_notice",
			"dataCategories": ["Data about users collected or shared by third parties"],
			"purposes": [
				"Third-party website, plug-in, or application purposes not specified by Spotify"
			],
			"recipients": ["Third-party websites", "Plug-ins", "Applications"],
			"summary": "Links in the Spotify Service may lead to third parties that can collect or share data about users. Spotify says it does not control those sites and is not responsible for their privacy practices.",
			"sourceLineIds": ["L0340", "L0343"],
			"qualifications": [],
			"ambiguous": false,
			"negated": true
		}
	]
}
```

Reference check: **all line IDs resolved**.

**Exact source lines selected by Luna, copied by the application**

```json
[
	{
		"lineId": "L0076",
		"text": "Certain U.S. states have adopted privacy laws that give certain rights to individuals over their personal data. We provide these rights to all residents of the U.S., regardless of where they live."
	},
	{
		"lineId": "L0083",
		"text": "You can also watch our video about [Your Privacy Controls](https://www.spotify.com/us/safetyandprivacy/learn-more-about-privacy). You will not receive discriminatory treatment for exercising any of your privacy rights."
	},
	{
		"lineId": "L0088",
		"text": "| **Know/Access** | **Request to know and access the personal data we process about you.** | To request a copy of your personal data from Spotify, either:<br><br>*   use the ‘Download your data’ tool on your [Account Privacy](https://www.spotify.com/account/privacy/) page, or<br>*   [contact us](#_l8q1yc21jzme)<br><br>When you download your data you will receive the information about your data that Spotify has to provide under applicable laws. If you would like more details about how we process your personal data, you can [contact us](#_l8q1yc21jzme). |"
	},
	{
		"lineId": "L0089",
		"text": "| **Correction** | **Request that we amend or update your personal data where it’s inaccurate.** | You can edit your User Data under ‘Edit profile’ in your account or by [contacting us](#_l8q1yc21jzme). |"
	},
	{
		"lineId": "L0090",
		"text": "| **Deletion** | **Request that we delete certain of your personal data.**<br><br>Please note there are situations where Spotify is unable to delete your data, for example when:<br><br>*   it’s still necessary to process the data for the purpose we collected it for<br>*   we have an overriding interest in continuing to process the data, for example where we need the data to protect our services from fraud<br>*   Spotify has a legal obligation to keep the data, or<br>*   Spotify needs the data to establish, exercise or defend legal claims. For example, if there’s an unresolved issue relating to your account | There are several ways you can delete personal data from Spotify:<br><br>*   to remove audio content you have saved, select the relevant content and choose to remove it. For example you can remove a track from your playlist or remove an artist you’ve saved to your library<br>*   to request deletion of your account data from Spotify and close your account, follow the steps on our [support page](https://support.spotify.com/article/close-account/). This data includes your User Data, Usage Data and other data listed in [Section 3 ‘Personal data we collect about you](#_djeb6mmnhu1p)’<br>*   for any other deletion requests, you can [contact us](#_l8q1yc21jzme) |"
	},
	{
		"lineId": "L0091",
		"text": "| **Opt-out of tailored advertising** | **Request to opt out of the processing of your personal data for tailored advertising.**<br><br>For more information about our processing for these purposes, see the section ‘[Tailored advertising controls](#5zquyasu4whw)’ below. | You can exercise your right to opt out through the ‘[Tailored Ads](https://www.spotify.com/account/privacy/)’ setting.<br><br>If you do not have an account or are not logged in, you can also opt-out by clicking the ['Your Privacy Choices'](https://www.spotify.com/us/legal/privacy-policy/#optanon-toggle-info-display) link at the footer of our website. |"
	},
	{
		"lineId": "L0092",
		"text": "| **Data portability** | **Request a copy of your personal data in electronic format and the right to transmit that personal data for use in another party’s service.** | For information about how to exercise the right to portability, see ‘Know/Access’ above. |"
	},
	{
		"lineId": "L0093",
		"text": "| **Not be subject to automated decision making** | **Not be subject to a decision based solely on automated decision making (decisions without human involvement), including profiling, where the decision would have a legal effect on you or produce a similarly significant effect.** | Spotify does not carry out this type of automated decision making in the Spotify Service. |"
	},
	{
		"lineId": "L0094",
		"text": "| **Withdrawal of consent** | **Withdraw your consent to us collecting or using your personal data.**<br><br>You can do this if Spotify is processing your personal data solely based on your consent. | To withdraw your consent, you can:<br><br>• adjust the relevant control on Spotify<br><br>• [contact us](#_l8q1yc21jzme) |"
	},
	{
		"lineId": "L0098",
		"text": "To verify a request to know, request to delete, and request to correct, we ask you to provide certain details related to your Spotify account. Please note, if you do not have a Spotify account we will not have enough information about you to verify your identity and respond to your requests, as we do not keep sufficient information necessary to re-identify and link you to a prior visit to the Spotify Service where data may have been collected. As such, we will be unable to verify and honor your requests."
	},
	{
		"lineId": "L0114",
		"text": "What is tailored advertising?"
	},
	{
		"lineId": "L0116",
		"text": "*   This is when we use information about you to personalize ads to be more relevant. This is also known as interest based advertising, targeted advertising, or what some states may define as, ‘sharing or selling’ for purposes of cross-context behavioural advertising."
	},
	{
		"lineId": "L0117",
		"text": "*   An example of tailored advertising is when an advertising partner provides us with information about topics you may be interested in, such as suggesting you might enjoy cooking. This could enable us to show you ads about blenders."
	},
	{
		"lineId": "L0121",
		"text": "*   You can control tailored advertising through the ‘[Tailored Ads](https://www.spotify.com/account/privacy/)’ setting."
	},
	{
		"lineId": "L0122",
		"text": "*   If you do not have an account or are not logged in, you can also opt-out by clicking the ['Your Privacy Choices'](https://www.spotify.com/us/legal/privacy-policy/#optanon-toggle-info-display) link at the footer of our website."
	},
	{
		"lineId": "L0123",
		"text": "*   You can also control tailored advertising for some podcasts using the link in the episode’s show description. This applies where the content provider inserts advertising into the podcast to fund it. The hosting provider, which might not be Spotify, manages these controls for the podcast."
	},
	{
		"lineId": "L0124",
		"text": "*   You can also visit our services via a browser with a recognized opt-out preference signal enabled, such as the Global Privacy Control (GPC). If you use a preference signal you may need to renew your preferences if you visit the Spotify Service with another device or browser, or if you clear your cookies."
	},
	{
		"lineId": "L0126",
		"text": "If you are ‘opted out’ of tailored advertising, you will receive less relevant advertising, including on our free Service Option, as well as our paid Service Option, as applicable (for example, advertising in podcasts). This type of advertising is based on your registration information and information about your real-time usage of Spotify, such as what you are currently listening to on our services. For example, if you are listening to a cooking podcast, you may hear an ad for a food processor."
	},
	{
		"lineId": "L0128",
		"text": "Appropriate age for tailored advertising:"
	},
	{
		"lineId": "L0130",
		"text": "*   Younger users may have tailored advertising turned off by default. When you reach the appropriate age, you will start to receive tailored advertising. When this happens, you will receive a message within the Spotify Service to let you know. This message will contain a link to the [Tailored Ads](https://www.spotify.com/account/privacy/) setting where you can change your preferences or ‘opt-out’ of tailored advertising at any time."
	},
	{
		"lineId": "L0137",
		"text": "| **Collected when you sign up for the Spotify Service or when you update your account** |     |"
	},
	{
		"lineId": "L0140",
		"text": "| User Data | Personal data that we need to create your Spotify account and that enables you to use the Spotify Service.<br><br>The type of data collected and used depends on the type of Service Option you have. It also depends on how you create your account, the country you are in, and if you use third party services to sign in. This may include your:<br><br>*   display name<br>*   email address<br>*   password<br>*   phone number<br>*   date of birth<br>*   gender<br>*   street address (see further details below)<br>*   country<br>*   university/college (for Spotify Premium Student)<br>*   estimated or confirmed age from an Age Check by a third party provider<br><br>We receive some of this data from you e.g. from the sign up form or account page.<br><br>We also collect some of this data from your device e.g. country or region. For more information about how we collect and use this data, see ‘[Your general (non-precise) location](#s18mup79oxiq)’ in the Usage Data category. |"
	},
	{
		"lineId": "L0141",
		"text": "| Street Address Data | We may ask for and process your street address for the following reasons:<br><br>*   to check eligibility for a Service Option<br>*   to deliver notices which are required by law<br>*   to deliver support options<br>*   for billing and tax administration<br>*   to deliver physical goods or gifts which you have purchased or requested<br><br>In some cases, we may use a third party application to help you verify your address, such as Google Maps. |"
	},
	{
		"lineId": "L0145",
		"text": "| **Categories** | **Description** |"
	},
	{
		"lineId": "L0146",
		"text": "| Usage Data | Personal data collected and processed about you when you’re accessing or using the Spotify Service.<br><br>This includes information such as:<br><br>**Information about how you use Spotify**<br><br>Examples:<br><br>*   information about your Spotify Service Option<br>*   your actions with the Spotify Service (including date and time), such as:<br>    *   search queries<br>    *   streaming history<br>    *   playlists you create<br>    *   your library<br>    *   browsing history<br>    *   account settings<br>    *   interactions with other Spotify users<br>    *   prompts in AI powered features<br>    *   transcripts<br>    *   engagement with ads<br>    *   your use of third party services, devices and applications in connection with the Spotify Service<br>*   inferences (i.e., our understanding) of your age, interests and preferences based on your usage of the Spotify Service<br>*   content you provide when participating in Spotify promotions, such as contests or sweepstakes<br>*   content you post to any part of the Spotify Service. For example: images, audio, text, titles, descriptions, communications, and other types of content<br><br>**Your technical data**<br><br>Examples include:<br><br>*   URL information<br>*   online identifiers such as [cookie data](https://www.spotify.com/legal/cookies-policy/) and IP addresses<br>*   information about the devices you use such as:<br>    *   device IDs<br>    *   network connection type (e.g. wifi, 4G, LTE, Bluetooth)<br>    *   provider<br>    *   network and device performance<br>    *   browser type<br>    *   language<br>    *   information enabling digital rights management<br>    *   operating system<br>    *   Spotify application version<br>*   information which enables us to discover and connect with third party devices and applications. Examples of this information are the device name, device identifiers, brand and version. Examples of third party devices and applications are:<br>    *   devices on your wifi network (such as speakers) which can connect to the Spotify Service<br>    *   devices your operating system makes available when connecting via Bluetooth, plugin, and installation<br>    *   Spotify partner applications to determine whether the application is installed on your device<br><br>**Your general (non-precise) location**<br><br>Your general location includes country, region, state or city. We may learn this from technical data (e.g. your IP address, language setting of your device) or payment currency.<br><br>We need this to:<br><br>*   meet geographic requirements in our agreements with the owners of content on the Spotify Service<br>*   deliver content, advertising and recommendations that are relevant to you<br><br>**Your device sensor data**<br><br>Motion-generated or orientation-generated device sensor data if needed to provide features of the Spotify Service that require this data. This is data which your device collects about the way you move or hold your device. |"
	},
	{
		"lineId": "L0151",
		"text": "| Voice Data | If voice features are available in your market and you’ve chosen to use a voice feature, we collect and process voice data. Voice data means audio recordings of your voice. |"
	},
	{
		"lineId": "L0152",
		"text": "| Message Data | If messaging is available in your market and where you’ve chosen to use messaging, we collect and process message data. Message data means text or other content you send directly to another user. |"
	},
	{
		"lineId": "L0153",
		"text": "| Age Check Data | Age Check Data is the data you provide if you (i) choose to use a feature that is subject to an Age Check or (ii) are a parent or legal guardian providing parental consent for a Managed Account (“Age Check”). Examples of Age Check methods we use, which are powered by a third party provider, are:<br><br>*   identity document verification: a photo of your identity document is used to confirm your age. In some cases, we may also use a photo of your face to verify that your ID belongs to you<br>*   facial age estimation: a photo of your face which is used to estimate your age<br><br>All Age Check Data is deleted immediately after the Age Check. |"
	},
	{
		"lineId": "L0154",
		"text": "| Payment and Purchase Data | If you make any purchases from Spotify or sign up for certain Service Options or a trial, we will need to process your payment data.<br><br>The exact personal data collected and used will vary depending on the payment method. It will include information such as:<br><br>*   name<br>*   date of birth<br>*   payment method type (e.g. credit or debit card)<br>*   if using a debit or credit card, the card type, expiry date and certain digits of your card number. Note: For security, Spotify never stores your full card number<br>*   ZIP/postal code<br>*   mobile phone number<br>*   details of your purchase and payment history |"
	},
	{
		"lineId": "L0155",
		"text": "| Precise Location Data | Spotify will only use your precise location data with your permission. You can grant this access through the in-app pop-up and in your device settings. This information allows Spotify to offer a number of features such as better recommendations for nearby concerts and events. |"
	},
	{
		"lineId": "L0156",
		"text": "| Survey and Research Data | When you respond to a survey or take part in user research, we collect and use the personal data you provide as described in the survey or research. |"
	},
	{
		"lineId": "L0157",
		"text": "| Customer Service Data | Information about your contacts with our Customer Service, such as chat conversations and email correspondence. |"
	},
	{
		"lineId": "L0159",
		"text": "We receive some of the data mentioned above from third parties. The below table describes the categories of those third parties."
	},
	{
		"lineId": "L0164",
		"text": "| Authentication partners | If you register for or log into the Spotify Service using another service, that service will send your information to us. This information helps create your account with us. | User Data |"
	},
	{
		"lineId": "L0165",
		"text": "| Third party applications, services and devices you connect to your Spotify account | If you connect your Spotify account to a third party application, service or device, we may collect and use information from them. This collection is to make the integration possible.<br><br>These third party apps, services or devices may include:<br><br>*   social media<br>*   devices including:<br>    *   audio (e.g. speakers and headphones)<br>    *   wearables (e.g., smart watches)<br>    *   televisions<br>    *   mobile phones and tablets<br>    *   automotive (e.g. cars)<br>    *   games consoles<br>*   services or platforms such as voice assistants or content platforms<br><br>We’ll ask your permission before we collect your information from certain third parties. | User Data<br><br>Usage Data |"
	},
	{
		"lineId": "L0166",
		"text": "| Technical service partners | We work with technical service partners that give us certain data. This includes mapping IP addresses to non-precise location data (e.g., country or region, city, state).<br><br>This makes it possible for Spotify to provide the Spotify Service, content, and features.<br><br>We also work with technical service partners who help us protect user accounts. | User Data<br><br>Usage Data |"
	},
	{
		"lineId": "L0167",
		"text": "| Payment partners and Merchants | If you choose to pay through third parties or by invoice, we may get data from our payment partners.<br><br>This allows us to:<br><br>*   send you invoices<br>*   process your payment<br>*   give you what you’ve purchased<br><br>If we direct you to a merchant, we receive data from the merchant that is related to your purchase. For example, we might direct you to an artist’s merchandise store on a third party platform or to a third party ticketing website.<br><br>Receiving this data allows us to:<br><br>*   calculate any commissions owed to us<br>*   analyze the effectiveness of our partnership with these merchant partners<br>*   understand your interests | Payment and Purchase Data |"
	},
	{
		"lineId": "L0168",
		"text": "| Advertising and marketing partners | We receive data about you from certain advertising or marketing partners, including device identifiers such as hashed contact information. They also provide us with inferences, which are the partners’ understanding of your interests and preferences.<br><br>This allows us to deliver more relevant ads and marketing and measure their performance. | Usage Data |"
	},
	{
		"lineId": "L0169",
		"text": "| Acquired companies | We may receive data about you from companies we acquire. This is to enhance our services, products, and offerings. | User Data<br><br>Usage Data |"
	},
	{
		"lineId": "L0171",
		"text": "If you download the Spotify mobile app and try Spotify using a logged out user experience, we will collect limited information about your usage of the Spotify Service, including Usage Data. We do this to understand how you are accessing and using the Service. We also do this to ensure we provide the right experience for you, for example based on your country or region. If you decide to create a Spotify account to experience our service in full, then we will combine this data with your Spotify account data."
	},
	{
		"lineId": "L0183",
		"text": "| **Purpose for processing your data** | **Categories of personal data used for the purpose** |"
	},
	{
		"lineId": "L0185",
		"text": "| To provide the Spotify Service.<br><br>For example, when we use your personal data to:<br><br>*   set up an account for you<br>*   personalize your account including your content recommendations, or<br>*   provide the Spotify app when you download it onto your device,<br>*   enable you to share a link to Spotify content with someone else, or<br>*   provide an age-appropriate experience, or<br>*   provide various optional features of the Spotify Service | *   User Data<br>*   Street Address Data<br>*   Usage Data<br>*   Voice Data<br>*   Message Data<br>*   Payment and Purchase Data<br>*   Survey and Research Data<br>*   Age Check Data |"
	},
	{
		"lineId": "L0186",
		"text": "| To improve our personalized recommendations and to improve the Spotify experience for all users, based on precise location data (where available and explicitly permitted by you).<br><br>For example, we can provide better personalized concert and event recommendations or let you know what is trending at your specific location. What we learn from your streaming at one location, could be used to suggest similar content to other users close to that location. | *   Precise Location Data |"
	},
	{
		"lineId": "L0187",
		"text": "| To diagnose, troubleshoot, and fix issues with the Spotify Service. | *   User Data<br>*   Usage Data<br>*   Voice Data<br>*   Message Data<br>*   Customer Service Data |"
	},
	{
		"lineId": "L0188",
		"text": "| To evaluate and develop new features, technologies, and improvements to the Spotify Service. This includes development and training of algorithmic and machine learning models, which help us to keep our service safe and enhance our users’ experience. For example:<br><br>For example:<br><br>*   to help us develop and improve our personalized recommendations<br>*   to help analyze how our users react to a particular new feature and see whether we should make any changes<br>*   so we can build AI features such as AI DJ and AI playlist<br>*   to help us enforce our [User Guidelines](https://www.spotify.com/legal/user-guidelines/), [Platform Rules](https://www.spotify.com/safetyandprivacy/platform-rules) and [Spotify for Creators Community Guidelines](https://support.spotify.com/creators/article/spotify-for-creators-community-guidelines/). | *   User Data<br>*   Usage Data<br>*   Voice Data<br>*   Survey and Research Data<br>*   Customer Service Data |"
	},
	{
		"lineId": "L0189",
		"text": "| For marketing or advertising purposes.<br><br>For example:<br><br>*   when we use your personal data to tailor advertising to your interests, or<br>*   when we send you email marketing | *   User Data<br>*   Usage Data<br>*   Survey and Research Data |"
	},
	{
		"lineId": "L0190",
		"text": "| To comply with a legal obligation that we are subject to.<br><br>This might be:<br><br>*   an obligation under the law of the country/region you are in<br>*   Swedish law (because of our headquarters in Sweden), or<br>*   EU law that applies to us<br><br>For example, when we use your date of birth when required for age assurance purposes. | *   User Data<br>*   Street Address Data<br>*   Usage Data<br>*   Voice Data<br>*   Message Data<br>*   Payment and Purchase Data<br>*   Survey and Research Data<br>*   Precise Location Data<br>*   Customer Service Data |"
	},
	{
		"lineId": "L0191",
		"text": "| To fulfill contractual obligations with third parties.<br><br>  <br><br>For example, when we provide pseudonymized data about our users’ listening because we have an agreement with a Spotify rightsholder to do so.<br><br>  <br><br>Pseudonymized data means that your data is identified by a code rather than your name or other directly identifying information. | *   User Data<br>*   Usage Data<br>*   Voice Data<br>*   Payment and Purchase Data |"
	},
	{
		"lineId": "L0193",
		"text": "| To establish, exercise, or defend legal claims.<br><br>  <br><br>For example, if we are involved in litigation, we need to provide information to our lawyers in relation to that legal case. | *   User Data<br>*   Street Address Data<br>*   Usage Data<br>*   Voice Data<br>*   Message Data<br>*   Payment and Purchase Data<br>*   Survey and Research Data<br>*   Customer Service Data |"
	},
	{
		"lineId": "L0194",
		"text": "| To conduct business planning, reporting, and forecasting.<br><br>  <br><br>For example, when we look at aggregated user data like the number of new sign ups in a country in order to plan new locations to launch our products and features in. | *   User Data<br>*   Usage Data<br>*   Payment and Purchase Data |"
	},
	{
		"lineId": "L0195",
		"text": "| To process your payment.<br><br>  <br><br>For example, when we use your personal data to let you purchase a Spotify subscription. | *   User Data<br>*   Payment and Purchase Data<br>*   Street Address Data |"
	},
	{
		"lineId": "L0196",
		"text": "| To keep the Spotify Service secure and to detect and prevent fraud.<br><br>  <br><br>For example, when we analyze Usage Data to check for fraudulent use of the Spotify Service. | *   User Data<br>*   Street Address Data<br>*   Message Data<br>*   Usage Data<br>*   Payment and Purchase Data<br>*   Customer Service Data |"
	},
	{
		"lineId": "L0197",
		"text": "| To conduct research and surveys.<br><br>  <br><br>For example, when we contact our users to ask for your feedback. | *   User Data<br>*   Usage Data<br>*   Voice Data<br>*   Survey and Research Data |"
	},
	{
		"lineId": "L0204",
		"text": "**Information available to other Spotify users**"
	},
	{
		"lineId": "L0206",
		"text": "The following personal data is available to other Spotify users:"
	},
	{
		"lineId": "L0208",
		"text": "*   your profile name"
	},
	{
		"lineId": "L0209",
		"text": "*   your profile photo, if you choose to upload one"
	},
	{
		"lineId": "L0210",
		"text": "*   your public playlists, and any associated titles, descriptions and images"
	},
	{
		"lineId": "L0211",
		"text": "*   other content you post on the Spotify Service, and any associated titles, descriptions and images"
	},
	{
		"lineId": "L0212",
		"text": "*   the number of people who you follow and the number of people who follow you on the Spotify Service (the profiles of those people may be visible depending on your settings)"
	},
	{
		"lineId": "L0214",
		"text": "You or another user can share certain information on third party services, like social media or messaging platforms. This includes:"
	},
	{
		"lineId": "L0216",
		"text": "*   your profile"
	},
	{
		"lineId": "L0217",
		"text": "*   any content you post on Spotify and details about that content"
	},
	{
		"lineId": "L0218",
		"text": "*   your playlists and any associated titles, descriptions and images"
	},
	{
		"lineId": "L0220",
		"text": "When this sharing occurs, the third party service may store a copy of it to support their features."
	},
	{
		"lineId": "L0222",
		"text": "**Personal data you may choose to disclose**"
	},
	{
		"lineId": "L0224",
		"text": "We will only disclose the following personal data with those outlined in the table below"
	},
	{
		"lineId": "L0226",
		"text": "*   where you have chosen to use a Spotify Service feature, or a third party application, service or device, and we need to disclose personal data to enable this, or"
	},
	{
		"lineId": "L0227",
		"text": "*   if you otherwise grant us your permission to disclose the personal data. For example, you can do it by selecting the appropriate setting in the Spotify Service or by giving your consent."
	},
	{
		"lineId": "L0231",
		"text": "| Third party applications, services and devices you connect to your Spotify account | *   User Data<br>*   Usage Data | To connect your Spotify account, or so that you can use the Spotify Service in connection with third party applications, services or devices.<br><br>Examples of such third party applications, services and devices include:<br><br>*   social media applications<br>*   speaker devices<br>*   televisions<br>*   automotive platforms<br>*   voice assistants<br><br>You can see and remove many third party connections under ‘[Apps](https://www.spotify.com/account/apps/)’ in your account. |"
	},
	{
		"lineId": "L0232",
		"text": "| Support community | *   User Data | To enable you to use the [Spotify Support Community service](https://community.spotify.com/).<br><br>When you register for an account on the Spotify Support Community, we’ll ask you to create a profile name. This will be publicly displayed to anyone who uses the Spotify Support Community. We’ll also display any questions or comments you post. |"
	},
	{
		"lineId": "L0233",
		"text": "| Other Spotify users | *   User Data<br>*   Usage Data<br>*   Message Data | To share information about your use of the Spotify Service with other Spotify users. These could include your followers on Spotify.<br><br>For example, under ‘Social’ settings you can choose to share your recently played artists and your playlists on your profile. You can also choose to create or join a shared playlist with other users. Shared playlists give you social recommendations based on your listening activity. |"
	},
	{
		"lineId": "L0234",
		"text": "| Artists and record labels | *   User Data | To receive news or promotional offers from artists, record labels or other partners.<br><br>You may choose to share your User Data for this purpose when you sign up to the Spotify Service. You’ll always have the option to change your mind and [withdraw your consent at any time](https://www.spotify.com/account/profile/). |"
	},
	{
		"lineId": "L0240",
		"text": "| **Categories of recipients** | **Categories of data** | **Reason for disclosing** |"
	},
	{
		"lineId": "L0242",
		"text": "| Service providers | *   User Data<br>*   Street Address Data<br>*   Usage Data<br>*   Voice Data<br>*   Message Data<br>*   Payment and Purchase Data<br>*   Survey and Research Data<br>*   Age Check Data | So they can provide their services to Spotify.<br><br>Examples of such service providers include those we hire to:<br><br>*   give customer support<br>*   operate the technical infrastructure we need to provide the Spotify Service<br>*   assist in protecting and securing our systems and services (e.g. Google’s reCAPTCHA)<br>*   help market Spotify’s (and our partners’) products, services, events and promotions<br>*   verify your eligibility for certain types of Service Options (e.g., Spotify Premium Student) |"
	},
	{
		"lineId": "L0243",
		"text": "| Payment partners | *   User Data<br>*   Payment and Purchase Data | So they can process your payments, and for anti-fraud purposes. |"
	},
	{
		"lineId": "L0244",
		"text": "| Advertising partners | *   User Data<br>*   Usage Data | So Spotify and our advertising partners can deliver more relevant advertising to you on the Spotify Service and online, and help measure the effectiveness of ads.<br><br>We do not disclose personal data to advertising partners for users under the age of 18. |"
	},
	{
		"lineId": "L0245",
		"text": "| Marketing Partners | *   User Data<br>*   Usage Data | To promote Spotify with our partners. We disclose certain User Data and Usage Data to these partners where necessary to:<br><br>*   enable you to participate in Spotify promotions, including trials or other bundled offers<br>*   to promote Spotify in media and advertising published on other online services<br>*   help us and our partners to measure the effectiveness of Spotify promotions<br><br>Examples of partners include:<br><br>*   marketing or sponsorship partners<br>*   websites and mobile apps who sell us advertising space on their services<br>*   device, app and mobile partners who also offer Spotify promotions<br><br>Our partners may also combine the personal data we disclose to them with other data they collect about you, e.g. your use of their services. We and our partners may use this information to present you with offers, promotions, or other marketing that we think you’ll find relevant.<br><br>With respect to Spotify Service users under the age of 18, we do not disclose personal data to marketing partners by default. |"
	},
	{
		"lineId": "L0246",
		"text": "| Ticketing and event partners | *   User Data | For every event for which we sell tickets, we will need to disclose your name, email or other order details to our event partners such as ticketing agent or venue box office where the event is taking place so that you can check-in as a verifiable guest who purchased tickets through Spotify’s ticketing platform. |"
	},
	{
		"lineId": "L0247",
		"text": "| Podcast Hosting Platforms | *   Usage Data | Hosting platforms host podcasts so that they can deliver them to you. We disclose certain data, such as your IP address, to the podcast hosting platforms when you play a podcast. We also allow you to stream podcasts available from other hosting platforms not owned by Spotify.<br><br>Podcast providers should explain in the show or episode description which platform is hosting the podcast. See the hosting platform’s own privacy policy for how they use data disclosed to them. |"
	},
	{
		"lineId": "L0248",
		"text": "| Academic researchers | *   User Data<br>*   Usage Data | For activities such as statistical analysis and academic study, but only in a pseudonymized format. |"
	},
	{
		"lineId": "L0249",
		"text": "| Other Spotify group companies, including companies that Spotify acquires | *   User Data<br>*   Street Address Data<br>*   Usage Data<br>*   Voice Data<br>*   Message Data<br>*   Payment and Purchase Data<br>*   Survey and Research Data | To carry out our daily business operations and so we can maintain, improve and provide the Spotify Service and acquired companies’ services to you.<br><br>For example:<br><br>*   enabling our employees who work for different group companies to develop and improve features for the Spotify Service<br>*   disclosing data to our measurement companies to measure the effectiveness of ad campaigns that run on the Spotify Service<br>*   disclosing data to our podcast companies to better understand user listening trends |"
	},
	{
		"lineId": "L0250",
		"text": "| Purchasers of our business | *   User Data<br>*   Street Address Data<br>*   Usage Data<br>*   Voice Data<br>*   Message Data<br>*   Message Data<br>*   Payment and Purchase Data<br>*   Survey and Research Data | If we were to sell or negotiate to sell any part of our business to a buyer or possible buyer.<br><br>  <br><br>In this case, we may transfer your personal data to a successor or affiliate as part of that transaction. |"
	},
	{
		"lineId": "L0252",
		"text": "**Courts and Authorities:** We may process and share your personal data to comply with a request from courts, authorities, parties to litigation, or other authorized third parties. We will do so when we believe in good faith it is necessary, including:"
	},
	{
		"lineId": "L0254",
		"text": "*   to comply with a legal obligation"
	},
	{
		"lineId": "L0255",
		"text": "*   to respond to a valid legal process (such as a search warrant, court order, or subpoena)"
	},
	{
		"lineId": "L0256",
		"text": "*   for our own or a third party's justifiable interest such as criminal investigations, litigation, protecting someone’s safety, or preventing death or imminent bodily harm"
	},
	{
		"lineId": "L0258",
		"text": "The categories of personal data processed or shared will depend on the nature of the specific request."
	},
	{
		"lineId": "L0263",
		"text": "We keep your personal data only as long as necessary to provide you with the Spotify Service and for Spotify’s legitimate and essential business purposes, such as:"
	},
	{
		"lineId": "L0265",
		"text": "*   maintaining the performance of the Spotify Service"
	},
	{
		"lineId": "L0266",
		"text": "*   making data-driven business decisions about new features and offerings"
	},
	{
		"lineId": "L0267",
		"text": "*   complying with our legal obligations"
	},
	{
		"lineId": "L0268",
		"text": "*   resolving disputes"
	},
	{
		"lineId": "L0272",
		"text": "*   **Data retained until you remove it**"
	},
	{
		"lineId": "L0276",
		"text": "You can also delete certain personal data directly from the Spotify Service: for example, you can edit or delete your profile picture. Where users are able to see and update the personal data themselves, we keep the information for as long as the user chooses unless one of the limited purposes described below applies."
	},
	{
		"lineId": "L0280",
		"text": "Subject to other applicable retention rules listed in this Section 6, we have set certain retention periods so that data expires after a specific period of time. For example, personal data you may input as part of search queries is deleted after 90 days."
	},
	{
		"lineId": "L0282",
		"text": "*   **Data retained until your Spotify account is deleted**"
	},
	{
		"lineId": "L0284",
		"text": "We keep some data until your Spotify account is deleted. Examples of this include your Spotify username and profile information. We also keep streaming history for the life of an account, for example, to provide retrospective playlists that users enjoy and personalized recommendations that take listening habits into account (for example, Your Time Capsule or Your Summer Rewind). When your Spotify account is deleted, this category of data is deleted or de-identified."
	},
	{
		"lineId": "L0286",
		"text": "*   **Data retained for extended time periods for limited purposes**"
	},
	{
		"lineId": "L0288",
		"text": "After your account is deleted, we keep some data for a longer time period but for very limited purposes. For example, we may be subject to legal or contractual obligations that require this. These may include mandatory data retention laws, government orders to preserve data relevant to an investigation, or data kept for the purposes of litigation. We may also keep data that has been removed from the Spotify Service for a limited period of time. This could be:"
	},
	{
		"lineId": "L0290",
		"text": "*   to help ensure user safety, or"
	},
	{
		"lineId": "L0291",
		"text": "*   to protect against harmful content on our platform."
	},
	{
		"lineId": "L0292",
		"text": "*   **Age Check Data** is deleted immediately after your Age Check is complete."
	},
	{
		"lineId": "L0297",
		"text": "Because of the global nature of our business, Spotify transfers personal data internationally with Spotify group companies, subcontractors and partners when carrying out the activities described in this Policy."
	},
	{
		"lineId": "L0299",
		"text": "Whenever we transfer personal data internationally, we use tools to make sure the data transfer complies with applicable law."
	},
	{
		"lineId": "L0301",
		"text": "We also identify and use additional protections as appropriate for each data transfer. For example, we use:"
	},
	{
		"lineId": "L0303",
		"text": "*   technical protections, such as encryption and pseudonymization"
	},
	{
		"lineId": "L0304",
		"text": "*   policies and processes to challenge disproportionate or unlawful government authority requests"
	},
	{
		"lineId": "L0309",
		"text": "We’re committed to protecting our users’ personal data. We put in place appropriate technical and organizational measures to help protect the security of your personal data. However, be aware that no system is ever completely secure."
	},
	{
		"lineId": "L0311",
		"text": "We have put various safeguards in place to guard against unauthorized access and unnecessary retention of personal data in our systems. These include pseudonymization, encryption, access, and retention policies."
	},
	{
		"lineId": "L0327",
		"text": "9\\. Children"
	},
	{
		"lineId": "L0330",
		"text": "Note: This Policy doesn't apply to [Managed Accounts](https://www.spotify.com/legal/managed-account-plan-manager-privacy-policy/) or [Spotify Kids](https://www.spotify.com/legal/kids-privacy-policy/) except where those respective privacy notices say so."
	},
	{
		"lineId": "L0332",
		"text": "The Spotify Service (outside of Managed Accounts or Spotify Kids) that is tied to this privacy policy has a minimum age limit in each country or region (the “Age Limit”)."
	},
	{
		"lineId": "L0334",
		"text": "If you’re under the Age Limit, do not create or use the standard Spotify Service. Instead, we recommend asking a parent or guardian to create a Managed Account for you, where available. If you are above the Age Limit but under the age of majority in your country (a “Minor”), you may use the Spotify Service only with the consent of your parent or legal guardian."
	},
	{
		"lineId": "L0336",
		"text": "We do not knowingly collect or use personal data from children under the applicable Age Limit outside of Managed Accounts or Spotify Kids. If you are a parent or guardian and become aware that your child, who is under the application Age Limit, has provided personal data to Spotify in any other context, [contact us](#_l8q1yc21jzme). If we learn that we’ve collected the personal data of a child under the applicable Age Limit, we’ll take reasonable steps to delete the personal data. This may require us to delete the Spotify account for that child."
	},
	{
		"lineId": "L0340",
		"text": "10\\. Third-Party Links"
	},
	{
		"lineId": "L0343",
		"text": "The Spotify Service may include links to third-party websites, plug-ins and applications. Clicking on such links may allow third parties to collect or share data about you. Spotify does not control these third-party websites and is not responsible for their privacy practices."
	}
]
```

### 2. Complete Facebook Privacy Policy (`facebook-full-privacy-policy`)

Source: [Facebook Privacy Policy](https://github.com/OpenTermsArchive/pga-versions/blob/53fdfebe3c470bb1433e830394e86fd699f485e7/Facebook/Privacy%20Policy.md), pinned at `53fdfebe3c470bb1433e830394e86fd699f485e7`.

Input: [full-policy-cases.json](../fixtures/full-policy-cases.json), case `facebook-full-privacy-policy`, `policyText` (290,126 UTF-8 bytes; blob SHA `5895929f58bb8fcc3d21dbf2ce1a9d34d8324282`). Each nonempty source line received its one-based `L####` prefix before being sent.

**Actual Luna output**

```json
{
	"summary": "The policy describes extensive collection and use of account, activity, device, location, partner, and transaction information; sharing with other users, business partners, service providers, researchers, Meta Companies, and authorities; and conditional controls and limits for some practices.",
	"findings": [
		{
			"practice": "account_and_activity_collection",
			"dataCategories": [
				"Account and profile details",
				"Posts, photos, videos, audio, messages and content metadata",
				"Views, interactions, feature use, purchases, hashtags and activity timing"
			],
			"purposes": ["Provide Meta Products"],
			"recipients": ["Meta"],
			"summary": "Meta collects information provided during sign-up and use of its Products, including account details, content, messages, interactions and transaction information.",
			"sourceLineIds": ["L0045", "L0046", "L0058", "L0060", "L0069"],
			"qualifications": [
				{
					"summary": "The information collected depends on how a person uses the Products; some information may also be collected from people without accounts.",
					"sourceLineIds": ["L0051"]
				},
				{
					"summary": "Collection of message content and metadata is subject to applicable law, and some Products offer end-to-end encrypted messaging.",
					"sourceLineIds": ["L0062", "L0063"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "special_category_information",
			"dataCategories": [
				"Religious, sexual-orientation, political, health, racial or ethnic, philosophical and trade-union information"
			],
			"purposes": [
				"Share with people the user chooses",
				"Provide, personalize and improve Products",
				"Analytics"
			],
			"recipients": ["Meta", "People the user chooses"],
			"summary": "Meta may process specially protected information that a person chooses to provide, including to share it with people they select and to provide, personalize and improve Products and conduct analytics.",
			"sourceLineIds": ["L0078", "L1856", "L1862"],
			"qualifications": [
				{
					"summary": "The policy says this information is not used to show ads.",
					"sourceLineIds": ["L0492"]
				},
				{
					"summary": "The detailed consent description specifies explicit consent for the listed specially protected information.",
					"sourceLineIds": ["L1856", "L1862"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "connections_and_contacts",
			"dataCategories": [
				"Friends, followers, groups, accounts, Pages and other connections",
				"Contacts' names, email addresses and phone numbers"
			],
			"purposes": ["Understand interactions and connections", "Suggest friends or groups"],
			"recipients": ["Meta"],
			"summary": "Meta collects information about a person's connections and how they interact, and may collect contact details for other people when a user uploads or imports contacts.",
			"sourceLineIds": ["L0086", "L0091", "L0100", "L0104", "L0105"],
			"qualifications": [
				{
					"summary": "Contact collection occurs if the user chooses to upload or import contacts; information about non-users may still be collected through another user's upload.",
					"sourceLineIds": ["L0091", "L0093"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "device_and_network_collection",
			"dataCategories": [
				"Device and software characteristics",
				"Device identifiers and signals",
				"Device activity",
				"Network and connection details, including IP address",
				"Product performance and diagnostic information"
			],
			"purposes": [
				"Operate and improve Products",
				"Troubleshoot errors",
				"Estimate general location",
				"Detect bots"
			],
			"recipients": ["Meta"],
			"summary": "Meta collects information from and about devices and networks used with its Products, including identifiers, device activity, connection details and product diagnostics.",
			"sourceLineIds": ["L0110", "L0114", "L0115", "L0116", "L0119", "L0382"],
			"qualifications": [
				{
					"summary": "Some location-related information, including an estimate based on IP address, may be collected even when device Location Services is off.",
					"sourceLineIds": ["L0120"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "device_permission_data",
			"dataCategories": [
				"GPS location",
				"Camera access",
				"Photos and videos",
				"Photo and video metadata"
			],
			"purposes": [
				"Provide enabled features",
				"Apply camera effects",
				"Remind users about photos to upload"
			],
			"recipients": ["Meta"],
			"summary": "Meta collects information made available through device settings, such as location, camera or photo access, to provide related features; photo metadata may also be used for product functions.",
			"sourceLineIds": ["L0118", "L0233", "L0348", "L1971"],
			"qualifications": [
				{
					"summary": "Access to camera-roll metadata is described in the example as occurring when the user gives permission.",
					"sourceLineIds": ["L0348"]
				},
				{
					"summary": "Some face or body processing for filters, effects, masks and avatars is used to create the feature and is not used to identify the person.",
					"sourceLineIds": ["L0233"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "voice_feature_collection",
			"dataCategories": [
				"Voice interactions",
				"Background sound captured during a voice interaction"
			],
			"purposes": ["Provide the Assistant feature", "Improve the Assistant feature"],
			"recipients": ["Meta"],
			"summary": "Meta collects voice interactions with voice-enabled features, including background sound occurring during the interaction, to provide the feature and, depending on settings, improve it.",
			"sourceLineIds": ["L0238"],
			"qualifications": [
				{
					"summary": "Improvement depends on the user's settings.",
					"sourceLineIds": ["L0238"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "ai_interaction_collection",
			"dataCategories": [
				"Prompts and submitted media",
				"AI responses",
				"Feedback",
				"Information from connected third-party apps and services",
				"Personalization information"
			],
			"purposes": [
				"Provide and personalize AI features",
				"Perform actions requested through AI features"
			],
			"recipients": [
				"Meta",
				"Connected third-party apps and services",
				"AI integration partners in some cases"
			],
			"summary": "When people use AI at Meta features, Meta collects and uses prompts, media, responses, feedback, personalization information and information from services connected to those features.",
			"sourceLineIds": ["L0251", "L0253", "L0254", "L0255", "L0256", "L0257"],
			"qualifications": [
				{
					"summary": "Third-party app and service information is involved when the user chooses to connect those services.",
					"sourceLineIds": ["L0255", "L0258"]
				},
				{
					"summary": "Some AI responses may be provided with help from AI integrations.",
					"sourceLineIds": ["L0254"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "partner_and_offsite_data_collection",
			"dataCategories": [
				"Device information",
				"Websites visited and cookie data",
				"App and game use",
				"Off-platform purchases and transactions",
				"Ad views and interactions",
				"Use of partner services online or in person",
				"Email address, cookies and advertising device ID"
			],
			"purposes": [
				"Match activities to an account",
				"Provide and personalize content and ads",
				"Measurement and analytics"
			],
			"recipients": ["Meta"],
			"summary": "Meta receives information about activity on and off its Products from partners, measurement and marketing vendors, and other third parties, including web and app activity, transactions, ad interactions and identifiers.",
			"sourceLineIds": ["L0130", "L0134", "L0135", "L0138", "L0140", "L0142"],
			"qualifications": [
				{
					"summary": "Meta says it receives this information whether or not a person is logged in or has an account.",
					"sourceLineIds": ["L0144"]
				},
				{
					"summary": "Cookie settings can control use of certain partner information for providing and personalizing content and ads.",
					"sourceLineIds": ["L0142"]
				},
				{
					"summary": "Partners are required to have the right to collect, use and share information before providing it to Meta.",
					"sourceLineIds": ["L0158"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "non_account_collection",
			"dataCategories": [
				"Browser and app logs of visits to public content",
				"Basic device model and operating-system information",
				"Cookie and similar-technology information"
			],
			"purposes": ["Security", "Safety and integrity", "Measure and improve Product performance"],
			"recipients": ["Meta", "Law enforcement in specified safety circumstances"],
			"summary": "Meta collects or receives some information when people use or interact with its Products without an account, including visit logs, basic device information and cookie-related information.",
			"sourceLineIds": ["L0192", "L0194", "L0195", "L0197"],
			"qualifications": [
				{
					"summary": "The policy gives security, safety and performance as examples of reasons for collecting or receiving information from non-account users.",
					"sourceLineIds": ["L0204", "L0208", "L0212"]
				},
				{
					"summary": "Sharing with law enforcement is described for circumstances where Meta believes there is a genuine risk of death or imminent bodily harm.",
					"sourceLineIds": ["L0208"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "cookie_collection_and_use",
			"dataCategories": [
				"Cookie IDs and settings",
				"Identifiers stored on a device or browser",
				"Information collected through Social Plugins and Meta Pixel"
			],
			"purposes": [
				"Provide, protect and improve Products",
				"Personalize content",
				"Tailor and measure ads",
				"Provide a safer experience"
			],
			"recipients": ["Meta"],
			"summary": "Meta uses cookies and similar technologies, including the Meta Pixel and Social Plugins, and collects information from cookies stored on a person's device.",
			"sourceLineIds": ["L0387", "L0389"],
			"qualifications": [
				{
					"summary": "Cookie settings let people choose whether Meta can use cookies and similar technologies to collect activity on other websites and apps, including sites and apps using Business Tools.",
					"sourceLineIds": ["L0007"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "transaction_information",
			"dataCategories": [
				"Credit or debit card and other financial account information",
				"Billing, shipping and contact details",
				"Items purchased and quantities",
				"Account and authentication information"
			],
			"purposes": [
				"Facilitate transactions and payments",
				"Personalize Product experience",
				"Advertising",
				"Provide access to transaction history",
				"Enable faster payment experiences"
			],
			"recipients": ["Meta"],
			"summary": "When people use Meta Products for purchases, sales or financial transactions, Meta collects and stores transaction and payment information for payment facilitation and other listed purposes.",
			"sourceLineIds": ["L0284", "L0286", "L0287", "L0288", "L0289", "L0293"],
			"qualifications": [
				{
					"summary": "Storing information for faster payment experiences depends on the user's choices, and access to transaction history is available only where available.",
					"sourceLineIds": ["L0293"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "product_personalization_and_improvement",
			"dataCategories": [
				"Information collected about a person and their use of Products",
				"Interests and preferences",
				"Device crash and performance information"
			],
			"purposes": [
				"Provide and troubleshoot Products",
				"Personalize features, content and recommendations",
				"Develop, test and improve products and features"
			],
			"recipients": ["Meta"],
			"summary": "Meta uses collected information to operate, troubleshoot and improve its Products and to personalize features, content, recommendations and feeds.",
			"sourceLineIds": ["L0470", "L0471", "L0487", "L0489", "L0490", "L0519", "L0521"],
			"qualifications": [
				{
					"summary": "For some purposes, information may be used across accounts added to Accounts Center and across devices.",
					"sourceLineIds": ["L0478"]
				},
				{
					"summary": "Meta says it may de-identify, aggregate or anonymize information and use it in the same ways as other information described in that section.",
					"sourceLineIds": ["L0480"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "personalized_advertising",
			"dataCategories": [
				"Account and cross-account information",
				"Cookies",
				"Activity on Meta Products and other websites and apps",
				"Interests and preferences",
				"Location-related information"
			],
			"purposes": ["Select and personalize ads", "Measure ad performance"],
			"recipients": ["Meta", "Advertisers", "Audience Network publishers and their vendors"],
			"summary": "Where Meta shows ads, it uses information to personalize ads on and across Meta Products and through Audience Network, and to measure ad performance.",
			"sourceLineIds": ["L0499", "L0503", "L3317", "L3319", "L3320"],
			"qualifications": [
				{
					"summary": "Ad delivery and the information used for ads are subject to the person's settings and Ad preferences.",
					"sourceLineIds": ["L0499", "L1426", "L1427"]
				},
				{
					"summary": "Using partner-provided off-Product activity for personalized ads is described as requiring consent in the detailed legal-basis section.",
					"sourceLineIds": ["L1949"]
				},
				{
					"summary": "Meta says de-identified, aggregated or anonymized information may also be used to show ads.",
					"sourceLineIds": ["L0503"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "ai_feature_personalization",
			"dataCategories": [
				"Interests and preferences",
				"Activity and information provided",
				"Connections",
				"Device information",
				"Partner and third-party information",
				"Location-related information"
			],
			"purposes": ["Make AI responses and actions more relevant"],
			"recipients": ["Meta"],
			"summary": "Meta uses information it has, including interests, activity, connections, device information and partner information, to make responses and actions from AI at Meta features more relevant.",
			"sourceLineIds": ["L0529", "L0531", "L0532", "L0533", "L0534", "L0536", "L0538"],
			"qualifications": [
				{
					"summary": "The examples describe using recent user-provided interests, Product activity and location to tailor a response.",
					"sourceLineIds": ["L0536", "L0538"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "ai_development_and_improvement",
			"dataCategories": [
				"AI feature interactions and related metadata",
				"Public content",
				"Information from partners, vendors and third parties"
			],
			"purposes": [
				"Develop and improve AI technologies and models",
				"Improve model safety and accuracy",
				"Support AI research and product development"
			],
			"recipients": ["Meta", "Third parties, including developers and researchers"],
			"summary": "Meta uses AI feature interactions and, in some described circumstances, public content to develop or improve AI for Meta Products and third parties.",
			"sourceLineIds": ["L0436", "L2575", "L2587", "L2967", "L2979", "L2980"],
			"qualifications": [
				{
					"summary": "The detailed legal-basis sections distinguish registered users from people Meta cannot associate with a registered user; for the latter, the listed activity includes public content and AI feature interactions.",
					"sourceLineIds": ["L2963", "L2979", "L2986", "L3180", "L3181"]
				},
				{
					"summary": "The policy identifies safeguards such as improving model responses for safety and accuracy.",
					"sourceLineIds": ["L2579", "L2581"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "location_use",
			"dataCategories": [
				"GPS and other device signals",
				"IP address",
				"Check-ins and event activity",
				"User-provided city or address"
			],
			"purposes": [
				"Personalize and improve Products, including ads",
				"Provide location-related features",
				"Detect suspicious activity and secure accounts"
			],
			"recipients": ["Meta"],
			"summary": "Meta uses location-related information, including GPS when permitted and other information such as IP address, Product activity and user-provided location, for Product personalization and security.",
			"sourceLineIds": ["L0543", "L0545", "L0547", "L0548", "L0549", "L0551", "L0553", "L0554"],
			"qualifications": [
				{
					"summary": "GPS and certain device signals are used when Location Services is enabled and the user allows Meta to receive them.",
					"sourceLineIds": ["L0543"]
				},
				{
					"summary": "Some location-related information is received and used even when Location Services is off; IP addresses are used to estimate general location, and specific location may be estimated when necessary to protect safety and security.",
					"sourceLineIds": ["L0545", "L0547"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "safety_and_integrity_processing",
			"dataCategories": [
				"Content and messages",
				"Activity and interactions",
				"Device, network and location information",
				"Reports and account information"
			],
			"purposes": [
				"Verify accounts and activity",
				"Detect policy violations, suspicious activity, spam and harmful or unlawful behavior",
				"Protect users, personnel, property and Products",
				"Offer help where someone may need it"
			],
			"recipients": ["Meta reviewers", "Meta Companies", "Trusted service providers"],
			"summary": "Meta applies automated processing and, in some instances, human review to information associated with users to verify accounts and activity, investigate suspicious behavior, address violations and protect safety and Product integrity.",
			"sourceLineIds": ["L0592", "L0593", "L0594", "L0595", "L0596", "L2092", "L2094", "L2097"],
			"qualifications": [
				{
					"summary": "Some violation decisions may be reviewed by the Oversight Board.",
					"sourceLineIds": ["L0593", "L2095"]
				},
				{
					"summary": "Reviewers may be Meta employees, employees of Meta Companies or trusted service providers, and are required to meet privacy and security standards.",
					"sourceLineIds": ["L0710"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "manual_content_review",
			"dataCategories": ["Posts and other content", "Information associated with an account"],
			"purposes": [
				"Review and remove policy-violating content",
				"Offer support where someone may need help",
				"Train content-review algorithms"
			],
			"recipients": ["Meta reviewers", "Meta Companies", "Trusted service providers"],
			"summary": "Human reviewers may review content for safety and policy enforcement, offer support in some cases, and analyze content to train automated review systems.",
			"sourceLineIds": ["L0704", "L0705", "L0706", "L0710"],
			"qualifications": [
				{
					"summary": "Human review is described as supplementing automated detection, and access is limited to reviewers required to meet privacy and security standards.",
					"sourceLineIds": ["L0704", "L0710"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "communications",
			"dataCategories": [
				"Contact information",
				"Communications with Meta",
				"Product use information"
			],
			"purposes": [
				"Send Product, policy and research communications",
				"Send marketing communications",
				"Respond to inquiries and facilitate customer support"
			],
			"recipients": ["Meta", "Third parties facilitating customer support communications"],
			"summary": "Meta uses contact information and, in some cases, Product-use information to send notices, marketing messages and research invitations, and to respond to users or facilitate support.",
			"sourceLineIds": ["L0632", "L0633", "L0634", "L0635", "L0636", "L0637"],
			"qualifications": [
				{
					"summary": "Marketing communications depend on settings, and users can use an unsubscribe link to stop use of their information for direct marketing.",
					"sourceLineIds": ["L0633", "L1513"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "measurement_and_analytics",
			"dataCategories": [
				"Views and interactions with content, products and ads",
				"General demographic and interest information",
				"Connection and network performance",
				"Product-use information"
			],
			"purposes": [
				"Provide partners with measurement and analytics",
				"Understand audiences and how people use partner services",
				"Provide business services"
			],
			"recipients": ["Partners and business users", "Advertisers", "Measurement vendors"],
			"summary": "Meta uses information across accounts to provide measurement, analytics and business services, including reports about reach, interactions, audience characteristics and service performance.",
			"sourceLineIds": ["L0611", "L0613", "L0615", "L0616", "L0617", "L0620"],
			"qualifications": [
				{
					"summary": "Partner analytics reports are described as aggregated; the policy separately says advertisers may receive other information.",
					"sourceLineIds": ["L1151", "L1153", "L1159"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "research_and_social_good",
			"dataCategories": [
				"Product activity and content",
				"Researcher information",
				"Datasets from public, professional and nonprofit sources"
			],
			"purposes": [
				"Conduct research and surveys",
				"Advance technology",
				"Support public interest, safety, health and well-being",
				"Support crisis relief"
			],
			"recipients": [
				"Researchers",
				"Academic and research institutions",
				"International organizations",
				"Relief organizations"
			],
			"summary": "Meta uses information it holds and information from researchers and public or organizational datasets to conduct and support research, including research for social good and technological development.",
			"sourceLineIds": ["L0583", "L0647", "L0655", "L0656", "L0657", "L2761", "L2763"],
			"qualifications": [
				{
					"summary": "Meta says it protects user privacy when sharing information with external researchers.",
					"sourceLineIds": ["L1229", "L1240"]
				},
				{
					"summary": "Some public-interest research may involve sharing relevant research data with third parties, including academics and international organizations, under the stated public-interest basis.",
					"sourceLineIds": ["L3200"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "cross_account_and_device_use",
			"dataCategories": [
				"Information across accounts in Accounts Center",
				"Information across devices"
			],
			"purposes": [
				"Connected experiences",
				"Personalize ads and content",
				"Measure ad performance",
				"Improve Products",
				"Safety and accurate user counts"
			],
			"recipients": ["Meta"],
			"summary": "Meta may combine or use information across accounts and devices for connected experiences, personalization, measurement, Product improvement, safety and counting users.",
			"sourceLineIds": [
				"L0478",
				"L0665",
				"L0667",
				"L0668",
				"L0669",
				"L0670",
				"L0675",
				"L0677",
				"L0678",
				"L0697"
			],
			"qualifications": [
				{
					"summary": "Adding multiple accounts to one Accounts Center is optional, and accounts can be removed; some cross-account uses for safety, counting and Product reliability are described even without joining accounts in the same Accounts Center.",
					"sourceLineIds": ["L0673", "L0675", "L0677", "L0678", "L0679"]
				},
				{
					"summary": "When WhatsApp is added to an Accounts Center with other Meta accounts, Meta and WhatsApp describe joint control for associating the accounts, and each company describes its use of the combined information.",
					"sourceLineIds": ["L0681", "L0683", "L0684", "L0685"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "sharing_with_other_users",
			"dataCategories": [
				"Posts, photos, videos, stories and profile information",
				"Messages",
				"Comments, reactions and other Product activity",
				"Activity status"
			],
			"purposes": [
				"Enable sharing and communication",
				"Make activity visible to selected audiences and people interacted with"
			],
			"recipients": [
				"Selected audiences",
				"People or businesses the user interacts with",
				"Other users"
			],
			"summary": "Information a person shares or communicates on Meta Products may be visible to the selected audience or people they interact with; some activity may also be visible to others.",
			"sourceLineIds": ["L0824", "L0826", "L0831", "L0842", "L0847", "L0858"],
			"qualifications": [
				{
					"summary": "Audience and activity-status settings vary by Product and are available only in some cases.",
					"sourceLineIds": ["L0824", "L0858"]
				},
				{
					"summary": "Recipients can download, screenshot or reshare content, including outside the original audience and on or off Meta Products.",
					"sourceLineIds": ["L0873"]
				},
				{
					"summary": "A supervised user's parent or guardian may see some information and activity when interacting with that user.",
					"sourceLineIds": ["L0865"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "public_content_distribution",
			"dataCategories": [
				"Name, username, profile picture and avatar",
				"Activity on public content, groups, Pages and channels",
				"Content users set to public"
			],
			"purposes": [
				"Make public content available on and across Products",
				"Enable sharing, search and access through connected services"
			],
			"recipients": [
				"Anyone on or off Meta Products",
				"Search engines",
				"Third-party apps and websites",
				"Media and API users"
			],
			"summary": "Some profile information and activity are public, and content set to public may be viewed, shared, accessed or downloaded on or off Meta Products, including through third-party services.",
			"sourceLineIds": ["L0904", "L0906", "L0909", "L0913", "L0918", "L0925", "L0927"],
			"qualifications": [
				{
					"summary": "Users can choose to make some content public; public visibility can include people without accounts.",
					"sourceLineIds": ["L0913", "L0918"]
				},
				{
					"summary": "Search engines and other third parties use public information under their own terms and policies, not Meta's.",
					"sourceLineIds": ["L0934"]
				},
				{
					"summary": "People can manage some public-information and search-engine settings, but some public content may remain accessible through search engines in specified circumstances.",
					"sourceLineIds": ["L1063", "L1065", "L1066", "L1067"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "integrated_partner_sharing",
			"dataCategories": [
				"Public information",
				"Posts and shares made through partner services",
				"Partner-service activity",
				"Device and language information",
				"Additional account information authorized by the user"
			],
			"purposes": [
				"Enable use of integrated partner products and services",
				"Enable login, integrations and sharing"
			],
			"recipients": ["Integrated partners", "Partner app or website developers"],
			"summary": "When a person connects to or uses an integrated partner, the partner may receive public information and information about activity through the partner; additional account information may be shared if the person grants permission.",
			"sourceLineIds": ["L0946", "L0948", "L0956", "L0958", "L0959", "L0960", "L0968", "L0970"],
			"qualifications": [
				{
					"summary": "Access to additional information such as email, hometown, birthday or private-account content requires a partner request and the user's permission.",
					"sourceLineIds": ["L0968", "L0970"]
				},
				{
					"summary": "Apps and websites using Facebook Login or connected to Instagram may access nonpublic information unless Meta determines the user has not used them for 90 days; a partner may retain information previously shared even after access expires.",
					"sourceLineIds": ["L0979"]
				},
				{
					"summary": "Integrated partners handle information under their own terms and policies, not Meta's.",
					"sourceLineIds": ["L1000"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "advertiser_and_audience_network_disclosures",
			"dataCategories": [
				"Aggregated reach and engagement reports",
				"General demographics and interests",
				"Ad interactions, timing and placement",
				"Information needed to serve ads"
			],
			"purposes": [
				"Help advertisers understand audiences and ad performance",
				"Serve ads on publisher apps and websites"
			],
			"recipients": [
				"Advertisers and their vendors",
				"Audience Network publishers and their vendors"
			],
			"summary": "Meta provides advertisers with reports and ad-interaction information, and shares information with Audience Network publishers and vendors to help serve ads outside Meta.",
			"sourceLineIds": ["L1125", "L1127", "L1129", "L1133", "L1139", "L1141", "L1142"],
			"qualifications": [
				{
					"summary": "Meta says it does not share information that by itself can contact or identify a person, such as name or email, with these recipients unless the person gives permission.",
					"sourceLineIds": ["L1133", "L1144"]
				},
				{
					"summary": "Ad-related sharing with advertisers and Audience Network publishers applies if Meta shows the person ads.",
					"sourceLineIds": ["L1120", "L1137"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "seller_and_payment_recipient_sharing",
			"dataCategories": [
				"Order, payment, contact and shipping information",
				"Device or connection security information",
				"Information required by regulation",
				"Other information chosen by the user"
			],
			"purposes": ["Complete transactions", "Secure transactions", "Facilitate payments"],
			"recipients": [
				"Sellers, creators, fundraisers, charities and payment providers",
				"Commerce services platforms",
				"Providers acting on their behalf"
			],
			"summary": "When a person transacts or otherwise chooses to share information with a seller or commerce participant, Meta shares relevant information with that recipient and providers acting for it.",
			"sourceLineIds": ["L1164", "L1166", "L1168", "L1169", "L1170", "L1171"],
			"qualifications": [
				{
					"summary": "The recipients and information shared depend on how the person interacts with them and what information the person chooses to share.",
					"sourceLineIds": ["L1164", "L1166"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "vendor_and_service_provider_sharing",
			"dataCategories": [
				"Ad-view and engagement information",
				"Device identifiers and other identifiers",
				"Online and mobile activity",
				"Information needed to provide Meta services"
			],
			"purposes": [
				"Compile measurement reports",
				"Serve and measure Meta marketing",
				"Provide infrastructure, payments, support, security, analytics, research and surveys"
			],
			"recipients": ["Measurement vendors", "Marketing vendors", "Meta service providers"],
			"summary": "Meta shares information with vendors and service providers to support measurement, advertising and marketing, Product operation, payments, customer support, security, analytics, research and surveys.",
			"sourceLineIds": ["L1188", "L1195", "L1199", "L1200", "L1203", "L1211", "L1213", "L1220"],
			"qualifications": [
				{
					"summary": "Measurement vendors may combine Meta information with information from advertisers and provide aggregated reports.",
					"sourceLineIds": ["L1190"]
				},
				{
					"summary": "The policy describes marketing vendors as receiving identifiers and information about online activity, interests and advertising interactions.",
					"sourceLineIds": ["L1195", "L1200", "L1201"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "external_researcher_sharing",
			"dataCategories": ["Information used for research and analytics"],
			"purposes": [
				"Advance scholarship and innovation",
				"Promote safety, security and integrity",
				"Support social good, technology, public interest, health and well-being"
			],
			"recipients": ["External researchers", "Academic and research institutions"],
			"summary": "Meta provides information to external researchers for research and innovation, including research involving safety, public interest, health and well-being.",
			"sourceLineIds": ["L1229", "L1231", "L1233", "L1235", "L1236", "L1237", "L1238"],
			"qualifications": [
				{
					"summary": "Meta says it takes steps to protect user privacy when sharing information with external researchers.",
					"sourceLineIds": ["L1240"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "ai_partner_exchange",
			"dataCategories": [
				"Information needed to answer AI requests",
				"Information from third-party apps or services connected by the user",
				"Information needed to perform requested actions"
			],
			"purposes": [
				"Provide relevant information through AI features",
				"Enhance Product experience",
				"Perform actions involving connected third-party services"
			],
			"recipients": [
				"Selected partners, including search providers",
				"Third-party apps and services chosen by the user"
			],
			"summary": "Meta sometimes shares information with selected partners to provide relevant AI information and exchanges information with third-party apps or services when a person chooses to connect them.",
			"sourceLineIds": ["L1245", "L1247"],
			"qualifications": [
				{
					"summary": "Connection to third-party apps and services is optional and is described as a user request for information exchange.",
					"sourceLineIds": ["L1247"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "sharing_with_meta_companies",
			"dataCategories": [
				"Information collected by Meta",
				"Account details, including name and email",
				"Information about friends and Product use",
				"Videos and other content"
			],
			"purposes": [
				"Safety and legal compliance",
				"Account verification",
				"Optional features and integrations",
				"Understand Product use",
				"Train products and content-creation tools"
			],
			"recipients": ["Other Meta Companies, including WhatsApp"],
			"summary": "Meta shares information, systems, infrastructure and technology with other Meta Companies for safety, legal compliance, integrations, Product-use understanding and product development.",
			"sourceLineIds": ["L1333", "L1340", "L1342", "L1343", "L1344", "L1376", "L1385"],
			"qualifications": [
				{
					"summary": "Meta may process information received from other Meta Companies according to their terms and policies and applicable law, and may act as their service provider.",
					"sourceLineIds": ["L1335"]
				},
				{
					"summary": "Some cross-company integrations are optional and available only in certain countries.",
					"sourceLineIds": ["L1380"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "legal_and_safety_disclosures",
			"dataCategories": [
				"Information relevant to legal requests or obligations",
				"Account, activity, content, device, location and transaction information"
			],
			"purposes": [
				"Respond to legal requests",
				"Comply with law",
				"Prevent or address fraud, harm, threats, policy violations and emergencies"
			],
			"recipients": [
				"Law enforcement",
				"Government authorities and regulators",
				"Meta Companies",
				"Other third parties, including industry peers"
			],
			"summary": "Meta may access, preserve, use or share information in response to legal requests, to comply with law, or when it believes sharing is necessary to address safety, security, integrity or harm.",
			"sourceLineIds": ["L1729", "L1731", "L1732", "L1733", "L1760", "L1762", "L1766", "L1768"],
			"qualifications": [
				{
					"summary": "Meta says it responds to legal requests when legally required and may also respond when the request may affect users in that jurisdiction and the response is consistent with recognized standards.",
					"sourceLineIds": ["L1745", "L1747", "L1748"]
				},
				{
					"summary": "For safety-related sharing, Meta describes a good-faith belief that sharing is necessary; purposes include emergency situations involving risk of death or imminent bodily harm.",
					"sourceLineIds": ["L1760", "L1768"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "business_transfer_disclosure",
			"dataCategories": ["Information held about the user"],
			"purposes": ["Transfer information as part of a sale or transfer of the business"],
			"recipients": ["A new business owner"],
			"summary": "If Meta sells or transfers all or part of its business, it may provide information to the new owner as part of the transaction.",
			"sourceLineIds": ["L1256"],
			"qualifications": [
				{
					"summary": "The transfer is limited to what the law allows.",
					"sourceLineIds": ["L1256"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "information_retention",
			"dataCategories": [
				"Information held in connection with accounts, Products, transactions, searches and messages"
			],
			"purposes": [
				"Provide Products and maintain accounts",
				"Meet legal obligations",
				"Prevent harm and investigate violations",
				"Protect safety, security, integrity, rights and property"
			],
			"recipients": ["Meta"],
			"summary": "Meta retains information for as long as it considers necessary for Product operation, legal obligations or other stated interests, deciding retention case by case.",
			"sourceLineIds": ["L1551", "L1553", "L1555", "L1556"],
			"qualifications": [
				{
					"summary": "Retention varies by feature; the policy says vanish-mode messages are kept for less time than regular messages and gives deletion periods of one hour after reading or 14 days if unread.",
					"sourceLineIds": ["L1554", "L1572", "L1574"]
				},
				{
					"summary": "Search history remains until cleared or the account is deleted, but within six months Meta deletes search information not needed to show the history.",
					"sourceLineIds": ["L1565", "L1567"]
				},
				{
					"summary": "Information may be preserved longer for legal requests, investigations, policy enforcement, preventing harm, safety, security, integrity, or legal claims, even after a deletion request.",
					"sourceLineIds": ["L1588", "L1590", "L1596", "L1600"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "deletion_and_erasure",
			"dataCategories": ["Account information", "User content and other information"],
			"purposes": ["Honor deletion requests and account deletion"],
			"recipients": ["Meta"],
			"summary": "People can request erasure or use tools to delete specific content or permanently delete an account; Meta says it deletes the information unless it needs to retain it for a stated reason.",
			"sourceLineIds": ["L1489", "L1495", "L1496", "L1607", "L1608"],
			"qualifications": [
				{
					"summary": "A request to erase information is subject to valid grounds and applicable law; account deletion may be subject to retention exceptions.",
					"sourceLineIds": ["L1491", "L1496"]
				},
				{
					"summary": "Deletion may take up to 90 days to process, followed by up to another 90 days to remove information from backups and disaster recovery.",
					"sourceLineIds": ["L1501", "L1612"]
				},
				{
					"summary": "Content left in trash or Recently Deleted begins deletion automatically after 30 days, unless the user starts the process earlier.",
					"sourceLineIds": ["L1503", "L1614"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "international_transfers",
			"dataCategories": ["Information collected about users"],
			"purposes": [
				"Operate and provide Products globally",
				"Connect users around the world",
				"Fix, analyze and improve Products"
			],
			"recipients": [
				"Meta offices and data centers",
				"Partners",
				"Measurement vendors",
				"Service providers",
				"Other third parties"
			],
			"summary": "Meta transfers, stores and processes information globally, including in countries where it and its partners, vendors or service providers operate.",
			"sourceLineIds": ["L1649", "L1651", "L1652", "L1657", "L1659", "L1660", "L1661"],
			"qualifications": [
				{
					"summary": "Meta says it uses appropriate international transfer mechanisms and safeguards, including encryption in transit over public networks.",
					"sourceLineIds": ["L1666", "L1668"]
				},
				{
					"summary": "The policy lists adequacy decisions, Data Privacy Frameworks, standard contractual clauses and legal derogations as mechanisms used in applicable situations.",
					"sourceLineIds": ["L1698", "L1700", "L1701", "L1702"]
				}
			],
			"ambiguous": false,
			"negated": false
		}
	]
}
```

Reference check: **all line IDs resolved**.

**Exact source lines selected by Luna, copied by the application**

```json
[
	{
		"lineId": "L0007",
		"text": "*   [Cookie settings](https://mbasic.facebook.com/privacy/policy/logging/?target=POLICY_PLATFORM_LINK_COLLECTION%3ACOOKIE_SETTINGS&element=privacy_policy_inline_text&redirect_uri=https%3A%2F%2Fmbasic.facebook.com%2Fprivacy%2Fpolicy%2Fprintable%2F%3Fback_id%3Dlink-collection-0%26link_dialog%3DCOOKIE_SETTINGS%26entry%3D0) to choose whether we can use cookies and similar technologies to collect information about your activity on other websites and apps. This includes websites and apps from partners that use our Business Tools."
	},
	{
		"lineId": "L0045",
		"text": "*   The information you give us when you sign up for our Products and create a profile, like your email address, phone number or age"
	},
	{
		"lineId": "L0046",
		"text": "*   What you do on our Products. This includes what you click on or like, your posts and photos, your chats with our features that are part of [AI at Meta](https://www.facebook.com/privacy/genai?entry_point=POLICY_SECTION%3A1-WhatInformationDoWe), and messages you send. On some Products, you can use end-to-end encrypted messages. [Learn more.](https://www.facebook.com/help/messenger-app/786613221989782/?helpref=uf_share&entry_point=POLICY_SECTION%3A1-WhatInformationDoWe)"
	},
	{
		"lineId": "L0051",
		"text": "The information we collect and process about you depends on how you use our [Products\\[3\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SECTION%3A1-WhatInformationDoWe#annotation-3). For example, we collect different information if you sell furniture on Marketplace than if you ask Meta AI to write a joke for you. When you use our Products, we collect some information about you [even if you don't have an account\\[4\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SECTION%3A1-WhatInformationDoWe#annotation-4)."
	},
	{
		"lineId": "L0058",
		"text": "On our [Products\\[3\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A1.subpage.1-YourActivityAndInformation#annotation-3), you can send messages, take photos and videos, buy or sell things and much more. We call all of the things you can do on our Products \"activity.\" We collect your activity across our Products and [information you provide\\[5\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A1.subpage.1-YourActivityAndInformation#annotation-5), such as:"
	},
	{
		"lineId": "L0060",
		"text": "*   Content you create, like posts, comments or audio."
	},
	{
		"lineId": "L0062",
		"text": "*   Messages you send and receive, including their content, subject to [applicable law](https://www.facebook.com/help/499392929200216?entry_point=POLICY_SUBPAGE%3A1.subpage.1-YourActivityAndInformation). On some Products, you can use end-to-end encrypted messages. [Learn more](https://www.facebook.com/help/messenger-app/786613221989782/?helpref=uf_share&entry_point=POLICY_SUBPAGE%3A1.subpage.1-YourActivityAndInformation) about how end-to-end encryption works."
	},
	{
		"lineId": "L0063",
		"text": "*   [Metadata\\[7\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A1.subpage.1-YourActivityAndInformation#annotation-7) about content and messages, subject to [applicable law](https://www.facebook.com/help/499392929200216?entry_point=POLICY_SUBPAGE%3A1.subpage.1-YourActivityAndInformation)."
	},
	{
		"lineId": "L0069",
		"text": "*   The time, frequency and duration of your activities on our Products."
	},
	{
		"lineId": "L0078",
		"text": "You might choose to provide information about your religious views, your sexual orientation, political views, health, racial or ethnic origin, philosophical beliefs or trade union membership. These types of information have special protections under the laws of your country."
	},
	{
		"lineId": "L0086",
		"text": "We collect information about friends, followers, groups, accounts, Facebook Pages and other users and communities you’re connected to and interact with on and off [Meta Products\\[3\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A1.subpage.2-FriendsFollowersAndOther#annotation-3). This includes how you interact with them across our Products and which ones you interact with the most."
	},
	{
		"lineId": "L0091",
		"text": "We also collect your contacts’ or connections’ information, such as their name and email address or phone number, if you choose to upload or import it from a [device\\[11\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A1.subpage.2-FriendsFollowersAndOther#annotation-11), like by syncing an address book."
	},
	{
		"lineId": "L0093",
		"text": "If you don’t use Meta Products, or use them without an account, your information might still be collected. [Learn more](https://www.facebook.com/help/637205020878504?entry_point=POLICY_SUBPAGE%3A1.subpage.2-FriendsFollowersAndOther) about how Meta uses contact information uploaded by account holders."
	},
	{
		"lineId": "L0100",
		"text": "We collect information about you based on others' activity. [See some examples\\[12\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A1.subpage.2-FriendsFollowersAndOther#annotation-12)."
	},
	{
		"lineId": "L0104",
		"text": "*   We might suggest a friend to you through Facebook's People You May Know or Instagram’s Discover People if you both appear on a list of contacts or connections that someone uploads."
	},
	{
		"lineId": "L0105",
		"text": "*   We take into account whether your friends belong to a group when we suggest you join it."
	},
	{
		"lineId": "L0110",
		"text": "We collect and receive information from and about the different [devices\\[11\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A1.subpage.3-AppBrowserAndDevice#annotation-11) you use and how you use them."
	},
	{
		"lineId": "L0114",
		"text": "*   The device and software you’re using, and other device characteristics. [See examples\\[13\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A1.subpage.3-AppBrowserAndDevice#annotation-13)."
	},
	{
		"lineId": "L0115",
		"text": "*   What you’re doing on your device, like whether our app is in the foreground or if your mouse is moving (which can help tell humans from bots)"
	},
	{
		"lineId": "L0116",
		"text": "*   Identifiers that tell your device apart from other users’, including Family Device IDs. [See examples\\[14\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A1.subpage.3-AppBrowserAndDevice#annotation-14)."
	},
	{
		"lineId": "L0118",
		"text": "*   Information you’ve shared with us through device settings, like GPS location, camera access, photos and [related metadata\\[16\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A1.subpage.3-AppBrowserAndDevice#annotation-16)"
	},
	{
		"lineId": "L0119",
		"text": "*   Information about the network you connect your device to and your connection, including your [IP address\\[17\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A1.subpage.3-AppBrowserAndDevice#annotation-17). [See more examples\\[18\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A1.subpage.3-AppBrowserAndDevice#annotation-18)."
	},
	{
		"lineId": "L0120",
		"text": "*   Some [location-related information](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A1.subpage.3-AppBrowserAndDevice#2.subpage.6-HowWeUseLocation), even if Location Services is turned off in your device settings. This includes using IP addresses to estimate your general location."
	},
	{
		"lineId": "L0130",
		"text": "We collect and receive information from [partners\\[21\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A1.subpage.4-InformationFromPartnersVendors#annotation-21), [measurement vendors](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A1.subpage.4-InformationFromPartnersVendors#4.subpage.10-MeasurementVendors), [marketing vendors](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A1.subpage.4-InformationFromPartnersVendors#4.subpage.11-MarketingVendors) and [other third parties\\[22\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A1.subpage.4-InformationFromPartnersVendors#annotation-22) about a variety of your information and activities on and off our [Products\\[3\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A1.subpage.4-InformationFromPartnersVendors#annotation-3)."
	},
	{
		"lineId": "L0134",
		"text": "*   Your [device\\[11\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A1.subpage.4-InformationFromPartnersVendors#annotation-11) information"
	},
	{
		"lineId": "L0135",
		"text": "*   Websites you visit and cookie data, like through Social Plugins or the Meta Pixel"
	},
	{
		"lineId": "L0138",
		"text": "*   Purchases and transactions you make off of our Products using non-Meta checkout experiences"
	},
	{
		"lineId": "L0140",
		"text": "*   How you use our partners’ and other third parties’ products and services, online or in person"
	},
	{
		"lineId": "L0142",
		"text": "[Partners\\[2\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A1.subpage.4-InformationFromPartnersVendors#annotation-2) also share information like your email address, [cookies\\[20\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A1.subpage.4-InformationFromPartnersVendors#annotation-20) and advertising device ID with us. This helps us match your activities with your account, if you have one. You can adjust your Cookie settings to control how we use certain information from partners to provide and personalize content and ads for you."
	},
	{
		"lineId": "L0144",
		"text": "We receive this information whether or not you’re logged in or have an account on our Products. [Learn more](https://www.facebook.com/help/245334736592773?entry_point=POLICY_SUBPAGE%3A1.subpage.4-InformationFromPartnersVendors) about how we connect information from partners to your account."
	},
	{
		"lineId": "L0158",
		"text": "These partners collect your information when you visit their site or app or use their services, or through other businesses or organizations they work with. We require partners to have the right to collect, use and share your information before giving it to us."
	},
	{
		"lineId": "L0192",
		"text": "Even if you don't have an account, you may interact with or use [Meta Products\\[3\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_ANNOTATION%3A1.ex.41-InformationWeCollectIf#annotation-3). Then we collect things like:"
	},
	{
		"lineId": "L0194",
		"text": "*   Browser and app logs of your visits to public content, like Facebook Pages and videos"
	},
	{
		"lineId": "L0195",
		"text": "*   Basic information about [devices\\[11\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_ANNOTATION%3A1.ex.41-InformationWeCollectIf#annotation-11) that downloaded our apps, like device model and OS"
	},
	{
		"lineId": "L0197",
		"text": "We also receive information using cookies and similar technologies, like the Meta Pixel or Social Plugins, when you visit other websites and apps that use our [Business Tools](https://www.facebook.com/help/331509497253087/?helpref=uf_share&entry_point=POLICY_ANNOTATION%3A1.ex.41-InformationWeCollectIf) or other Meta Products. Read more about information we receive from partners, vendors and other third parties in [this policy](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_ANNOTATION%3A1.ex.41-InformationWeCollectIf#4-HowDoWeShare) and in our [Cookies Policy](https://www.facebook.com/policies/cookies?entry_point=POLICY_ANNOTATION%3A1.ex.41-InformationWeCollectIf)."
	},
	{
		"lineId": "L0204",
		"text": "For example, we collect information to monitor attempted attacks on our systems, such as overloading our servers with traffic. Also, if we see someone without an account trying to load too many pages, they could be trying to [scrape](https://www.facebook.com/help/463983701520800/?helpref=search&entry_point=POLICY_ANNOTATION%3A1.ex.41-InformationWeCollectIf) our site in violation of our terms. Then we can take action to prevent it."
	},
	{
		"lineId": "L0208",
		"text": "We can take action according to our Community Standards against someone without an account interacting with Meta Products. For example, we can share information with law enforcement when we believe there is a genuine risk of death or imminent bodily harm."
	},
	{
		"lineId": "L0212",
		"text": "For example, we collect information when people use our Products, even if they don’t have an account, to measure how fast our pages load in different countries and whether they're working properly. This helps us identify and fix issues with local networks."
	},
	{
		"lineId": "L0233",
		"text": "If you use our camera or allow access to photos and videos, on certain Meta Products you can add filters, effects, masks or avatars. Some of these features process parts of faces or bodies within the camera frame, photo or video. Then they can do things like fit a mask correctly over the eyes, nose and mouth. The information we use for this process is used to create the feature. It’s not used to identify you."
	},
	{
		"lineId": "L0238",
		"text": "Ren tells Meta’s voice-enabled Assistant to take a photo on smart glasses. A visual indicator shows that Assistant is activated and listening for Ren’s command. We collect this voice interaction, which includes any background sound that occurs when Ren says the command. Collecting Ren’s voice interactions lets us provide and, depending on Ren’s settings, improve the Assistant feature."
	},
	{
		"lineId": "L0251",
		"text": "When you or others use, or exchange information with these features, or when they perform actions, we collect and use information, such as:"
	},
	{
		"lineId": "L0253",
		"text": "*   Prompts that can include questions, messages, media and other information you or others share with or send to these features"
	},
	{
		"lineId": "L0254",
		"text": "*   Responses and other information you receive from these features. Sometimes these are provided with the help of our [AI integrations](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_ANNOTATION%3A1.ex.62-InformationYouOrOthersExchange#4.subpage.15-AiIntegrations)"
	},
	{
		"lineId": "L0255",
		"text": "*   Information from third-party apps and services you choose to connect to these features to do things like help manage your calendar and emails"
	},
	{
		"lineId": "L0256",
		"text": "*   Feedback you give to these features and responses to your feedback"
	},
	{
		"lineId": "L0257",
		"text": "*   [Information we collect](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_ANNOTATION%3A1.ex.62-InformationYouOrOthersExchange#1-WhatInformationDoWe) to personalize these features. [See examples](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_ANNOTATION%3A1.ex.62-InformationYouOrOthersExchange#2.subpage.5-HowWeUseInformationAI)"
	},
	{
		"lineId": "L0258",
		"text": "*   Information about you and others from third party apps and services that you connect to Meta Products to enhance your experience, including our features that are part of AI at Meta. [Learn more](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_ANNOTATION%3A1.ex.62-InformationYouOrOthersExchange#4.subpage.15-AiIntegrations)"
	},
	{
		"lineId": "L0284",
		"text": "When you use our Products to buy or sell things or make or receive financial transactions, including payments made using Meta Pay or other Meta checkout experiences, we collect information about your purchase or other financial transactions, like:"
	},
	{
		"lineId": "L0286",
		"text": "*   Credit or debit card number and other financial account information"
	},
	{
		"lineId": "L0287",
		"text": "*   Billing, shipping and contact details"
	},
	{
		"lineId": "L0288",
		"text": "*   Items you bought and how many"
	},
	{
		"lineId": "L0289",
		"text": "*   Other account and authentication information"
	},
	{
		"lineId": "L0293",
		"text": "We collect and store this information to facilitate your purchase, receipt of payments and other financial transactions, to personalize your experience on our Products, for advertising and to allow you to access and view your payment and transaction history, where available. And, depending on your choices, we store this information to provide you faster and easier payment and financial transactions experiences."
	},
	{
		"lineId": "L0348",
		"text": "For example, if you give us permission to access your device’s camera roll, we collect metadata. This metadata is from and about your photos and videos and includes the date and time they were made. We use this to do things like remind you when you have new photos to upload."
	},
	{
		"lineId": "L0382",
		"text": "We collect device information to prevent, diagnose, troubleshoot and fix errors and bugs. This includes how long the app was running, what model of device you were using and other performance and diagnostic information."
	},
	{
		"lineId": "L0387",
		"text": "Cookies are small pieces of text used to store information on web browsers. We use cookies and similar technologies, including data that we store on your web browser or device, identifiers associated with your device and other software, Social Plugins and the Meta Pixel. They help us provide, protect and improve our Products, such as by personalizing content, tailoring and measuring ads and providing a safer experience."
	},
	{
		"lineId": "L0389",
		"text": "We collect information from cookies stored on your device, including cookie IDs and settings."
	},
	{
		"lineId": "L0436",
		"text": "*   Improve our AI technologies and support AI research and product development, such as translations, computer vision, content understanding, natural language processing, and tools for people and businesses to create content"
	},
	{
		"lineId": "L0470",
		"text": "*   We personalize your experience, like by suggesting reels to watch, communities to join, or providing more relevant responses from our features that are part of [AI at Meta](https://www.facebook.com/privacy/genai?entry_point=POLICY_SECTION%3A2-HowDoWeUse)"
	},
	{
		"lineId": "L0471",
		"text": "*   We improve our Products by applying information about what you use them to do, and what else is happening on your device when our app crashes"
	},
	{
		"lineId": "L0478",
		"text": "For some of these purposes, we use information [across Meta Company Products\\[26\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SECTION%3A2-HowDoWeUse#annotation-26) from the accounts you choose to add to your Accounts Center, and [across your devices\\[27\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SECTION%3A2-HowDoWeUse#annotation-27). The information we use for these purposes is automatically processed by our systems. But in some cases, we also use [manual review\\[28\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SECTION%3A2-HowDoWeUse#annotation-28) to access and review your information."
	},
	{
		"lineId": "L0480",
		"text": "To use less information that’s connected to individual users, in some cases we de-identify or aggregate information or anonymize it so that it no longer identifies you. We use this information in the same ways we use your information as described in this section."
	},
	{
		"lineId": "L0487",
		"text": "We use information we have to provide and improve our [Products\\[29\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A2.1-ToProvidePersonalizeAnd#annotation-29). This includes:"
	},
	{
		"lineId": "L0489",
		"text": "*   Seeing if our Products are working correctly, such as troubleshooting, and fixing it when it’s not working"
	},
	{
		"lineId": "L0490",
		"text": "*   Personalizing features, content and [recommendations](https://www.facebook.com/help/1257205004624246?entry_point=POLICY_SUBSECTION%3A2.1-ToProvidePersonalizeAnd), such as your [Facebook Feed](https://www.facebook.com/help/1155510281178725/?entry_point=POLICY_SUBSECTION%3A2.1-ToProvidePersonalizeAnd), [Instagram Feed](https://mbasic.facebook.com/privacy/policy/printable/https%3A%2F%2Flm.facebook.com%2Fl.php%3Fu=https%3A%2F%2Fhelp.instagram.com%2F1986234648360433%2F%3Fentry_point%3DPOLICY_SUBSECTION%253A2.1-ToProvidePersonalizeAnd), Meta AI, Stories and ads (if we show you ads)."
	},
	{
		"lineId": "L0492",
		"text": "We use [information with special protections](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A2.1-ToProvidePersonalizeAnd#1.subpage.1-YourActivityAndInformation) you choose to provide for these purposes, but not to show you ads."
	},
	{
		"lineId": "L0499",
		"text": "When you use our Products, you see ads, such as boosted posts or product listings in Shops. Meta personalizes your ads on and across Meta Company Products. You also see ads shown through [Meta Audience Network](https://www.facebook.com/help/119468292028768/?helpref=search&entry_point=POLICY_SUBPAGE%3A2.subpage.2-HowWeShowAds) when you visit other apps. To provide our Products for free, we use your information to show you ads, which advertisers, businesses, organizations and others pay us to show you. We want everything you see to be interesting and useful to you, so we personalize ads for you and measure how they perform. We use information from your account or across accounts in your Accounts Center and cookies on our Products for this. You can control whether we show you ads and which information we use to show you ads in [Ad preferences](https://accountscenter.facebook.com/ad_preferences?entry_point=POLICY_SUBPAGE%3A2.subpage.2-HowWeShowAds)."
	},
	{
		"lineId": "L0503",
		"text": "We also use information that's been de-identified, aggregated, or anonymized so that it no longer identifies individuals, to show you ads."
	},
	{
		"lineId": "L0519",
		"text": "For example, we use information we collect to:"
	},
	{
		"lineId": "L0521",
		"text": "*   Develop and improve products and features"
	},
	{
		"lineId": "L0529",
		"text": "We use information we have, including about your interests and preferences, to help make responses and actions from our features that are part of [AI at Meta](https://www.facebook.com/privacy/genai?entry_point=POLICY_SUBPAGE%3A2.subpage.5-HowWeUseInformationAI) more relevant, such as:"
	},
	{
		"lineId": "L0531",
		"text": "*   [Your activity and information you provide](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A2.subpage.5-HowWeUseInformationAI#1.subpage.1-YourActivityAndInformation)"
	},
	{
		"lineId": "L0532",
		"text": "*   [Friends, followers and other connections](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A2.subpage.5-HowWeUseInformationAI#1.subpage.2-FriendsFollowersAndOther)"
	},
	{
		"lineId": "L0533",
		"text": "*   [App browser and device information](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A2.subpage.5-HowWeUseInformationAI#1.subpage.3-AppBrowserAndDevice)"
	},
	{
		"lineId": "L0534",
		"text": "*   [Information from partners, vendors and third parties](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A2.subpage.5-HowWeUseInformationAI#1.subpage.4-InformationFromPartnersVendors)"
	},
	{
		"lineId": "L0536",
		"text": "For example, Anna is looking for a place to eat and asks Meta AI to recommend a restaurant for dinner. Meta AI uses Anna's [location-related information](https://mbasic.facebook.com/privacy/policy/printable/?annotations%5B0%5D=2.subpage.6-HowWeUseLocation&back_id=ref-36&entry=0&entry_point=POLICY_SUBPAGE%3A2.subpage.5-HowWeUseInformationAI) to suggest restaurants nearby."
	},
	{
		"lineId": "L0538",
		"text": "To make the restaurant suggestion even more relevant, Meta AI also uses additional information including that Anna recently told Meta AI she loves Italian food, and that she has lately been liking Instagram posts featuring modern fine dining. By using her interests, location and profile, Meta AI is able to respond to Anna with a relevant suggestion of a highly-rated, upscale Italian bistro nearby."
	},
	{
		"lineId": "L0543",
		"text": "We use location-related information that you allow us to receive if you turn on the Location Services device setting. This includes things like your GPS location and, depending on the operating system you're using, other [device signals\\[31\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A2.subpage.6-HowWeUseLocation#annotation-31)."
	},
	{
		"lineId": "L0545",
		"text": "We also receive and use some location-related information even if Location Services is turned off. This includes:"
	},
	{
		"lineId": "L0547",
		"text": "*   [IP addresses\\[32\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A2.subpage.6-HowWeUseLocation#annotation-32), which we use to estimate your general location. We can use IP addresses to estimate your specific location if it’s necessary to protect the safety and security of you or others."
	},
	{
		"lineId": "L0548",
		"text": "*   Your and others' activity on our Products, like check-ins and events"
	},
	{
		"lineId": "L0549",
		"text": "*   Information you give us directly, like if you enter your current city on your profile, or provide your address in Marketplace"
	},
	{
		"lineId": "L0551",
		"text": "We use location-related information, such as your current location, where you live, the places you like to go and the businesses and people you're near, to do the things described in the [”How do we use your information?”](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A2.subpage.6-HowWeUseLocation#2-HowDoWeUse) section of the Policy, like:"
	},
	{
		"lineId": "L0553",
		"text": "*   Provide, personalize and improve our Products, including ads (if we show you ads), for you and others. [See an example\\[33\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A2.subpage.6-HowWeUseLocation#annotation-33)."
	},
	{
		"lineId": "L0554",
		"text": "*   Detect suspicious activity and help keep your account secure. [Learn how.\\[34\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A2.subpage.6-HowWeUseLocation#annotation-34)"
	},
	{
		"lineId": "L0583",
		"text": "We use information we have, information from researchers and datasets from publicly available sources, professional groups and non-profit groups to conduct and support research."
	},
	{
		"lineId": "L0592",
		"text": "*   Verify accounts, identity and activity. [Learn more](https://www.meta.com/help/policies/safety/how-we-use-facial-recognition/?entry_point=POLICY_SUBPAGE%3A2.subpage.8-PromotingSafetySecurityAnd) about how you can choose to verify your account or identity through facial recognition technology."
	},
	{
		"lineId": "L0593",
		"text": "*   Find and address violations of our terms or policies. In some cases, the decisions we make about violations are reviewed by the [Oversight Board](https://www.oversightboard.com/?entry_point=POLICY_SUBPAGE%3A2.subpage.8-PromotingSafetySecurityAnd). They may use information we have when they review our decisions. [Learn more](https://www.oversightboard.com/data-policy/?entry_point=POLICY_SUBPAGE%3A2.subpage.8-PromotingSafetySecurityAnd) about how the Oversight Board processes information."
	},
	{
		"lineId": "L0594",
		"text": "*   Investigate suspicious activity. Learn more about face analysis and how we use it to help [protect you](https://www.meta.com/help/policies/1265316287987507/?entry_point=POLICY_SUBPAGE%3A2.subpage.8-PromotingSafetySecurityAnd) and [others](https://www.meta.com/help/policies/1958769918293906/?entry_point=POLICY_SUBPAGE%3A2.subpage.8-PromotingSafetySecurityAnd) from impersonation and identity misuse."
	},
	{
		"lineId": "L0595",
		"text": "*   Detect, prevent and combat harmful or unlawful behavior"
	},
	{
		"lineId": "L0596",
		"text": "*   Detect and prevent spam and other bad experiences"
	},
	{
		"lineId": "L0611",
		"text": "To provide measurement and analytics services, we use the [information we collect about you](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A2.subpage.10-ProvidingMeasurementAnalyticsAnd#1-WhatInformationDoWe) across your accounts on our Products."
	},
	{
		"lineId": "L0613",
		"text": "Our measurement and analytics services help our [partners\\[35\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A2.subpage.10-ProvidingMeasurementAnalyticsAnd#annotation-35) and users understand things like:"
	},
	{
		"lineId": "L0615",
		"text": "*   How many people see and interact with their products, services or content, including posts, videos, Facebook Pages, listings, Shops and ads (if we show you ads), including those shown through apps using [Meta Audience Network](https://www.facebook.com/audiencenetwork/?entry_point=POLICY_SUBPAGE%3A2.subpage.10-ProvidingMeasurementAnalyticsAnd)"
	},
	{
		"lineId": "L0616",
		"text": "*   How people interact with their content, websites, apps and services"
	},
	{
		"lineId": "L0617",
		"text": "*   What [types of people\\[36\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A2.subpage.10-ProvidingMeasurementAnalyticsAnd#annotation-36) interact with their content or use their services"
	},
	{
		"lineId": "L0620",
		"text": "We also use the information we collect to provide business services."
	},
	{
		"lineId": "L0632",
		"text": "*   We send messages about the Products we know you use, using the email you register to your account"
	},
	{
		"lineId": "L0633",
		"text": "*   Depending on your settings, we send marketing communications about Products you might like"
	},
	{
		"lineId": "L0634",
		"text": "*   We ask you to participate in research based on things like how you use our Products"
	},
	{
		"lineId": "L0635",
		"text": "*   We let you know about our policies and terms of service"
	},
	{
		"lineId": "L0636",
		"text": "*   When you contact us with questions, we reply to your email"
	},
	{
		"lineId": "L0637",
		"text": "*   We facilitate customer support communications with you when you've told us, either directly or through a [third party\\[37\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A2.subpage.12-CommunicatingWithYouWe#annotation-37), that you have questions or concerns about our Products"
	},
	{
		"lineId": "L0647",
		"text": "We research and innovate to help people around the world. Our goals include:"
	},
	{
		"lineId": "L0655",
		"text": "*   [We analyze information](https://mbasic.facebook.com/privacy/policy/printable/https%3A%2F%2Flm.facebook.com%2Fl.php%3Fu=https%3A%2F%2Fai.meta.com%2Fai-for-good%2F%3Fentry_point%3DPOLICY_SUBPAGE%253A2.subpage.14-ResearchingAndInnovatingFor) about where groups of people go during crises. This helps relief organizations get aid to the right places."
	},
	{
		"lineId": "L0656",
		"text": "*   We work with independent researchers to better understand the impact social media might have on elections and democratic processes"
	},
	{
		"lineId": "L0657",
		"text": "*   We’ve collaborated with academics and industry experts to help improve internet access and quality in rural areas"
	},
	{
		"lineId": "L0665",
		"text": "If you choose to add your accounts to the same Accounts Center, we'll combine your [information across your accounts](https://www.meta.com/help/accounts-center/Information-used-across-accounts/?entry_point=POLICY_ANNOTATION%3A2.ex.5-UsingInformationAcrossOur) on Meta Company Products. We'll use your information to:"
	},
	{
		"lineId": "L0667",
		"text": "*   Provide you with the option to use [connected experiences](https://www.meta.com/help/accounts-center/enable-connected-experiences-accounts-center/?entry_point=POLICY_ANNOTATION%3A2.ex.5-UsingInformationAcrossOur)"
	},
	{
		"lineId": "L0668",
		"text": "*   [Personalize ads for you](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_ANNOTATION%3A2.ex.5-UsingInformationAcrossOur#2.subpage.2-HowWeShowAds) and others and [measure how they perform](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_ANNOTATION%3A2.ex.5-UsingInformationAcrossOur#2.subpage.10-ProvidingMeasurementAnalyticsAnd), if we show you ads"
	},
	{
		"lineId": "L0669",
		"text": "*   Personalize content and suggestions for you and others. [See an example\\[38\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_ANNOTATION%3A2.ex.5-UsingInformationAcrossOur#annotation-38)"
	},
	{
		"lineId": "L0670",
		"text": "*   Improve our Products and provide optional activities that span across them"
	},
	{
		"lineId": "L0673",
		"text": "Adding multiple accounts to an Accounts Center is entirely optional. You can remove accounts from an Accounts Center at any time."
	},
	{
		"lineId": "L0675",
		"text": "Even if you don't add your accounts on Meta Products to the same Accounts Center, we use information across your accounts to:"
	},
	{
		"lineId": "L0677",
		"text": "*   Keep you and others safe"
	},
	{
		"lineId": "L0678",
		"text": "*   More accurately count people and measure how they use our Products"
	},
	{
		"lineId": "L0679",
		"text": "*   Make sure our Products are working correctly so we can fix them if they’re not"
	},
	{
		"lineId": "L0681",
		"text": "When you add your WhatsApp account to an Accounts Center with other accounts on Meta Company Products:"
	},
	{
		"lineId": "L0683",
		"text": "*   WhatsApp and Meta are joint controllers for the purpose of associating the accounts you have added to an Accounts Center with each other."
	},
	{
		"lineId": "L0684",
		"text": "*   Meta will combine your information across accounts on Meta Company Products and use your information as described in this section. This includes using your information to keep you and others safe, more accurately count people and measure how they use our products, and make sure our Products are working correctly so we can fix them if they’re not."
	},
	{
		"lineId": "L0685",
		"text": "*   WhatsApp will combine your information across accounts on Meta Company Products and use your information as described in the [WhatsApp in Accounts Center Supplemental Privacy Policy](https://mbasic.facebook.com/privacy/policy/printable/https%3A%2F%2Flm.facebook.com%2Fl.php%3Fu=https%3A%2F%2Fwww.whatsapp.com%2Flegal%2Faccounts-centre-supplemental-privacy-policy-eea%3Fentry_point%3DPOLICY_ANNOTATION%253A2.ex.5-UsingInformationAcrossOur)."
	},
	{
		"lineId": "L0697",
		"text": "One reason we use your information across [devices\\[39\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_ANNOTATION%3A2.ex.1-WhyWeUseInformation#annotation-39) is to help us give you a more personalized experience. For example, we might show you an ad on your phone, and later you might use your laptop to click on the ad and buy the product. By combining that information across your devices, we can understand what ads are relevant to you and help businesses measure how well their ad performed."
	},
	{
		"lineId": "L0704",
		"text": "*   Our reviewers help us promote safety, security and integrity across our Products. For example, reviewers can look for and remove content that violates our terms and policies and keep content that doesn’t break our terms and policies available. Their work supplements our [technology that detects violations](https://mbasic.facebook.com/privacy/policy/printable/https%3A%2F%2Flm.facebook.com%2Fl.php%3Fu=https%3A%2F%2Ftransparency.fb.com%2Fen-gb%2Fenforcement%2Fdetecting-violations%2Ftechnology-detects-violations%2F%3Fentry_point%3DPOLICY_ANNOTATION%253A2.ex.2-ManualReviewExamplesOf)."
	},
	{
		"lineId": "L0705",
		"text": "*   When our algorithms detect that [someone might need help](https://www.facebook.com/safety/wellbeing/suicideprevention?entry_point=POLICY_ANNOTATION%3A2.ex.2-ManualReviewExamplesOf), a reviewer can review their post and offer support if needed."
	},
	{
		"lineId": "L0706",
		"text": "*   We also use manual review to analyze content to train our algorithms to review content the same way a person would. This improves our automatic processing, which in turn helps us improve our products."
	},
	{
		"lineId": "L0710",
		"text": "Our reviewers work at Meta, for [Meta Companies](https://www.facebook.com/help/111814505650678?ref=tos&entry_point=POLICY_ANNOTATION%3A2.ex.2-ManualReviewExamplesOf) or for a trusted [service provider\\[40\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_ANNOTATION%3A2.ex.2-ManualReviewExamplesOf#annotation-40). We require every reviewer who's allowed access to your information to meet privacy and security standards."
	},
	{
		"lineId": "L0824",
		"text": "When you share and communicate using our Products, you can sometimes [choose the audience\\[42\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A3.subpage.1-PeopleAndAccountsYou#annotation-42) for what you share."
	},
	{
		"lineId": "L0826",
		"text": "When you interact with people or businesses, they can see:"
	},
	{
		"lineId": "L0831",
		"text": "For example, the audience you choose can see when you:"
	},
	{
		"lineId": "L0842",
		"text": "People you interact with can see what you send to them. So if you send a person or a business a message on Messenger or Instagram, that person or business can read your message."
	},
	{
		"lineId": "L0847",
		"text": "People and businesses can also see some of your activity on our Products. This includes when you:"
	},
	{
		"lineId": "L0858",
		"text": "Some of our Products might provide you with settings that allow others to see when you're active on our Products, such as “active status.” In some cases, we also offer settings that allow others to see when you’re active in a particular section of one of our Products, like a message thread, game or event, or when you last used one of our Products."
	},
	{
		"lineId": "L0865",
		"text": "Some accounts are [supervised\\[43\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A3.subpage.1-PeopleAndAccountsYou#annotation-43). When you interact with a supervised user, their parent or guardian can see some of your activity and information. This can include information like your username, profile picture and if the supervised user blocked you. On some Products, the supervised user can let their parent or guardian know if they reported you."
	},
	{
		"lineId": "L0873",
		"text": "People in your audience can view your content and can choose to share it with others outside your audience, on and off our Products. For example, when you share a post or send a message to specific friends, they can download, screenshot or reshare it with anyone, including by using features that are part of [AI at Meta](https://www.facebook.com/privacy/genai?entry_point=POLICY_SUBPAGE%3A3.subpage.2-ContentOthersShareOr), on, across or off our Products."
	},
	{
		"lineId": "L0904",
		"text": "Some of your information and activity are always public. This includes your:"
	},
	{
		"lineId": "L0906",
		"text": "*   Name"
	},
	{
		"lineId": "L0909",
		"text": "*   Activity on public groups, Facebook Pages and channels"
	},
	{
		"lineId": "L0913",
		"text": "Other content you can choose to set to Public, like posts, photos and videos you post to your profile, Stories, Lives or Reels."
	},
	{
		"lineId": "L0918",
		"text": "When content is public, it can be seen by anyone on or across our Products, and in some cases off our Products, even if they don’t have an account."
	},
	{
		"lineId": "L0925",
		"text": "We, you and people using our Products can send public content (like your profile photo, or information you share on a Facebook Page or public Instagram account) to anyone on, across or off our Products. For example, users can share it in a public forum, or it can appear in search results on the internet or our [research tools](https://mbasic.facebook.com/privacy/policy/printable/https%3A%2F%2Flm.facebook.com%2Fl.php%3Fu=https%3A%2F%2Ftransparency.meta.com%2Fresearchtools%2Fmeta-content-library%3Fentry_point%3DPOLICY_SUBPAGE%253A3.subpage.3-PublicContentWhatContent)."
	},
	{
		"lineId": "L0927",
		"text": "Public content can also be seen, accessed, reshared or downloaded through third-party services, like:"
	},
	{
		"lineId": "L0934",
		"text": "Search engines and other third parties use this information according to their own terms and policies, not Meta’s."
	},
	{
		"lineId": "L0946",
		"text": "You can choose to connect with [integrated partners\\[46\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A3.2-WithIntegratedPartnersYou#annotation-46) who use our Products. If you do, these integrated partners receive information about you and your activity."
	},
	{
		"lineId": "L0948",
		"text": "These integrated partners can always access information that’s public on our Products. Learn more about other information they receive and how they handle your information:"
	},
	{
		"lineId": "L0956",
		"text": "When you use an integrated partner’s products or services, they can access:"
	},
	{
		"lineId": "L0958",
		"text": "*   What you post or share from these products or services"
	},
	{
		"lineId": "L0959",
		"text": "*   What you use their services to do"
	},
	{
		"lineId": "L0960",
		"text": "*   Information from and about the device you’re using"
	},
	{
		"lineId": "L0968",
		"text": "Sometimes these integrated partners ask you for permission to access certain additional information from your Facebook, Instagram or Messenger account. In their request, they’ll explain what information they’d like to access and let you choose whether to share it."
	},
	{
		"lineId": "L0970",
		"text": "On Facebook, this includes things like your email address, hometown or birthday. On Instagram, this includes content, like photos and videos, that you’ve shared from your account when the account was set to private."
	},
	{
		"lineId": "L0979",
		"text": "Apps or websites you’ve logged into using Facebook Login or connected to your Instagram account can access your nonpublic information on Meta Products unless it appears to us that you haven’t used the app or website in 90 days. Note that even if an app’s access to your information has expired, it can still retain information you shared with it previously."
	},
	{
		"lineId": "L1000",
		"text": "Integrated partners handle the information you share with them according to their own terms and policies, not Meta’s. You can review their privacy policy on their website or app to learn how they receive and process your information. In some cases, they use a separate service provider to receive and process your information."
	},
	{
		"lineId": "L1063",
		"text": "You can visit your [privacy settings](https://www.facebook.com/settings?tab=privacy&entry_point=POLICY_ANNOTATION%3A3.ex.5-SearchEnginesYouCan) to control whether search engines can show your profile or public photos and videos in search results outside of Meta. Some public content might still be accessible through search engines, for example:"
	},
	{
		"lineId": "L1065",
		"text": "*   If you post with your audience or profile set to Public,"
	},
	{
		"lineId": "L1066",
		"text": "*   If you post on public Pages or accounts, depending on the settings of that account,"
	},
	{
		"lineId": "L1067",
		"text": "*   If your public content is reshared by a professional account on Instagram."
	},
	{
		"lineId": "L1120",
		"text": "Advertisers and Audience Network publishers (if we show you ads)"
	},
	{
		"lineId": "L1125",
		"text": "We provide advertisers with reports about the number and kinds of people who see and engage with their ads. These reports include information about the general demographics and interests of people who engaged with an advertiser’s ad. Then advertisers can better understand their audience. [See an example\\[51\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A4.subpage.2-AdvertisersAndAudienceNetwork#annotation-51)."
	},
	{
		"lineId": "L1127",
		"text": "Meta also provides advertisers and their vendors with information about:"
	},
	{
		"lineId": "L1129",
		"text": "*   Ads people engaged with, if any"
	},
	{
		"lineId": "L1133",
		"text": "We also confirm which ads you viewed that led you to take an action with an advertiser, such as downloading an advertiser's app. But we don't share information with these advertisers and their vendors that by itself can be used to contact or identify you, such as your name or email address, unless you [give us permission.\\[52\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A4.subpage.2-AdvertisersAndAudienceNetwork#annotation-52)"
	},
	{
		"lineId": "L1137",
		"text": "Meta Audience Network lets advertisers place ads with us that will be published on other apps and websites outside of Meta."
	},
	{
		"lineId": "L1139",
		"text": "To help show you ads on their apps and websites, we share information with publishers who use Audience Network, as well as vendors who facilitate that use. For example, we share:"
	},
	{
		"lineId": "L1141",
		"text": "*   How many people see and engage with ads on publisher apps"
	},
	{
		"lineId": "L1142",
		"text": "*   Information related to or in response to a [publisher’s request](https://www.facebook.com/help/119468292028768?ref=shareable&entry_point=POLICY_SUBPAGE%3A4.subpage.2-AdvertisersAndAudienceNetwork) to serve an ad on its app."
	},
	{
		"lineId": "L1144",
		"text": "But we don't share information with these publishers and their vendors that by itself can be used to contact or identify you, such as your name or email address, unless you [give us permission\\[52\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A4.subpage.2-AdvertisersAndAudienceNetwork#annotation-52)."
	},
	{
		"lineId": "L1151",
		"text": "To provide these services, we use the [information we collect](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A4.subpage.4-PartnersWhoUseOur#1-WhatInformationDoWe) about you. We put this information into aggregate reports so that partners can see how well their content, features, products and services are performing and are able to understand things like users’ experience with such content, products and services."
	},
	{
		"lineId": "L1153",
		"text": "These reports aggregate information like:"
	},
	{
		"lineId": "L1159",
		"text": "Advertisers also receive other information. [Read our Policy](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A4.subpage.4-PartnersWhoUseOur#4.subpage.2-AdvertisersAndAudienceNetwork) about how we share information with advertisers."
	},
	{
		"lineId": "L1164",
		"text": "When you choose to [make a transaction\\[54\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A4.subpage.6-PartnersWhoOfferGoods#annotation-54), or otherwise choose to share information with a seller, creator, fundraiser, charity, payment services provider or [commerce services platform\\[55\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A4.subpage.6-PartnersWhoOfferGoods#annotation-55), we share information with them and with any providers acting on their behalf."
	},
	{
		"lineId": "L1166",
		"text": "Depending on how you interact with them, they receive:"
	},
	{
		"lineId": "L1168",
		"text": "*   Information to complete your transaction, like order, payment, contact and shipping information"
	},
	{
		"lineId": "L1169",
		"text": "*   Information to help ensure the security of the transaction, like information about your device or connection"
	},
	{
		"lineId": "L1170",
		"text": "*   Any information required by applicable regulation"
	},
	{
		"lineId": "L1171",
		"text": "*   Other information you choose to share with them"
	},
	{
		"lineId": "L1188",
		"text": "We share information (like whether people saw an ad or engaged with it) with our [measurement vendors\\[56\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A4.subpage.10-MeasurementVendors#annotation-56), who aggregate or compile it to provide their reports."
	},
	{
		"lineId": "L1190",
		"text": "For example, an advertiser might ask a measurement vendor to help figure out the impact its ads on Facebook have had on sales. The measurement vendor compares information from us about clicks on the advertiser’s Facebook ads with information from the advertiser about product purchases. Then the measurement vendor creates and provides aggregated reports that show the advertiser how its ads are performing."
	},
	{
		"lineId": "L1195",
		"text": "We share information about you with [marketing vendors\\[57\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A4.subpage.11-MarketingVendors#annotation-57). For example, we share your device identifier or other identifiers with marketing vendors to help us serve you ads most relevant to your interests."
	},
	{
		"lineId": "L1199",
		"text": "*   Serving our advertisements across the internet, including on mobile, desktop and connected television devices"
	},
	{
		"lineId": "L1200",
		"text": "*   Tracking and categorizing your online and mobile app activity"
	},
	{
		"lineId": "L1201",
		"text": "*   Providing us information about your interests and community and advertising interactions"
	},
	{
		"lineId": "L1203",
		"text": "These marketing vendors help us understand who might find our advertising most relevant to their interests, and which of our Products might interest you. This information can be used to personalize which of our ads are shown to you. Marketing vendors also use this information to measure response to our marketing efforts and the effectiveness of our advertising."
	},
	{
		"lineId": "L1211",
		"text": "Service providers provide services to us that help us provide our Products to you. We share the information we have about you to receive these services, which include:"
	},
	{
		"lineId": "L1213",
		"text": "*   Investigating suspicious activity"
	},
	{
		"lineId": "L1220",
		"text": "*   Conducting research and surveys"
	},
	{
		"lineId": "L1229",
		"text": "We provide information to external researchers. They use it to conduct research that advances scholarship and innovation, and to promote safety, security and integrity."
	},
	{
		"lineId": "L1231",
		"text": "Research goals include supporting:"
	},
	{
		"lineId": "L1233",
		"text": "*   Our business or mission"
	},
	{
		"lineId": "L1235",
		"text": "*   Technological advancement"
	},
	{
		"lineId": "L1236",
		"text": "*   Safety and security on our Products"
	},
	{
		"lineId": "L1237",
		"text": "*   Public interest"
	},
	{
		"lineId": "L1238",
		"text": "*   Health and well-being"
	},
	{
		"lineId": "L1240",
		"text": "When sharing information with external researchers, we ensure the privacy of our users is protected. [Learn more](https://mbasic.facebook.com/privacy/policy/printable/https%3A%2F%2Flm.facebook.com%2Fl.php%3Fu=https%3A%2F%2Ftransparency.fb.com%2Fen-gb%2Fresearchtools%2F%3Fentry_point%3DPOLICY_SUBPAGE%253A4.subpage.14-ExternalResearchersWeProvide) about the privacy-safe research we support."
	},
	{
		"lineId": "L1245",
		"text": "Generative AI models that make our features work may not have the most complete or recent information. For example, that means if you ask Meta AI about the score to yesterday's football game, it might not know the right answer. That's why we work with other selected partners, like search engine providers. We sometimes share certain information with these partners so we can bring you the most relevant information."
	},
	{
		"lineId": "L1247",
		"text": "You can also choose to connect third-party apps and services to your Meta account to enhance your experience with Meta Products, including our features that are part of AI at Meta. When you connect to these apps and services, you are requesting us to exchange information with them. We can use this information about you and others in the same ways we use your information as described in this Policy, and share information to perform actions for you involving those third-party apps and services."
	},
	{
		"lineId": "L1256",
		"text": "And if we sell or transfer all or part of our business to someone else, in some cases we’ll give the new owner your information as part of that transaction, but only as the law allows."
	},
	{
		"lineId": "L1333",
		"text": "We share information we collect, infrastructure, systems and technology with the other Meta Companies. [Learn more](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SECTION%3A5-HowDoTheMeta#9-HowDoWeTransfer) about how we transfer information to other countries."
	},
	{
		"lineId": "L1335",
		"text": "We also process information that we receive about you from other Meta Companies, according to their terms and policies and as permitted by applicable law. In some cases, Meta acts as a [service provider\\[59\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SECTION%3A5-HowDoTheMeta#annotation-59) for other Meta Companies. We act on their behalf and in accordance with their instructions and terms."
	},
	{
		"lineId": "L1340",
		"text": "Meta Products share information with other Meta Companies:"
	},
	{
		"lineId": "L1342",
		"text": "*   To promote safety, security and integrity and comply with applicable laws"
	},
	{
		"lineId": "L1343",
		"text": "*   To provide optional features and integrations"
	},
	{
		"lineId": "L1344",
		"text": "*   To understand how people use and interact with Meta Company Products"
	},
	{
		"lineId": "L1376",
		"text": "For these purposes, we might share your name, email address, who you’re friends with and other account information within the Meta Companies."
	},
	{
		"lineId": "L1380",
		"text": "For example, where available in your country, you can choose to use certain integrations that connect your WhatsApp experiences with other Meta Company Products. These integrations let you do things like:"
	},
	{
		"lineId": "L1385",
		"text": "We also share information with Meta Companies to support innovation. For example, your videos can help train our products to recognize objects, like trees, or activities, like when a dog chases a ball. They can also help train tools that let people and businesses create content, like images and videos. This technology is used to help us offer new products or features in the future."
	},
	{
		"lineId": "L1426",
		"text": "*   You allow us to use your information to show you ads, including information across accounts in your Accounts Center"
	},
	{
		"lineId": "L1427",
		"text": "*   You can also allow us to show you personalized ads based on information that advertisers and other partners provide to us. This includes information about your activity on their websites and apps, and certain offline interactions, such as purchases."
	},
	{
		"lineId": "L1489",
		"text": "----------------------"
	},
	{
		"lineId": "L1491",
		"text": "You have the right to request that we [erase](https://www.facebook.com/help/contact/259518714718624?entry_point=POLICY_SUBPAGE%3A7.subpage.9-EraseYourInformationYou) your information, if there are valid grounds for doing so and subject to applicable law."
	},
	{
		"lineId": "L1495",
		"text": "*   **Find and delete specific information using provided deletion controls** For certain specific information that you can view in our [Products\\[61\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A7.subpage.9-EraseYourInformationYou#annotation-61), we offer tools you can use to request deletion. For example, you can use Delete buttons to delete content you’ve posted to your account. You can also use tools like [activity log](https://www.facebook.com/0/allactivity/?entry_point=POLICY_SUBPAGE%3A7.subpage.9-EraseYourInformationYou) on Facebook to send content to the trash in bulk. When you delete content, it’s no longer visible to other users. Visit the [Facebook Help Center](https://www.facebook.com/help/356107851084108?ref=dp&entry_point=POLICY_SUBPAGE%3A7.subpage.9-EraseYourInformationYou) or [Instagram Help Center](https://mbasic.facebook.com/privacy/policy/printable/https%3A%2F%2Flm.facebook.com%2Fl.php%3Fu=https%3A%2F%2Fhelp.instagram.com%2F711062676142607%3Fentry_point%3DPOLICY_SUBPAGE%253A7.subpage.9-EraseYourInformationYou) to learn what happens when you delete your content or move it to [trash](https://www.facebook.com/help/3094200253964092?entry_point=POLICY_SUBPAGE%3A7.subpage.9-EraseYourInformationYou)."
	},
	{
		"lineId": "L1496",
		"text": "*   **Permanently delete your account** If you delete your account on [Facebook](https://www.facebook.com/help/224562897555674?entry_point=POLICY_SUBPAGE%3A7.subpage.9-EraseYourInformationYou) or [Instagram](https://mbasic.facebook.com/privacy/policy/printable/https%3A%2F%2Flm.facebook.com%2Fl.php%3Fu=https%3A%2F%2Fhelp.instagram.com%2F370452623149242%3Fentry_point%3DPOLICY_SUBPAGE%253A7.subpage.9-EraseYourInformationYou), we delete your information, including the things you have posted, such as your photos and status updates, unless we need to retain this information as described in [How long do we keep your information?\"](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A7.subpage.9-EraseYourInformationYou#8-HowLongDoWe). Please note that once your [account is permanently deleted](https://www.facebook.com/help/250563911970368/?helpref=hc_fnav&entry_point=POLICY_SUBPAGE%3A7.subpage.9-EraseYourInformationYou), you won’t be able to reactivate it, and you won’t be able to retrieve information you’ve added, including content you’ve posted."
	},
	{
		"lineId": "L1501",
		"text": "If you request that we delete your account or content, it may take up to 90 days to delete your information after we begin the account deletion process or receive a content deletion request. After the information is deleted, it may take us up to another 90 days to remove it from backups and disaster recovery."
	},
	{
		"lineId": "L1503",
		"text": "If you leave your deleted content in your trash on Facebook or your Recently Deleted folder on Instagram, the deletion process will begin automatically in 30 days. Or you can start the deletion process right away by deleting the content from your trash or Recently Deleted folder."
	},
	{
		"lineId": "L1513",
		"text": "You can use the \"unsubscribe\" link in our marketing communications to stop us from using your information for that direct marketing."
	},
	{
		"lineId": "L1551",
		"text": "We keep information as long as we need it to provide our Products, comply with legal obligations or protect our or other’s interests. We decide how long we need information on a case-by-case basis. Here’s what we consider when we decide:"
	},
	{
		"lineId": "L1553",
		"text": "*   If we need it to operate or provide our Products. For example, we need to keep some of your information to maintain your account. [Learn more\\[63\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SECTION%3A8-HowLongDoWe#annotation-63)."
	},
	{
		"lineId": "L1554",
		"text": "*   The feature we use it for, and how that feature works. For example, messages sent using Messenger’s vanish mode are retained for less time than regular messages. [Learn more\\[64\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SECTION%3A8-HowLongDoWe#annotation-64)."
	},
	{
		"lineId": "L1555",
		"text": "*   How long we need to retain the information to comply with certain legal obligations. [See some examples\\[65\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SECTION%3A8-HowLongDoWe#annotation-65)."
	},
	{
		"lineId": "L1556",
		"text": "*   If we need it for other legitimate purposes, such as to prevent harm; investigate possible violations of our terms or policies; promote safety, security and integrity; or protect ourselves, including our rights, property or products"
	},
	{
		"lineId": "L1565",
		"text": "And when you search for something on Facebook, we keep your search history until you clear the search in your [activity log](https://www.facebook.com/0/allactivity?entry_point=POLICY_ANNOTATION%3A8.ex.1-IfWeNeedIt) or delete your account. Once you clear a search or delete your account, it will no longer be visible to you, and it will be [deleted\\[67\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_ANNOTATION%3A8.ex.1-IfWeNeedIt#annotation-67)."
	},
	{
		"lineId": "L1567",
		"text": "But even if you don’t clear your search or delete your account, within six months of your search we delete information about that search that isn’t necessary to show you your search history, like information about the device you were using, or your location."
	},
	{
		"lineId": "L1572",
		"text": "For example, May is planning a surprise party for Yang. She sends Cynthia the party details in Messenger using vanish mode so that the message will disappear. The message will no longer be visible to May once she leaves the chat, and Cynthia will see the message only the first time she opens the chat thread."
	},
	{
		"lineId": "L1574",
		"text": "After Cynthia reads the message, the content is deleted after one hour. If Cynthia never reads it, it’s deleted after 14 days."
	},
	{
		"lineId": "L1588",
		"text": "Your information, including financial transaction data related to purchases or money transfers made on our Products, may be preserved and accessed for a longer time period if it’s related to any of the following:"
	},
	{
		"lineId": "L1590",
		"text": "*   A legal request or obligation, including obligations of Meta Companies or to comply with applicable law"
	},
	{
		"lineId": "L1596",
		"text": "*   If it’s needed in relation to a legal claim, complaint, litigation or regulatory proceedings"
	},
	{
		"lineId": "L1600",
		"text": "In some cases, we may preserve your information based on the above reasons even after you request deletion of your account or some of your content. We may also preserve information from accounts that have been disabled and content that has been removed for violations of our terms and policies."
	},
	{
		"lineId": "L1607",
		"text": "*   **Find and delete specific information.** We offer tools you can use to delete certain information. For example, you can use Delete buttons to delete content you’ve posted to your account. You can also use tools like [activity log](https://mbasic.facebook.com/privacy/policy/logging/?target=POLICY_PLATFORM_LINK_COLLECTION%3AACTIVITY_LOG&element=privacy_policy_inline_text&containing_element_id=POLICY_ANNOTATION%3A6.ex.2-DeleteYourInformationOr&redirect_uri=https%3A%2F%2Fwww.facebook.com%2F0%2Fallactivity%2F%3Fentry_point%3DPOLICY_ANNOTATION%253A6.ex.2-DeleteYourInformationOr%26should_load_landing_page%3D1) on Facebook to send content to the trash in bulk. When you delete content, it’s no longer visible to other users. Visit the [Facebook Help Center](https://www.facebook.com/help/356107851084108?entry_point=POLICY_ANNOTATION%3A6.ex.2-DeleteYourInformationOr) or [Instagram Help Center](https://mbasic.facebook.com/privacy/policy/printable/https%3A%2F%2Flm.facebook.com%2Fl.php%3Fu=https%3A%2F%2Fhelp.instagram.com%2F711062676142607%3Fentry_point%3DPOLICY_ANNOTATION%253A6.ex.2-DeleteYourInformationOr) to learn what happens when you delete your content or move it to [trash](https://www.facebook.com/help/3094200253964092?entry_point=POLICY_ANNOTATION%3A6.ex.2-DeleteYourInformationOr)."
	},
	{
		"lineId": "L1608",
		"text": "*   **Permanently delete your account.** If you delete your account on [Facebook](https://www.facebook.com/help/224562897555674?entry_point=POLICY_ANNOTATION%3A6.ex.2-DeleteYourInformationOr) or [Instagram](https://mbasic.facebook.com/privacy/policy/printable/https%3A%2F%2Flm.facebook.com%2Fl.php%3Fu=https%3A%2F%2Fhelp.instagram.com%2F370452623149242%3Fentry_point%3DPOLICY_ANNOTATION%253A6.ex.2-DeleteYourInformationOr), we delete your information, including the things you’ve posted, such as your photos and status updates, unless we need to keep it as described in [\"How long do we keep your information?\"](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_ANNOTATION%3A6.ex.2-DeleteYourInformationOr#8-HowLongDoWe) Once your account is [permanently deleted](https://www.facebook.com/help/250563911970368/?ref=dp&entry_point=POLICY_ANNOTATION%3A6.ex.2-DeleteYourInformationOr) you won’t be able to reactivate it, and you won’t be able to retrieve information, including content you’ve posted."
	},
	{
		"lineId": "L1612",
		"text": "If you request that we delete your account or content, it may take up to 90 days to delete your information after we begin the account deletion process or receive a content deletion request. After the information is deleted, it may take us up to another 90 days to remove it from backups and disaster recovery."
	},
	{
		"lineId": "L1614",
		"text": "If you leave your deleted content in your trash on Facebook or your Recently Deleted folder on Instagram, the deletion process will begin automatically in 30 days. Or you can start the deletion process right away by deleting the content from your trash or Recently Deleted folder."
	},
	{
		"lineId": "L1649",
		"text": "We share the [information we collect](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A9.subpage.1-WhyIsInformationTransferred#1-WhatInformationDoWe) globally, both internally across our offices and data centers, and externally with our [partners\\[69\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A9.subpage.1-WhyIsInformationTransferred#annotation-69), [measurement vendors\\[70\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A9.subpage.1-WhyIsInformationTransferred#annotation-70), [service providers\\[71\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A9.subpage.1-WhyIsInformationTransferred#annotation-71) and other [third parties\\[72\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A9.subpage.1-WhyIsInformationTransferred#annotation-72). Because Meta is global, with users, partners and employees around the world, transfers are necessary for a variety of reasons, including:"
	},
	{
		"lineId": "L1651",
		"text": "*   So we can operate and provide the services stated in the terms of the [Meta Product\\[73\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A9.subpage.1-WhyIsInformationTransferred#annotation-73) you’re using and this Policy. This includes allowing you to share information and connect with your family and friends around the globe."
	},
	{
		"lineId": "L1652",
		"text": "*   So we can fix, analyze and improve our Products"
	},
	{
		"lineId": "L1657",
		"text": "Information controlled by Meta Platforms Ireland Limited will be transferred or transmitted to, or stored and processed in:"
	},
	{
		"lineId": "L1659",
		"text": "*   Places we have infrastructure or data centers, including the United States, Ireland, Denmark and Sweden, among others"
	},
	{
		"lineId": "L1660",
		"text": "*   Countries where Meta Company Products are available"
	},
	{
		"lineId": "L1661",
		"text": "*   Other countries where our partners, vendors, service providers and other third parties are located outside of the country where you live, for purposes as described in this Policy"
	},
	{
		"lineId": "L1666",
		"text": "We rely on [appropriate mechanisms\\[74\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A9.subpage.3-HowDoWeSafeguard#annotation-74) for international data transfers."
	},
	{
		"lineId": "L1668",
		"text": "We also make sure that appropriate safeguards are in place whenever we transfer your information. For example, we encrypt your information when it’s in transit over public networks to protect it from unauthorized access."
	},
	{
		"lineId": "L1698",
		"text": "We use appropriate mechanisms for international data transfers. For example, for [information we collect](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_ANNOTATION%3A9.ex.2-MechanismsWeUseFor#1-WhatInformationDoWe):"
	},
	{
		"lineId": "L1700",
		"text": "*   We rely on decisions from the European Commission by which they recognise that certain countries and territories outside of the European Economic Area ensure [an adequate level of protection](https://mbasic.facebook.com/privacy/policy/printable/https%3A%2F%2Flm.facebook.com%2Fl.php%3Fu=https%3A%2F%2Fcommission.europa.eu%2Flaw%2Flaw-topic%2Fdata-protection%2Finternational-dimension-data-protection%2Fadequacy-decisions_en%3Fentry_point%3DPOLICY_ANNOTATION%253A9.ex.2-MechanismsWeUseFor) for personal information. These decisions are referred to as “adequacy decisions.” In particular, we transfer [information we collect](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_ANNOTATION%3A9.ex.2-MechanismsWeUseFor#1-WhatInformationDoWe) from the European Economic Area to Argentina, Israel, New Zealand, Switzerland, the UK and, where the decision is applicable, Canada, based on the relevant adequecy decisions. [Learn more\\[75\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_ANNOTATION%3A9.ex.2-MechanismsWeUseFor#annotation-75) about the adequacy decision for each country."
	},
	{
		"lineId": "L1701",
		"text": "*   Meta Platforms, Inc. has certified its participation in the [EU-U.S. and Swiss-U.S. Data Privacy Frameworks](https://mbasic.facebook.com/privacy/policy/printable/https%3A%2F%2Flm.facebook.com%2Fl.php%3Fu=https%3A%2F%2Fwww.dataprivacyframework.gov%2Fs%2Fparticipant-search%2Fparticipant-detail%3Fentry_point%3DPOLICY_ANNOTATION%253A9.ex.2-MechanismsWeUseFor). We rely on the EU-U.S. and Swiss-U.S. Data Privacy Frameworks, and the European Commission's related [adequacy decision](https://mbasic.facebook.com/privacy/policy/printable/https%3A%2F%2Flm.facebook.com%2Fl.php%3Fu=https%3A%2F%2Feur-lex.europa.eu%2Flegal-content%2FEN%2FTXT%2F%3Furi%3DCELEX%253A32023D1795%26entry_point%3DPOLICY_ANNOTATION%253A9.ex.2-MechanismsWeUseFor), for transfers of information to Meta Platforms, Inc. in the U.S. for the products and services specified in that certification. For more information, please review Meta Platforms, Inc.’s [Data Privacy Framework Disclosure](https://www.facebook.com/privacy/policies/data_privacy_framework?entry_point=POLICY_ANNOTATION%3A9.ex.2-MechanismsWeUseFor). To learn more about the Data Privacy Framework (DPF) Program, and to view our certification, please visit the [U.S. Department of Commerce’s Data Privacy Framework Website](https://mbasic.facebook.com/privacy/policy/printable/https%3A%2F%2Flm.facebook.com%2Fl.php%3Fu=https%3A%2F%2Fwww.dataprivacyframework.gov%2F%3Fentry_point%3DPOLICY_ANNOTATION%253A9.ex.2-MechanismsWeUseFor)."
	},
	{
		"lineId": "L1702",
		"text": "*   In other situations, we rely on [standard contractual clauses](https://www.facebook.com/help/566994660333381?ref=dp&entry_point=POLICY_ANNOTATION%3A9.ex.2-MechanismsWeUseFor) approved by the European Commission (and the equivalent standard contractual clauses for the UK, where appropriate) or on derogations provided for under the applicable law to transfer information to a third country."
	},
	{
		"lineId": "L1729",
		"text": "We access, preserve, use and share your information:"
	},
	{
		"lineId": "L1731",
		"text": "*   In response to legal requests, like search warrants, court orders, production orders or subpoenas. These requests come from [third parties\\[76\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SECTION%3A10-HowDoWeRespond#annotation-76) such as civil litigants, law enforcement and other government authorities. [Learn more\\[77\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SECTION%3A10-HowDoWeRespond#annotation-77) about when we respond to legal requests."
	},
	{
		"lineId": "L1732",
		"text": "*   In accordance with applicable law"
	},
	{
		"lineId": "L1733",
		"text": "*   To promote the safety, security and integrity of [Meta Products\\[78\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SECTION%3A10-HowDoWeRespond#annotation-78), users, employees, property and the public. [Learn more\\[79\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SECTION%3A10-HowDoWeRespond#annotation-79)."
	},
	{
		"lineId": "L1745",
		"text": "We respond to legal requests where we’re required by law to do so, and at times where we're not compelled by law, but a response:"
	},
	{
		"lineId": "L1747",
		"text": "*   May affect users in that jurisdiction, and"
	},
	{
		"lineId": "L1748",
		"text": "*   Is consistent with internationally recognized standards including, for example, our [Corporate Human Rights Policy](https://mbasic.facebook.com/privacy/policy/printable/https%3A%2F%2Flm.facebook.com%2Fl.php%3Fu=https%3A%2F%2Fabout.fb.com%2Fwp-content%2Fuploads%2F2021%2F04%2FFacebooks-Corporate-Human-Rights-Policy.pdf%3Fentry_point%3DPOLICY_ANNOTATION%253A10.ex.1-WhenWeRespondTo)."
	},
	{
		"lineId": "L1760",
		"text": "We share your information with law enforcement, government authorities, Meta Companies and other third parties (including industry peers) when we have a good faith belief it’s necessary to detect, prevent and address a variety of situations, such as:"
	},
	{
		"lineId": "L1762",
		"text": "*   Unauthorized use of our Products. [See an example.\\[81\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_ANNOTATION%3A10.ex.2-HowWePromoteSafety#annotation-81)"
	},
	{
		"lineId": "L1766",
		"text": "*   Preventing abuse, fraud, or other harmful or illegal activity, on and off our Products"
	},
	{
		"lineId": "L1768",
		"text": "*   Emergency situations, such as risk of death or imminent bodily harm"
	},
	{
		"lineId": "L1856",
		"text": "Processing information with special protections that you provide so we can share it with those you choose, to provide, personalise and improve our Products and to undertake analytics. We'll collect, store, publish and apply automated, or sometimes manual, processing for these purposes."
	},
	{
		"lineId": "L1862",
		"text": "*   Any information with special protections that you choose to provide, such as your religious views, your sexual orientation, political views, health, racial or ethnic origin, philosophical beliefs or trade union membership, or as part of surveys you choose to participate in, and where you have given your explicit consent"
	},
	{
		"lineId": "L1949",
		"text": "Using information from partners, vendors and other third parties to tailor the ads you see: If we show you ads with your consent we'll use information that partners, vendors and other third parties provide us about activity off the Meta Company Products and that we have associated with you to personalize the ads you see on and across the Meta Company Products, and on websites, apps and devices that use our advertising services. We receive this information whether or not you're logged in or have an account on our Products, see the [Cookies Policy](https://www.facebook.com/policies/cookies/?entry_point=POLICY_SUBSECTION%3A18.1-ConsentWeProcessInformation) for more information."
	},
	{
		"lineId": "L1971",
		"text": "Collecting information that you allow us to receive through the device-based settings you enable (such as access to your GPS location, camera or photos) which we use to provide the features or services described when you enable the setting."
	},
	{
		"lineId": "L2092",
		"text": "The Meta Products are designed to help ensure the safety, integrity and security of those services and those people who enjoy them. We process information we have associated with you and apply automated processing techniques and, in some instances, conduct manual (human) review to:"
	},
	{
		"lineId": "L2094",
		"text": "*   Verify accounts, identity and activity"
	},
	{
		"lineId": "L2095",
		"text": "*   Find and address violations of our terms or policies. In some cases, the decisions we make about violations are reviewed by the [Oversight Board](https://www.oversightboard.com/?entry_point=POLICY_SUBSECTION%3A18.2-PerformanceOfAContract)"
	},
	{
		"lineId": "L2097",
		"text": "*   Detect, prevent and combat harmful or unlawful behavior, such as to review and, in some cases, remove content reported to us"
	},
	{
		"lineId": "L2575",
		"text": "Develop and improve [AI at Meta](https://www.facebook.com/privacy/genai?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely) for Meta Products and for third parties."
	},
	{
		"lineId": "L2579",
		"text": "*   In our interest, and in the interests of users and third parties to create, provide, support, improve and maintain artificial intelligence technology that enables people, businesses and others to express themselves, communicate, and discover and engage with information they’re interested in."
	},
	{
		"lineId": "L2581",
		"text": "*   In our interest, and in the interests of users and third parties to develop and improve artificial intelligence technology while ensuring appropriate safeguards, such as improving model responses for safety and accuracy."
	},
	{
		"lineId": "L2587",
		"text": "*   Interactions with our features that are part of AI at Meta and related metadata. For example, information like content and messages you or others exchange with these features"
	},
	{
		"lineId": "L2761",
		"text": "*   We carry out surveys and use information (including from researchers we collaborate with) to conduct and support research and innovation on topics of general social welfare, technological advancement, public interest, health and well-being."
	},
	{
		"lineId": "L2763",
		"text": "*   We collect, store, combine, analyse and apply automatic processing techniques like aggregation of information as well as manual (human) review, and share information, as necessary to research and innovate for social good in this way."
	},
	{
		"lineId": "L2963",
		"text": "ⓘ For registered users of the Meta Products over the age of majority (18 years of over, in most applicable countries)"
	},
	{
		"lineId": "L2967",
		"text": "Develop and improve [AI at Meta](https://www.facebook.com/privacy/genai?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely) for Meta Products and for third parties."
	},
	{
		"lineId": "L2979",
		"text": "*   [Public content](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely#3.subpage.3-PublicContentWhatContent) you or others create or share, like posts, comments or audio on Meta Products."
	},
	{
		"lineId": "L2980",
		"text": "*   Interactions with our features that are part of AI at Meta and related metadata. For example, information like content and messages you or others exchange with these features"
	},
	{
		"lineId": "L2986",
		"text": "ⓘ If we cannot associate you or your device with a registered user of the Meta Products"
	},
	{
		"lineId": "L3180",
		"text": "*   [Public content](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely#3.subpage.3-PublicContentWhatContent) that you or others create or share, like posts, comments or audio on Meta Products."
	},
	{
		"lineId": "L3181",
		"text": "*   Interactions with our features that are part of AI at Meta and related metadata. For example, information like content and messages you or others exchange with these features"
	},
	{
		"lineId": "L3200",
		"text": "We collect, store, combine, analyse and apply automatic processing techniques like aggregation to information as well as manual (human) review as necessary to undertake research and other tasks in the public interest, such as sharing relevant research data with third parties like international organisations and academics both in and outside the EEA. The public interest is required to be laid down in Union law or Member State law or other applicable law to which we are subject. In this case, we rely on Articles 168 and 179 of the Treaty on the Functioning of the European Union."
	},
	{
		"lineId": "L3317",
		"text": "*   **We use your information to determine the ad interests most relevant to you.** We try to predict your ad interests based on the information we have, including any choices you've made in Ad preferences."
	},
	{
		"lineId": "L3319",
		"text": "*   **We review the potential ads that we could show you to identify the most relevant ones.** Our ads system automatically reviews all the potential ads where you might fit the audience that advertisers want to reach. For example, you may see potential ads because you match the age range and interest category. We determine which ones to show you based on things like whether it best achieves the advertiser’s goal and is most relevant to you. To do this, we use algorithms and machine learning to order the ads we may show you. We use different factors such as the ad quality, the advertiser's desired audience and budget. We also consider how likely we think it is that you will react to the ad based on things like your activity on Meta Products. [Learn more](https://www.facebook.com/help/447278887528796?entry_point=POLICY_ANNOTATION%3A11.ex.1-HowOurAdsSystemWorks)."
	},
	{
		"lineId": "L3320",
		"text": "*   **All of this information helps us show you the most relevant ads.** When you see ads on Meta Company Products, we use this process to choose the most relevant ad to show you."
	}
]
```

<!-- END GROUNDED_TRANSCRIPT -->
