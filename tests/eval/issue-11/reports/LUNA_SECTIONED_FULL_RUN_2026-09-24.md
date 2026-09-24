# GPT-6 Luna: bounded-section full-policy test

**Bottom line:** Bounded slices cited **6/6 selected claim anchors**, versus **1/6** in the earlier one-call-per-policy grounded run. The previously missed Facebook no-sale statement and four privacy-rights claims now appear with their key conditions. This is evidence of improvement on those selected omissions, **not** a measured overall recall gain. The new output is much larger (229 findings versus 75 before) and still has one invalid citation.

This was not an isolated A/B test of chunking: the section-oriented instruction also explicitly mentioned negative claims and individual rights, and the total output budget increased. We cannot attribute the selected-claim gain to any one change.

The invalid citation is `L0895` in a Facebook qualification about reporting posts and managing tags. That line is blank, so code could not copy it. The same qualification refers to control links on nearby lines that it did not cite precisely. This is a real evidence error, not a formatting-only issue. The six checklist examples were spot-checked for their stated core claim and conditions; the remaining findings have **not** received claim-by-claim human review.

## Run setup and cost

One `gpt-6-luna` medium-reasoning pass over the same pinned, complete Spotify and Facebook archived Markdown policies. The code partitioned each policy into non-overlapping core line ranges of at most 25,000 source bytes, usually ending at a heading or paragraph break, with three neighboring lines on each side as qualification context. The successful Spotify calls had an 8,000-token output cap; successful Facebook calls had a 6,400-token cap. The model saw only a bounded slice per call, not the withheld checklist. It cited original policy line IDs; code copied the exact raw lines. There was no merge-model call or automatic retry.

The result combines **15 successful calls** from two local logs after smaller output caps caused incomplete responses. Estimated token cost for the successful calls was **$0.04478**; including all stopped attempts, **$0.04992** in reported token usage (not an invoice). The revised Facebook-only dry run had a conservative **$0.08654** ceiling, and the combined conservative allowance for this experiment remained below $0.10. Pricing uses the [official GPT-6 Luna rates](https://developers.openai.com/api/docs/models/gpt-6-luna).

The all-attempt figure consists of $0.00013 from the first stopped attempt's one complete response, $0.00501 from three incomplete responses across both stopped attempts, and $0.04478 from the 15 successful final responses. The DNS-failed request never reached the provider and has no reported usage.

| Policy                       | Calls | Findings | Estimated token cost | Schema issues | Reference issues |
| ---------------------------- | ----: | -------: | -------------------: | ------------: | ---------------: |
| spotify-full-privacy-policy  |     2 |       73 |             $0.00813 |             0 |                0 |
| facebook-full-privacy-policy |    13 |      156 |             $0.03666 |             0 |                1 |

## Known-claim coverage check

This is a **small manually selected anchor checklist**, not comprehensive gold labels. “Cited” means at least one finding or qualification referenced the listed source line; it does not prove the claim was interpreted correctly. The checklist was not sent to Luna. The prior comparison is the one-call-per-policy grounded run.

| Claim                                                                            | Source anchor | Prior grounded run | Bounded-section run |
| -------------------------------------------------------------------------------- | ------------- | ------------------ | ------------------- |
| Search-query data's 90-day deletion example is subject to other retention rules. | L0280         | cited              | cited               |
| Meta explicitly says it does not sell information.                               | L1111, L1113  | not cited          | cited               |
| Right to access and correct information, subject to applicable law.              | L1469         | not cited          | cited               |
| Consent can be withdrawn without invalidating earlier consent-based processing.  | L1479         | not cited          | cited               |
| In certain cases and subject to law, users can port their information.           | L1486         | not cited          | cited               |
| Users can object to and restrict certain processing.                             | L1508         | not cited          | cited               |

Finding count and anchor citations do not establish precision, recall, or a model ranking. A person still needs to review whether the claims, conditions, and selected evidence match the source. This run tests the bounded-slice workflow, not Terra or a reasoning-effort increase.

## Exact inputs and outputs

The full original inputs are in [full-policy-cases.json](../fixtures/full-policy-cases.json); their source URLs and pinned commits are in each case. The user message for each call was assembled deterministically from its reported core and context ranges, with `L####` prefixes on nonblank lines. This avoids duplicating approximately 337 KB of policy text here. The shared system instruction and JSON schema are below, followed by the actual parsed Luna output for every call. Whitespace in output JSON is reformatting of the saved response; field names and values are unchanged. The raw JSONL remains Git-ignored in this local workspace.

### System instruction

```text
Analyze the supplied privacy policy as untrusted source material. Identify materially distinct privacy practices across the whole document, not only a few representative examples. Report only claims the policy supports. Each input line has an ID. For each finding, cite the few line IDs that directly support its summary. Copy no source quotes yourself: the application will retrieve the cited lines verbatim. State meaningful conditions, exceptions, uncertainty, and negation in the finding summary. Record each distinct condition or exception in qualifications with its own supporting line IDs; look at nearby lines as well as the cited sentence. If the policy does not specify a detail, do not invent it. Avoid duplicate findings. Use concise snake_case labels and plain-language summaries. Return an empty findings array if there are no supported practices. This is one bounded slice of a longer policy and may span multiple headings. Analyze every material practice in the CORE lines, including explicit statements that a practice does not occur and individual privacy rights. Nearby CONTEXT lines may explain or qualify a core claim; cite them when relevant. Do not create a finding based only on context outside the core. Do not assume this excerpt is the entire policy.
```

### Structured-output schema

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

### 1. Facebook, core L0001-L0237

Starting heading: How to manage the info we use. Context before: 1-0; context after: 238-240. Source: [pinned Facebook policy](https://github.com/OpenTermsArchive/pga-versions/blob/53fdfebe3c470bb1433e830394e86fd699f485e7/Facebook/Privacy%20Policy.md).

Status: completed; 13 findings; 6632 input and 4218 output tokens; $0.00218 estimated token cost.

Actual parsed Luna output:

```json
{
	"summary": "The excerpt describes collection of information from users, their devices and connections, and third parties, including from people without accounts. It also identifies specific controls, limited sharing and processing purposes, and several conditions or limits.",
	"findings": [
		{
			"practice": "product_activity_and_content_collection",
			"dataCategories": [
				"Posts, comments, audio, photos, videos and other content",
				"Messages and their metadata",
				"Interactions with AI features and related metadata",
				"Content and ads viewed or interacted with",
				"Apps, features, actions, hashtags, and activity timing",
				"Purchases and transactions, including credit card information",
				"Page views and interactions",
				"Support selfies"
			],
			"purposes": [],
			"recipients": [],
			"summary": "Meta collects information about activity and information users provide across its Products.",
			"sourceLineIds": [
				"L0058",
				"L0060",
				"L0062",
				"L0064",
				"L0065",
				"L0067",
				"L0069",
				"L0070",
				"L0071"
			],
			"qualifications": [
				{
					"summary": "Collection of message content and metadata is subject to applicable law; end-to-end encrypted messaging is available on some Products.",
					"sourceLineIds": ["L0062", "L0063"]
				},
				{
					"summary": "Page views and interactions are used to provide Page admins aggregated information about Page use; Meta says it is jointly responsible with Page admins for this processing.",
					"sourceLineIds": ["L0070"]
				},
				{
					"summary": "A photo or video selfie is collected if the user provides it when contacting Meta for account support.",
					"sourceLineIds": ["L0071"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "account_registration_information",
			"dataCategories": [
				"Password",
				"Email address or phone number",
				"Age and gender",
				"Optional profile photo or payment information"
			],
			"purposes": ["Creating a Facebook account"],
			"recipients": [],
			"summary": "Creating a Facebook account requires some information, and users may add further account details.",
			"sourceLineIds": ["L0217"],
			"qualifications": [
				{
					"summary": "A profile photo or payment information may be added optionally; the policy does not say these are required.",
					"sourceLineIds": ["L0217"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "voluntary_sensitive_information",
			"dataCategories": [
				"Religious views",
				"Sexual orientation",
				"Political views",
				"Health information",
				"Racial or ethnic origin",
				"Philosophical beliefs",
				"Trade union membership"
			],
			"purposes": [],
			"recipients": [],
			"summary": "Users might choose to provide information in sensitive categories, which the policy says receive special protections under the laws of the user's country.",
			"sourceLineIds": ["L0078"],
			"qualifications": [
				{
					"summary": "The policy describes providing this information as a user choice, not as required.",
					"sourceLineIds": ["L0078"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "connections_and_uploaded_contacts",
			"dataCategories": [
				"Information about friends, followers, groups, accounts, Pages, users and communities",
				"Interactions with connections and which connections users interact with most",
				"Uploaded contacts' names, email addresses or phone numbers"
			],
			"purposes": [],
			"recipients": [],
			"summary": "Meta collects information about users' connections and interactions, and may collect contact details when a user uploads or imports contacts.",
			"sourceLineIds": ["L0086", "L0091"],
			"qualifications": [
				{
					"summary": "Contact information is collected if the user chooses to upload or import it, such as by syncing an address book; information about people without accounts may still be collected.",
					"sourceLineIds": ["L0091", "L0093"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "inferences_from_others_activity",
			"dataCategories": [
				"Information about a person derived from other people's activity",
				"Contact or connection-list overlap",
				"Friends' group memberships"
			],
			"purposes": ["Suggesting people to know or follow", "Suggesting groups to join"],
			"recipients": [],
			"summary": "Meta collects and infers information about a person based on other people's activity, including to make friend or group suggestions.",
			"sourceLineIds": ["L0100", "L0102", "L0104", "L0105"],
			"qualifications": [
				{
					"summary": "A friend suggestion may occur when both people appear on a contact or connection list uploaded by someone.",
					"sourceLineIds": ["L0104"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "device_and_location_information",
			"dataCategories": [
				"Device and software characteristics",
				"Device activity and identifiers",
				"Device signals and settings information",
				"GPS location, camera access, photos and related metadata",
				"Network information and IP address",
				"Location-related information",
				"Product performance information",
				"Cookie and similar-technology information"
			],
			"purposes": ["Distinguishing devices", "Helping tell humans from bots"],
			"recipients": [],
			"summary": "Meta collects or receives information about users' devices, their activity and settings, their networks, and their use of Products.",
			"sourceLineIds": [
				"L0110",
				"L0114",
				"L0115",
				"L0116",
				"L0117",
				"L0118",
				"L0119",
				"L0121",
				"L0122"
			],
			"qualifications": [
				{
					"summary": "Some location-related information may be collected even when Location Services is off, including an estimate of general location based on IP address.",
					"sourceLineIds": ["L0120"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "partner_and_third_party_information",
			"dataCategories": [
				"Device information",
				"Websites visited and cookie data",
				"Apps and games used",
				"Off-Product purchases and transactions",
				"Ads seen and interactions with ads",
				"Use of third-party products and services online or in person",
				"Email address, cookies and advertising device ID",
				"Partner communications with users"
			],
			"purposes": [
				"Matching activity with an account, if the person has one",
				"Providing and personalizing content and ads",
				"Providing services to a business when it instructs Meta to do so"
			],
			"recipients": [],
			"summary": "Meta receives information about people's activities on and off its Products from partners, vendors and other third parties, and may receive partner communications with users when instructed to provide a business service.",
			"sourceLineIds": [
				"L0130",
				"L0134",
				"L0135",
				"L0136",
				"L0137",
				"L0138",
				"L0139",
				"L0140",
				"L0142",
				"L0146"
			],
			"qualifications": [
				{
					"summary": "Meta says it receives this information whether or not a person is logged in or has an account.",
					"sourceLineIds": ["L0144"]
				},
				{
					"summary": "Partners collect information through their sites, apps, services, or other organizations they work with; Meta says it requires partners to have the right to collect, use and share the information before providing it.",
					"sourceLineIds": ["L0156", "L0158"]
				},
				{
					"summary": "Meta processes certain information received from partners as a joint controller with them; this does not describe all partner information.",
					"sourceLineIds": ["L0160"]
				},
				{
					"summary": "Users can adjust Cookie settings to control use of certain partner information for providing and personalizing content and ads.",
					"sourceLineIds": ["L0142"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "cross_site_cookie_collection_control",
			"dataCategories": [
				"Information about activity on other websites and apps",
				"Information collected through cookies and similar technologies"
			],
			"purposes": ["Collection of activity information through cookies and similar technologies"],
			"recipients": [],
			"summary": "Cookie settings let users choose whether Meta may use cookies and similar technologies to collect information about their activity on other websites and apps.",
			"sourceLineIds": ["L0007"],
			"qualifications": [
				{
					"summary": "The described collection includes websites and apps from partners that use Meta Business Tools.",
					"sourceLineIds": ["L0007"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "cross_account_information_use_control",
			"dataCategories": ["Information associated with accounts on different Meta Products"],
			"purposes": ["Combining and using information across accounts on different Products"],
			"recipients": [],
			"summary": "Users can use Accounts Center to choose whether Meta combines and uses their information across accounts on different Products.",
			"sourceLineIds": ["L0006"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "collection_from_people_without_accounts",
			"dataCategories": [
				"Browser and app logs of visits to public content",
				"Basic information about devices that downloaded Meta apps",
				"Information received through cookies and similar technologies when visiting third-party sites and apps using Meta Business Tools or other Meta Products"
			],
			"purposes": [
				"Monitoring attempted attacks and preventing scraping",
				"Safety and integrity enforcement",
				"Measuring page loading speed and whether Products work properly"
			],
			"recipients": [
				"Law enforcement, when Meta believes there is a genuine risk of death or imminent bodily harm"
			],
			"summary": "Meta collects information when people use or interact with its Products without an account, including for security, safety and performance; it may take action against such people under its Community Standards and may share information with law enforcement in a stated emergency circumstance.",
			"sourceLineIds": ["L0192", "L0194", "L0195", "L0197", "L0204", "L0208", "L0212"],
			"qualifications": [
				{
					"summary": "The policy gives attempted attacks and excessive page loading that may indicate scraping as examples of security concerns.",
					"sourceLineIds": ["L0204"]
				},
				{
					"summary": "Sharing with law enforcement is described for when Meta believes there is a genuine risk of death or imminent bodily harm.",
					"sourceLineIds": ["L0208"]
				},
				{
					"summary": "Performance collection is described as helping identify and fix local network issues.",
					"sourceLineIds": ["L0212"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "deidentified_information_use",
			"dataCategories": ["Information de-identified, aggregated or anonymized by third parties"],
			"purposes": ["Use as described in the policy"],
			"recipients": [],
			"summary": "Meta uses some information made available by third parties after it has been de-identified, aggregated or anonymized.",
			"sourceLineIds": ["L0172"],
			"qualifications": [
				{
					"summary": "The policy says this information no longer identifies individuals before it is made available to Meta, and Meta does not try to re-identify individuals from it.",
					"sourceLineIds": ["L0172"]
				}
			],
			"ambiguous": false,
			"negated": true
		},
		{
			"practice": "camera_face_and_body_processing",
			"dataCategories": [
				"Parts of faces or bodies in a camera frame, photo or video",
				"Camera information used for effects"
			],
			"purposes": [
				"Creating or applying camera features, including filters, effects, masks and avatars"
			],
			"recipients": [],
			"summary": "Certain camera features process parts of faces or bodies to create or apply the feature, such as fitting a mask.",
			"sourceLineIds": ["L0228", "L0233"],
			"qualifications": [
				{
					"summary": "This processing occurs on certain Meta Products when a user uses the camera or allows access to photos and videos.",
					"sourceLineIds": ["L0233"]
				},
				{
					"summary": "The policy explicitly says information used for this process is not used to identify the person.",
					"sourceLineIds": ["L0233"]
				}
			],
			"ambiguous": false,
			"negated": true
		},
		{
			"practice": "required_and_optional_information",
			"dataCategories": ["Information required for Products to work", "Optional information"],
			"purposes": ["Operating Meta Products"],
			"recipients": [],
			"summary": "Some information is required for Meta Products to work, while other information is optional.",
			"sourceLineIds": ["L0165"],
			"qualifications": [
				{
					"summary": "The policy says that omitting optional information might affect the quality of the user's experience, but does not identify all required or optional information here.",
					"sourceLineIds": ["L0165"]
				}
			],
			"ambiguous": true,
			"negated": false
		}
	]
}
```

Exact cited source lines copied by code:

```json
[
	{
		"lineId": "L0006",
		"text": "*   [Accounts Center](https://accountscenter.facebook.com/) to choose whether we combine and use your information across accounts on different Products"
	},
	{
		"lineId": "L0007",
		"text": "*   [Cookie settings](https://mbasic.facebook.com/privacy/policy/logging/?target=POLICY_PLATFORM_LINK_COLLECTION%3ACOOKIE_SETTINGS&element=privacy_policy_inline_text&redirect_uri=https%3A%2F%2Fmbasic.facebook.com%2Fprivacy%2Fpolicy%2Fprintable%2F%3Fback_id%3Dlink-collection-0%26link_dialog%3DCOOKIE_SETTINGS%26entry%3D0) to choose whether we can use cookies and similar technologies to collect information about your activity on other websites and apps. This includes websites and apps from partners that use our Business Tools."
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
		"lineId": "L0064",
		"text": "*   Interactions with our features that are part of [AI at Meta](https://www.facebook.com/privacy/genai?entry_point=POLICY_SUBPAGE%3A1.subpage.1-YourActivityAndInformation) and related metadata. For example, information like content and messages you or others exchange with these features. [Learn more.\\[8\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A1.subpage.1-YourActivityAndInformation#annotation-8)"
	},
	{
		"lineId": "L0065",
		"text": "*   Types of content, including ads, you view or interact with, and how you interact with it."
	},
	{
		"lineId": "L0067",
		"text": "*   Purchases or other transactions you make, such as through Meta checkout experiences, including credit card information. [Learn more\\[10\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A1.subpage.1-YourActivityAndInformation#annotation-10)."
	},
	{
		"lineId": "L0069",
		"text": "*   The time, frequency and duration of your activities on our Products."
	},
	{
		"lineId": "L0070",
		"text": "*   Views of and interactions with a Facebook Page and its content, to provide the Page admin with aggregated information about how people use their Page and its content. Meta is jointly responsible with Page admins. [Learn more](https://www.facebook.com/legal/terms/information_about_page_insights_data?entry_point=POLICY_SUBPAGE%3A1.subpage.1-YourActivityAndInformation) about the joint processing for Page Insights."
	},
	{
		"lineId": "L0071",
		"text": "*   Your photo or video selfie if you provide it when you contact us for account support."
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
		"lineId": "L0102",
		"text": "We also infer things about you based on others' activity. For example:"
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
		"lineId": "L0117",
		"text": "*   Signals from your device. [See examples\\[15\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A1.subpage.3-AppBrowserAndDevice#annotation-15)."
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
		"lineId": "L0121",
		"text": "*   Information about our Products’ performance on your device. [Learn more\\[19\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A1.subpage.3-AppBrowserAndDevice#annotation-19)."
	},
	{
		"lineId": "L0122",
		"text": "*   Information from cookies and similar technologies. [Learn more.\\[20\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A1.subpage.3-AppBrowserAndDevice#annotation-20)"
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
		"lineId": "L0136",
		"text": "*   Apps you use"
	},
	{
		"lineId": "L0137",
		"text": "*   Games you play"
	},
	{
		"lineId": "L0138",
		"text": "*   Purchases and transactions you make off of our Products using non-Meta checkout experiences"
	},
	{
		"lineId": "L0139",
		"text": "*   The ads you see and how you interact with them (if we show you ads)"
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
		"lineId": "L0146",
		"text": "Partners also share with us their communications with you if they instruct us to provide services to their business, like helping them manage their communications. To learn how a business processes or shares your information, read their privacy policy or contact them directly."
	},
	{
		"lineId": "L0156",
		"text": "Partners use our [Business Tools](https://www.facebook.com/help/331509497253087/?entry_point=POLICY_SUBPAGE%3A1.subpage.4-InformationFromPartnersVendors), integrations and Meta Audience Network technologies to share information with us."
	},
	{
		"lineId": "L0158",
		"text": "These partners collect your information when you visit their site or app or use their services, or through other businesses or organizations they work with. We require partners to have the right to collect, use and share your information before giving it to us."
	},
	{
		"lineId": "L0160",
		"text": "We process certain information we receive from partners as a joint controller with them. [Learn more](https://www.facebook.com/legal/controller_addendum?entry_point=POLICY_SUBPAGE%3A1.subpage.4-InformationFromPartnersVendors) about our arrangements with these partners."
	},
	{
		"lineId": "L0165",
		"text": "Some information is required for our Products to work. Other information is optional, but without it, the quality of your experience might be affected."
	},
	{
		"lineId": "L0172",
		"text": "In some cases information is de-identified, aggregated, or anonymized by third parties so that it no longer identifies individuals before it’s made available to us. We use this information as described below without trying to re-identify individuals."
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
		"lineId": "L0217",
		"text": "For example, when you create a Facebook account, you must provide some information, like a password and your email address or phone number, age and gender. You might choose to add other details to your account, like a profile photo or payment information."
	},
	{
		"lineId": "L0228",
		"text": "José likes using Instagram’s Camera feature to take pictures of his flower garden. We collect information about how José uses the Camera feature. For example, if he chooses a background effect for the photo he’s about to take, we collect information from the camera so we can apply the effect to his photo."
	},
	{
		"lineId": "L0233",
		"text": "If you use our camera or allow access to photos and videos, on certain Meta Products you can add filters, effects, masks or avatars. Some of these features process parts of faces or bodies within the camera frame, photo or video. Then they can do things like fit a mask correctly over the eyes, nose and mouth. The information we use for this process is used to create the feature. It’s not used to identify you."
	}
]
```

### 2. Facebook, core L0238-L0461

Starting heading: What information do we collect?. Context before: 235-237; context after: 462-464. Source: [pinned Facebook policy](https://github.com/OpenTermsArchive/pga-versions/blob/53fdfebe3c470bb1433e830394e86fd699f485e7/Facebook/Privacy%20Policy.md).

Status: completed; 14 findings; 3950 input and 4788 output tokens; $0.00289 estimated token cost.

Actual parsed Luna output:

```json
{
	"summary": "The excerpt describes collection of voice and AI interactions, activity and transaction information, device and network data, cookie data, and information from other people and third parties. It also describes uses of some of that information, including product operation, personalization, advertising, safety, and AI development. Several practices depend on user settings, permissions, or choices.",
	"findings": [
		{
			"practice": "voice_interactions",
			"dataCategories": ["Voice interactions", "Background sound captured during a voice command"],
			"purposes": [
				"Provide the voice-enabled Assistant",
				"Improve the Assistant, depending on settings"
			],
			"recipients": [],
			"summary": "Meta collects voice interactions with its voice-enabled Assistant, including background sound occurring during a command, to provide the feature and, depending on the user’s settings, improve it.",
			"sourceLineIds": ["L0238"],
			"qualifications": [
				{
					"summary": "The example describes collection while the Assistant is activated and listening; a visual indicator is shown.",
					"sourceLineIds": ["L0238"]
				},
				{
					"summary": "Improving the Assistant depends on the user’s settings.",
					"sourceLineIds": ["L0238"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "ai_feature_interactions",
			"dataCategories": [
				"Prompts, including questions, messages, media, and other shared information",
				"AI responses and other information received from AI features",
				"Information from third-party apps and services connected to AI features",
				"Feedback and responses to feedback",
				"Information used to personalize AI features",
				"Information about users from third-party apps and services connected to Meta Products"
			],
			"purposes": ["Use AI at Meta features and experiences", "Personalize AI features"],
			"recipients": [],
			"summary": "When users or others use, exchange information with, or cause actions through AI at Meta features, Meta collects and uses the listed interaction information. Some responses may be provided with help from AI integrations.",
			"sourceLineIds": ["L0249", "L0251", "L0253", "L0254", "L0255", "L0256", "L0257", "L0258"],
			"qualifications": [
				{
					"summary": "Information from third-party apps and services is included when users choose to connect those services to the features or Meta Products.",
					"sourceLineIds": ["L0255", "L0258"]
				},
				{
					"summary": "Some responses are provided with the help of AI integrations.",
					"sourceLineIds": ["L0254"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "product_activity_logs",
			"dataCategories": [
				"Content viewed or interacted with on Meta Products",
				"Features accessed in messaging products",
				"Use of Social Plugins, Facebook Login, in-app browser link history, and autofill"
			],
			"purposes": ["Log use of apps and features"],
			"recipients": [],
			"summary": "Meta logs what users view or interact with on its Products, which messaging features they access, and certain uses of Social Plugins, Facebook Login, in-app browser link history, and autofill.",
			"sourceLineIds": ["L0263", "L0265", "L0266", "L0267"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "transaction_information",
			"dataCategories": [
				"Financial account information",
				"Billing, shipping, and contact details",
				"Items purchased and quantities",
				"Account and authentication information",
				"Purchase and financial transaction details"
			],
			"purposes": [
				"Facilitate purchases, payments, and other financial transactions",
				"Personalize the experience on Meta Products",
				"Advertising",
				"Provide access to payment and transaction history",
				"Provide faster and easier payment experiences"
			],
			"recipients": [],
			"summary": "When users buy or sell through Meta Products or make or receive financial transactions, Meta collects and stores information about those transactions for the stated purposes.",
			"sourceLineIds": ["L0272", "L0284", "L0286", "L0287", "L0288", "L0289", "L0293"],
			"qualifications": [
				{
					"summary": "Access to payment and transaction history is provided where available.",
					"sourceLineIds": ["L0293"]
				},
				{
					"summary": "Storing information to provide faster and easier payment experiences depends on the user’s choices.",
					"sourceLineIds": ["L0293"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "content_and_message_metadata",
			"dataCategories": [
				"Content metadata, such as photo location or file creation date",
				"Message metadata, such as message type or date and time sent"
			],
			"purposes": [],
			"recipients": [],
			"summary": "Meta collects metadata about content and messages, including examples such as where a photo was taken, when a file was created, the type of message, and when it was sent. The excerpt does not state a purpose for this metadata collection.",
			"sourceLineIds": ["L0240", "L0243", "L0244"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "information_from_others_activity",
			"dataCategories": [
				"Information about the user in photos, comments, messages, conversations, contact or connection lists, game invitations, connections, blocks, and reports",
				"Messages and content shared by the user that others provide to AI at Meta"
			],
			"purposes": [
				"Collect information about users on Meta Products when others take the described actions"
			],
			"recipients": [],
			"summary": "Meta collects information about a user when other people interact with or provide information about that user on Meta Products, including sharing tagged photos, messaging, uploading contact or connection information, connecting with, blocking, or reporting the user, or providing information to AI at Meta.",
			"sourceLineIds": [
				"L0308",
				"L0310",
				"L0311",
				"L0312",
				"L0313",
				"L0314",
				"L0315",
				"L0316",
				"L0317"
			],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "device_and_network_information",
			"dataCategories": [
				"Device type, operating system, hardware, software, brand, and model",
				"Battery level, signal strength, storage, browser type, app and file names and types, and plugins",
				"Device and advertising identifiers",
				"GPS, Bluetooth, nearby Wi-Fi, beacon, and cell-tower signals",
				"Internet service provider or mobile operator, language, time zone, phone number, IP address, connection speed, network capability, nearby or networked devices, and Wi-Fi hotspots"
			],
			"purposes": [
				"Improve the user’s experience",
				"Support interactions between devices on the same network"
			],
			"recipients": [],
			"summary": "Meta collects information about users’ devices, identifiers, device signals, and network and internet connections. The excerpt gives improving the experience as one reason for collecting network information and describes using shared-network information to help a phone control a video stream on a TV.",
			"sourceLineIds": [
				"L0322",
				"L0324",
				"L0325",
				"L0326",
				"L0327",
				"L0328",
				"L0329",
				"L0330",
				"L0331",
				"L0332",
				"L0333",
				"L0338",
				"L0343",
				"L0360",
				"L0362",
				"L0363",
				"L0364",
				"L0365",
				"L0366",
				"L0367",
				"L0368",
				"L0369",
				"L0370",
				"L0372"
			],
			"qualifications": [
				{
					"summary": "Improving the experience is identified as one reason for collecting network and connection information; the example concerns devices connected to the same network.",
					"sourceLineIds": ["L0372"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "camera_roll_metadata",
			"dataCategories": ["Photo and video metadata, including date and time created"],
			"purposes": ["Remind users when they have new photos to upload"],
			"recipients": [],
			"summary": "Meta collects metadata from and about photos and videos in a device’s camera roll and uses it for purposes such as reminding users about new photos to upload.",
			"sourceLineIds": ["L0348"],
			"qualifications": [
				{
					"summary": "This collection is described as occurring if the user gives Meta permission to access the device’s camera roll.",
					"sourceLineIds": ["L0348"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "device_performance_diagnostics",
			"dataCategories": [
				"App runtime duration",
				"Device model",
				"Other performance and diagnostic information"
			],
			"purposes": ["Prevent, diagnose, troubleshoot, and fix errors and bugs"],
			"recipients": [],
			"summary": "Meta collects device and performance information to prevent, diagnose, troubleshoot, and fix errors and bugs in its Products.",
			"sourceLineIds": ["L0382"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "cookies_and_similar_technologies",
			"dataCategories": [
				"Cookie IDs and settings",
				"Identifiers associated with devices and software",
				"Information stored on browsers or devices through cookies and similar technologies"
			],
			"purposes": [
				"Provide, protect, and improve Products",
				"Personalize content",
				"Tailor and measure ads",
				"Provide a safer experience"
			],
			"recipients": [],
			"summary": "Meta uses cookies and similar technologies, including the Meta Pixel and Social Plugins, and collects information from cookies stored on users’ devices. The stated purposes include personalizing content, tailoring and measuring ads, and providing a safer experience.",
			"sourceLineIds": ["L0387", "L0389"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "partner_business_tools",
			"dataCategories": [
				"Information about how people use partner products and services",
				"Information used to measure ad performance"
			],
			"purposes": [
				"Help businesses advertise or support their products",
				"Help partners understand and measure product and service use and ad performance",
				"Monetize apps by showing ads"
			],
			"recipients": [],
			"summary": "Businesses and other partners use Meta Products and Business Tools to advertise or support products and to understand and measure use of their products and services and how well their ads work. Examples include the Meta Pixel on websites and Audience Network tools used to show ads in apps.",
			"sourceLineIds": ["L0398"],
			"qualifications": [
				{
					"summary": "The excerpt describes partners’ use of Meta tools and the tools’ measurement functions; it does not specify what information is sent to any particular recipient.",
					"sourceLineIds": ["L0398"]
				}
			],
			"ambiguous": true,
			"negated": false
		},
		{
			"practice": "information_received_from_third_parties",
			"dataCategories": ["Information about users; specific categories are not stated"],
			"purposes": ["Collect and receive information from third parties"],
			"recipients": [],
			"summary": "Meta collects and receives information from third parties that may not use Meta Products, including public sources, industry peers, marketing and advertising vendors and data providers, content providers, law enforcement, government authorities, professional and nonprofit groups, and research institutions. The excerpt does not specify the information categories involved.",
			"sourceLineIds": [
				"L0419",
				"L0421",
				"L0422",
				"L0423",
				"L0424",
				"L0425",
				"L0426",
				"L0427",
				"L0428"
			],
			"qualifications": [],
			"ambiguous": true,
			"negated": false
		},
		{
			"practice": "public_and_research_datasets",
			"dataCategories": [
				"Datasets from publicly available sources, research institutions, data providers, and professional and nonprofit groups"
			],
			"purposes": [
				"Detect and stop scraping that violates Meta’s terms",
				"Promote safety, security, and integrity",
				"Improve AI technologies and support AI research and product development",
				"Conduct analytics",
				"Engage with survey respondents who choose additional conversations"
			],
			"recipients": [],
			"summary": "Meta obtains datasets from public sources and specified research, data-provider, professional, and nonprofit sources and uses them for the listed safety, AI, analytics, and research-related purposes.",
			"sourceLineIds": ["L0432", "L0434", "L0435", "L0436", "L0437", "L0438"],
			"qualifications": [
				{
					"summary": "Engaging with research survey respondents applies to those who choose to participate in additional conversations.",
					"sourceLineIds": ["L0438"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "information_required_for_product_access",
			"dataCategories": ["Email address", "Phone number", "Age", "Friend connections"],
			"purposes": [
				"Create an account for use of Meta Products",
				"Populate Facebook Feed with friends’ photos and status updates"
			],
			"recipients": [],
			"summary": "If a user does not provide an email address, phone number, or age, Meta says it will not be able to create an account for that user. A user may choose not to add Facebook friends, but then their Feed will not show friends’ photos and status updates.",
			"sourceLineIds": ["L0448", "L0450"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		}
	]
}
```

Exact cited source lines copied by code:

```json
[
	{
		"lineId": "L0238",
		"text": "Ren tells Meta’s voice-enabled Assistant to take a photo on smart glasses. A visual indicator shows that Assistant is activated and listening for Ren’s command. We collect this voice interaction, which includes any background sound that occurs when Ren says the command. Collecting Ren’s voice interactions lets us provide and, depending on Ren’s settings, improve the Assistant feature."
	},
	{
		"lineId": "L0240",
		"text": "Metadata"
	},
	{
		"lineId": "L0243",
		"text": "*   Information about the content itself, like the location where a photo was taken or the date a file was created"
	},
	{
		"lineId": "L0244",
		"text": "*   Information about the message itself, like the type of message or the date and time it was sent"
	},
	{
		"lineId": "L0249",
		"text": "Across Meta Company Products, you can interact with Meta’s generative AI features and experiences that are part of [AI at Meta](https://www.facebook.com/privacy/genai?entry_point=POLICY_ANNOTATION%3A1.ex.62-InformationYouOrOthersExchange)."
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
		"lineId": "L0263",
		"text": "For example, we log:"
	},
	{
		"lineId": "L0265",
		"text": "*   What apps, posts, videos, ads, games, Shops and other content you view or interact with on our Products"
	},
	{
		"lineId": "L0266",
		"text": "*   What features you access from our messaging products"
	},
	{
		"lineId": "L0267",
		"text": "*   When you use [Social Plugins](https://developers.facebook.com/products/social-plugins/?entry_point=POLICY_ANNOTATION%3A1.ex.12-AppsAndFeaturesYou), [Facebook Login](https://developers.facebook.com/products/facebook-login/?entry_point=POLICY_ANNOTATION%3A1.ex.12-AppsAndFeaturesYou), in-app browser link history or autofill"
	},
	{
		"lineId": "L0272",
		"text": "We collect information when you use our Products to buy or sell things or make or receive financial transactions."
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
		"lineId": "L0308",
		"text": "For example, we collect information about you on Meta Products when others:"
	},
	{
		"lineId": "L0310",
		"text": "*   Share or comment on a photo you’re tagged in"
	},
	{
		"lineId": "L0311",
		"text": "*   Send you a message"
	},
	{
		"lineId": "L0312",
		"text": "*   Invite you to join a conversation"
	},
	{
		"lineId": "L0313",
		"text": "*   Upload their contact or connection information, such as an address book or follower list"
	},
	{
		"lineId": "L0314",
		"text": "*   Invite you to play a game"
	},
	{
		"lineId": "L0315",
		"text": "*   Connect with you, for example, as a friend or follower"
	},
	{
		"lineId": "L0316",
		"text": "*   Block or report you"
	},
	{
		"lineId": "L0317",
		"text": "*   Provide information about you to [AI at Meta](https://www.facebook.com/privacy/genai?entry_point=POLICY_ANNOTATION%3A1.ex.20-WhenWeCollectInformation), including messages and content you have shared. [See examples\\[8\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_ANNOTATION%3A1.ex.20-WhenWeCollectInformation#annotation-8)."
	},
	{
		"lineId": "L0322",
		"text": "We collect device information like:"
	},
	{
		"lineId": "L0324",
		"text": "*   The type of device"
	},
	{
		"lineId": "L0325",
		"text": "*   Details about its operating system"
	},
	{
		"lineId": "L0326",
		"text": "*   Details about its hardware and software"
	},
	{
		"lineId": "L0327",
		"text": "*   Brand and model"
	},
	{
		"lineId": "L0328",
		"text": "*   Battery level"
	},
	{
		"lineId": "L0329",
		"text": "*   Signal strength"
	},
	{
		"lineId": "L0330",
		"text": "*   Available storage"
	},
	{
		"lineId": "L0331",
		"text": "*   Browser type"
	},
	{
		"lineId": "L0332",
		"text": "*   App and file names and types"
	},
	{
		"lineId": "L0333",
		"text": "*   Plugins"
	},
	{
		"lineId": "L0338",
		"text": "Identifiers we collect include device IDs, mobile advertiser ID or IDs from games, apps or accounts you use. We also collect Family Device IDs or other identifiers unique to [Meta Company Products](https://www.facebook.com/legal/meta-company-products?entry_point=POLICY_ANNOTATION%3A1.ex.26-IdentifiersThatTellYour) associated with the same device or account."
	},
	{
		"lineId": "L0343",
		"text": "Device signals include GPS, Bluetooth signals, nearby Wi-Fi access points, beacons and cell towers."
	},
	{
		"lineId": "L0348",
		"text": "For example, if you give us permission to access your device’s camera roll, we collect metadata. This metadata is from and about your photos and videos and includes the date and time they were made. We use this to do things like remind you when you have new photos to upload."
	},
	{
		"lineId": "L0360",
		"text": "Information about your network and connection includes:"
	},
	{
		"lineId": "L0362",
		"text": "*   The name of your mobile operator or internet service provider (ISP)"
	},
	{
		"lineId": "L0363",
		"text": "*   Language"
	},
	{
		"lineId": "L0364",
		"text": "*   Time zone"
	},
	{
		"lineId": "L0365",
		"text": "*   Mobile phone number"
	},
	{
		"lineId": "L0366",
		"text": "*   IP address"
	},
	{
		"lineId": "L0367",
		"text": "*   Connection and download speed"
	},
	{
		"lineId": "L0368",
		"text": "*   Network capability"
	},
	{
		"lineId": "L0369",
		"text": "*   Information about other devices that are nearby or on your network"
	},
	{
		"lineId": "L0370",
		"text": "*   Wi-Fi hotspots you connect to using our Products"
	},
	{
		"lineId": "L0372",
		"text": "One reason we collect this information is to make your experience better. For example, if we know that your phone and TV are connected to the same network, we can help you use your phone to control a video stream on your TV."
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
		"lineId": "L0398",
		"text": "Our [partners\\[2\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_ANNOTATION%3A1.ex.37-OurPartnersBusinessesAnd#annotation-2) use our Products, including our Business Tools and other technologies that allow businesses to advertise or support their products. Business Tools also help our partners understand and measure how people are using their products and services and how well their ads are working. For example, they might put one of our Business Tools, the Meta Pixel, on their website. Or they might use Meta Audience Network tools to monetize their apps by showing ads from businesses that advertise on Facebook."
	},
	{
		"lineId": "L0419",
		"text": "Some people, businesses, organizations and bodies share information with Meta but don’t necessarily use our Products. We collect and receive information from these other [third parties\\[25\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_ANNOTATION%3A1.ex.40-ThirdPartiesWeGet#annotation-25), including:"
	},
	{
		"lineId": "L0421",
		"text": "*   Publicly available sources, like academic papers and public forums"
	},
	{
		"lineId": "L0422",
		"text": "*   Industry peers, such as other online platforms and technology companies"
	},
	{
		"lineId": "L0423",
		"text": "*   Marketing and advertising vendors and data providers, who have the rights to provide us with your information"
	},
	{
		"lineId": "L0424",
		"text": "*   Companies or organizations that provide content, including videos, photos, and audio"
	},
	{
		"lineId": "L0425",
		"text": "*   Law enforcement"
	},
	{
		"lineId": "L0426",
		"text": "*   Government authorities"
	},
	{
		"lineId": "L0427",
		"text": "*   Professional and non-profit groups, like [NGOs](https://mbasic.facebook.com/privacy/policy/printable/https%3A%2F%2Flm.facebook.com%2Fl.php%3Fu=https%3A%2F%2Fabout.fb.com%2Fnews%2F2017%2F07%2Fglobal-internet-forum-to-counter-terrorism-to-hold-first-meeting-in-san-francisco%2F%3Fentry_point%3DPOLICY_ANNOTATION%253A1.ex.40-ThirdPartiesWeGet), and charities"
	},
	{
		"lineId": "L0428",
		"text": "*   Academic and research institutions, like universities, non-profit research groups and think tanks"
	},
	{
		"lineId": "L0432",
		"text": "We get datasets from publicly available sources, research institutions, data providers and professional and non-profit groups. We use these datasets to:"
	},
	{
		"lineId": "L0434",
		"text": "*   Detect and stop [scraping](https://www.facebook.com/help/463983701520800/?helpref=search&entry_point=POLICY_ANNOTATION%3A1.ex.40-ThirdPartiesWeGet) in violation of our terms"
	},
	{
		"lineId": "L0435",
		"text": "*   Take other actions to promote the safety, security and integrity of our Products, our users, the public and our personnel and property"
	},
	{
		"lineId": "L0436",
		"text": "*   Improve our AI technologies and support AI research and product development, such as translations, computer vision, content understanding, natural language processing, and tools for people and businesses to create content"
	},
	{
		"lineId": "L0437",
		"text": "*   Undertake analytics"
	},
	{
		"lineId": "L0438",
		"text": "*   Engage with research survey respondents who choose to participate in additional conversations"
	},
	{
		"lineId": "L0448",
		"text": "For example, if you don’t provide your email address, phone number or age, we won’t be able to create an account for you to use our Products."
	},
	{
		"lineId": "L0450",
		"text": "Or you can choose not to add Facebook friends, but then your Facebook Feed won’t show friends’ photos and status updates."
	}
]
```

### 3. Facebook, core L0462-L0716

Starting heading: How do we use your information?. Context before: 459-461; context after: 717-719. Source: [pinned Facebook policy](https://github.com/OpenTermsArchive/pga-versions/blob/53fdfebe3c470bb1433e830394e86fd699f485e7/Facebook/Privacy%20Policy.md).

Status: completed; 15 findings; 7000 input and 4484 output tokens; $0.00312 estimated token cost.

Actual parsed Luna output:

```json
{
	"summary": "The policy describes using information to provide and improve Products, personalize AI features and ads, promote safety, measure business performance, communicate, conduct research, and combine information across accounts and devices. Some uses depend on settings or choices; it also describes manual review and controls for certain uses.",
	"findings": [
		{
			"practice": "product_personalization_and_operation",
			"dataCategories": ["Information the company has about the user"],
			"purposes": [
				"Provide Products",
				"Personalize features, content, and recommendations",
				"Check that Products work correctly, troubleshoot, and fix problems"
			],
			"recipients": [],
			"summary": "The company uses information it has to provide and improve Products, including to personalize features, content, and recommendations and to troubleshoot Product problems.",
			"sourceLineIds": ["L0487", "L0489", "L0490"],
			"qualifications": [
				{
					"summary": "Information with special protections that users choose to provide is used for these purposes, but not to show ads.",
					"sourceLineIds": ["L0492"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "ad_personalization_and_measurement",
			"dataCategories": [
				"Information from the user's account or accounts in Accounts Center",
				"Cookies on Meta Products",
				"De-identified, aggregated, or anonymized information"
			],
			"purposes": [
				"Personalize ads on and across Meta Company Products",
				"Show ads through Meta Audience Network on other apps",
				"Measure ad performance"
			],
			"recipients": ["Advertisers, businesses, organizations, and others pay for ads to be shown"],
			"summary": "When ads are shown, the company uses account information and cookies to personalize ads on and across Meta Company Products, and may show ads through Meta Audience Network on other apps. It also uses information that no longer identifies individuals to show ads and measures ad performance.",
			"sourceLineIds": ["L0499", "L0503"],
			"qualifications": [
				{
					"summary": "Users can control whether ads are shown and which information is used for ads through Ad preferences.",
					"sourceLineIds": ["L0499"]
				},
				{
					"summary": "The policy describes ads as a means of providing Products for free and does not say that ads are shown to every user.",
					"sourceLineIds": ["L0476", "L0499"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "product_development_and_research",
			"dataCategories": [
				"Information collected from users",
				"Feedback",
				"Survey and research responses"
			],
			"purposes": [
				"Develop and improve Products and features",
				"Build and test new Products and features",
				"Solicit feedback and conduct surveys or other research"
			],
			"recipients": [],
			"summary": "The company uses information it collects to develop and improve Products and features, test new ones, obtain feedback, and research what it can do better.",
			"sourceLineIds": ["L0517", "L0519", "L0521", "L0522", "L0523", "L0524"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "ai_feature_personalization",
			"dataCategories": [
				"User activity and information provided by the user",
				"Friends, followers, and other connections",
				"App, browser, and device information",
				"Information from partners, vendors, and third parties",
				"Interests and preferences"
			],
			"purposes": ["Make responses and actions from AI at Meta features more relevant"],
			"recipients": [],
			"summary": "The company uses information it has, including interests and preferences and information from the listed sources, to make responses and actions from AI at Meta features more relevant.",
			"sourceLineIds": ["L0529", "L0531", "L0532", "L0533", "L0534"],
			"qualifications": [
				{
					"summary": "The restaurant example describes using location-related information, prior information given to Meta AI, and activity such as liking Instagram posts to tailor a recommendation.",
					"sourceLineIds": ["L0536", "L0538"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "location_information_use",
			"dataCategories": [
				"GPS location and other device signals",
				"IP addresses",
				"Activity on Products, including check-ins and events",
				"Location information supplied directly, such as a profile city or Marketplace address"
			],
			"purposes": [
				"Provide, personalize, and improve Products, including ads when shown",
				"Estimate location",
				"Detect suspicious activity and help secure accounts"
			],
			"recipients": [],
			"summary": "The company uses location-related information for Product personalization and improvement, including ads when shown, and for detecting suspicious activity and helping secure accounts. It receives location information from device settings, IP addresses, Product activity, and information users provide.",
			"sourceLineIds": ["L0543", "L0547", "L0548", "L0549", "L0551", "L0553", "L0554"],
			"qualifications": [
				{
					"summary": "GPS location and certain device signals are received when the user turns on the device's Location Services setting.",
					"sourceLineIds": ["L0543"]
				},
				{
					"summary": "The company says it also receives and uses some location-related information when Location Services is off; IP addresses are used to estimate general location, and may be used to estimate specific location when necessary to protect safety and security.",
					"sourceLineIds": ["L0545", "L0547"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "safety_security_and_integrity",
			"dataCategories": [
				"Information collected by the company",
				"Account, identity, and activity information",
				"Content and information relevant to suspicious activity"
			],
			"purposes": [
				"Verify accounts, identity, and activity",
				"Find and address policy violations",
				"Investigate suspicious activity",
				"Detect harmful, unlawful, or spam behavior",
				"Provide support when someone may need help",
				"Protect personnel and property",
				"Maintain Product integrity"
			],
			"recipients": [
				"The Oversight Board may use information when reviewing certain violation decisions"
			],
			"summary": "The company uses collected information to help protect people and keep Products safe, secure, and integral. Activities include verification, investigating suspicious activity, detecting policy violations and harmful behavior, responding when someone may need help, and addressing threats to personnel or property.",
			"sourceLineIds": [
				"L0565",
				"L0592",
				"L0593",
				"L0594",
				"L0595",
				"L0596",
				"L0597",
				"L0598",
				"L0599"
			],
			"qualifications": [
				{
					"summary": "In some cases, the Oversight Board reviews decisions about violations and may use information the company has in doing so.",
					"sourceLineIds": ["L0593"]
				},
				{
					"summary": "Account or identity verification through facial recognition technology is described as something a user can choose.",
					"sourceLineIds": ["L0592"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "measurement_analytics_and_business_services",
			"dataCategories": [
				"Information collected about users across their accounts on the company's Products",
				"Information about interactions with content, websites, apps, and services",
				"Information about how people connect to Meta Products and their network and user experience"
			],
			"purposes": [
				"Provide partners and users with measurement and analytics",
				"Measure reach, interactions, and performance of content, products, and services",
				"Provide business services"
			],
			"recipients": ["Partners", "Users of measurement and analytics services"],
			"summary": "The company uses information collected across users' accounts on its Products to provide partners and users measurement and analytics, including information about reach, interactions, types of people interacting with content, and connections to Meta Products. It also uses collected information to provide business services.",
			"sourceLineIds": ["L0611", "L0613", "L0615", "L0616", "L0617", "L0618", "L0620"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "communications_and_support",
			"dataCategories": [
				"Contact information supplied to the company, including registered email and profile contact information",
				"Information about Product use",
				"Information about questions or concerns"
			],
			"purposes": [
				"Send messages about Products used",
				"Send marketing communications about Products the user might like",
				"Invite users to research",
				"Notify users about policies and terms",
				"Reply to user inquiries",
				"Facilitate customer support"
			],
			"recipients": [
				"The user",
				"A third party may communicate a user's Product-related question or concern to the company"
			],
			"summary": "The company uses information users have given it, such as contact information, to communicate about Products, policies, research, and support. It may send marketing communications about Products the user might like and respond to inquiries.",
			"sourceLineIds": ["L0577", "L0632", "L0633", "L0634", "L0635", "L0636", "L0637"],
			"qualifications": [
				{
					"summary": "Marketing communications depend on the user's settings.",
					"sourceLineIds": ["L0633"]
				},
				{
					"summary": "Support communications may be prompted by information the user provides directly or through a third party.",
					"sourceLineIds": ["L0637"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "research_for_social_good",
			"dataCategories": [
				"Information the company has",
				"Information from researchers",
				"Datasets from publicly available sources, professional groups, and nonprofit groups"
			],
			"purposes": [
				"Support social good and matters of public interest",
				"Advance technology",
				"Improve safety, health, and well-being",
				"Support research, including crisis response and research into social media, elections, internet access, AI, and machine learning"
			],
			"recipients": [
				"Researchers",
				"Relief organizations may benefit from crisis-related analysis"
			],
			"summary": "The company uses information it has and information or datasets from researchers and other sources to conduct and support research and innovation for social good, public interest, technology, safety, health, and well-being.",
			"sourceLineIds": [
				"L0583",
				"L0647",
				"L0649",
				"L0650",
				"L0651",
				"L0655",
				"L0656",
				"L0657",
				"L0658"
			],
			"qualifications": [
				{
					"summary": "The crisis example describes analyzing information about where groups of people go to help relief organizations direct aid.",
					"sourceLineIds": ["L0655"]
				},
				{
					"summary": "The policy says the company works with independent researchers and has collaborated with academics and industry experts for some research.",
					"sourceLineIds": ["L0656", "L0657"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "accounts_center_combination",
			"dataCategories": [
				"Information across accounts on Meta Company Products",
				"Account information and settings"
			],
			"purposes": [
				"Enable connected experiences",
				"Personalize ads and content and suggestions",
				"Measure ad performance when ads are shown",
				"Improve Products and provide optional cross-Product activities",
				"Make some account information and settings match across accounts"
			],
			"recipients": [],
			"summary": "If a user adds accounts to the same Accounts Center, the company combines information across those accounts and uses it for connected experiences, personalization, measurement, Product improvement, optional cross-Product activities, and matching some account information and settings.",
			"sourceLineIds": ["L0665", "L0667", "L0668", "L0669", "L0670", "L0671"],
			"qualifications": [
				{
					"summary": "Adding multiple accounts to an Accounts Center is optional, and users can remove accounts at any time.",
					"sourceLineIds": ["L0673"]
				},
				{
					"summary": "Ad personalization and ad measurement apply if the user is shown ads.",
					"sourceLineIds": ["L0668"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "cross_account_use_without_accounts_center",
			"dataCategories": ["Information across accounts on Meta Products"],
			"purposes": [
				"Keep users and others safe",
				"Count people and measure Product use more accurately",
				"Check that Products work correctly and fix them"
			],
			"recipients": [],
			"summary": "Even if a user does not add Meta Product accounts to the same Accounts Center, the company uses information across the user's accounts for safety, more accurate counting and measurement, and Product operation and repair.",
			"sourceLineIds": ["L0675", "L0677", "L0678", "L0679"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "whatsapp_accounts_center_combination",
			"dataCategories": ["Information across accounts on Meta Company Products"],
			"purposes": [
				"Associate accounts added to an Accounts Center",
				"Use information for safety, measurement, and Product operation"
			],
			"recipients": ["Meta", "WhatsApp"],
			"summary": "When a user adds a WhatsApp account to an Accounts Center with other Meta Product accounts, WhatsApp and Meta are joint controllers for associating those accounts. Meta and WhatsApp each combine and use information across accounts, with WhatsApp's use also governed by its supplemental Accounts Center privacy policy.",
			"sourceLineIds": ["L0681", "L0683", "L0684", "L0685"],
			"qualifications": [
				{
					"summary": "This practice applies when the user adds the WhatsApp account to an Accounts Center with other Meta Product accounts.",
					"sourceLineIds": ["L0681"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "cross_device_ad_measurement",
			"dataCategories": [
				"Information about ad exposure and interaction across devices",
				"Information about later ad clicks and purchases"
			],
			"purposes": [
				"Personalize experience",
				"Understand ad relevance",
				"Help businesses measure ad performance"
			],
			"recipients": ["Businesses"],
			"summary": "The company may combine information across a user's devices to personalize the experience, understand which ads are relevant, and help businesses measure ad performance.",
			"sourceLineIds": ["L0697"],
			"qualifications": [
				{
					"summary": "The policy gives an example in which a user sees an ad on a phone and later clicks it and buys the product on a laptop; it does not state that this exact sequence occurs for every user.",
					"sourceLineIds": ["L0697"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "manual_review_of_content",
			"dataCategories": [
				"Content and posts",
				"Information used to train content-review algorithms"
			],
			"purposes": [
				"Review content for safety and policy enforcement",
				"Offer support when a person may need help",
				"Train algorithms to review content and improve automatic processing"
			],
			"recipients": ["Human reviewers"],
			"summary": "The company uses manual review to supplement automated systems: reviewers may remove content that violates terms or policies, keep compliant content available, review a post when algorithms indicate someone may need help, and analyze content to train review algorithms.",
			"sourceLineIds": ["L0704", "L0705", "L0706"],
			"qualifications": [
				{
					"summary": "A reviewer may review a post and offer support if needed when algorithms detect that someone might need help.",
					"sourceLineIds": ["L0705"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "reviewer_access_to_information",
			"dataCategories": ["Information reviewers are allowed to access"],
			"purposes": ["Conduct manual review described in the policy"],
			"recipients": [
				"Meta reviewers",
				"Reviewers working for Meta Companies",
				"Reviewers working for trusted service providers"
			],
			"summary": "Reviewers conducting manual review may work at Meta, for Meta Companies, or for a trusted service provider. The company requires reviewers allowed to access information to meet privacy and security standards.",
			"sourceLineIds": ["L0710"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		}
	]
}
```

Exact cited source lines copied by code:

```json
[
	{
		"lineId": "L0476",
		"text": "We use [information we collect](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SECTION%3A2-HowDoWeUse#1-WhatInformationDoWe) to provide a personalized experience to you, including ads (if we show you ads), along with the other purposes we explain in detail below."
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
		"lineId": "L0517",
		"text": "We’re always trying to make Meta Products better and create new ones with the features you want. Information we collect from you helps us learn how."
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
		"lineId": "L0522",
		"text": "*   Build and test out new products and features to see if they work"
	},
	{
		"lineId": "L0523",
		"text": "*   Get feedback on our ideas for products or features"
	},
	{
		"lineId": "L0524",
		"text": "*   Conduct surveys and other research on what we can do better for Meta Products and brands"
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
		"lineId": "L0565",
		"text": "We use information we collect to help protect people from harm and provide safe, secure Products."
	},
	{
		"lineId": "L0577",
		"text": "We communicate with you using information you've given us, like contact information you've entered on your profile."
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
		"lineId": "L0597",
		"text": "*   [Detect when someone needs help](https://www.facebook.com/safety/wellbeing/suicideprevention?entry_point=POLICY_SUBPAGE%3A2.subpage.8-PromotingSafetySecurityAnd) and provide support"
	},
	{
		"lineId": "L0598",
		"text": "*   Detect and stop threats to our personnel and property"
	},
	{
		"lineId": "L0599",
		"text": "*   Maintain the integrity of our Products"
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
		"lineId": "L0618",
		"text": "*   How people use our partners' products and services to connect to Meta Products, the performance of their connection and networks and users' experience with them"
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
		"lineId": "L0649",
		"text": "*   Contributing to social good and areas of public interest"
	},
	{
		"lineId": "L0650",
		"text": "*   Advancing technology"
	},
	{
		"lineId": "L0651",
		"text": "*   Improving safety, health and well-being"
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
		"lineId": "L0658",
		"text": "*   We support research in areas like artificial intelligence and machine learning"
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
		"lineId": "L0671",
		"text": "*   Adjust some of your accounts information and settings to match across your accounts, [which you can manage anytime](https://www.meta.com/help/accounts-center/manage-settings-across-accounts/?entry_point=POLICY_ANNOTATION%3A2.ex.5-UsingInformationAcrossOur)"
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
	}
]
```

### 4. Facebook, core L0717-L1071

Starting heading: How do we use your information?. Context before: 714-716; context after: 1072-1074. Source: [pinned Facebook policy](https://github.com/OpenTermsArchive/pga-versions/blob/53fdfebe3c470bb1433e830394e86fd699f485e7/Facebook/Privacy%20Policy.md).

Status: completed; 19 findings; 6654 input and 4701 output tokens; $0.00318 estimated token cost.

Actual parsed Luna output:

```json
{
	"summary": "The excerpt describes personalized advertising and security uses, sharing with other users and integrated partners, public-content visibility, AI-related processing, and controls over audiences, ads, and search visibility. Many disclosures depend on user settings or actions; public content and information shared with others may reach audiences beyond the user’s intended audience.",
	"findings": [
		{
			"practice": "ads_from_product_activity",
			"dataCategories": ["Activity on Meta Products"],
			"purposes": ["Personalize ads"],
			"recipients": ["The user"],
			"summary": "Meta may use activity on its Products to show the user related ads on another Meta Product.",
			"sourceLineIds": ["L0722"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "ads_from_offsite_activity",
			"dataCategories": ["Activity on third-party websites and apps"],
			"purposes": ["Personalize ads"],
			"recipients": ["The user"],
			"summary": "Meta may use activity on third-party websites and apps to show ads related to that activity.",
			"sourceLineIds": ["L0727", "L0729"],
			"qualifications": [
				{
					"summary": "The example involves a seller sharing the activity through Meta Business Tools, subject to the Business Tools Terms.",
					"sourceLineIds": ["L0727"]
				},
				{
					"summary": "The user can hide ads from a particular advertiser or turn off ads based on activity on other websites and apps in Ad preferences.",
					"sourceLineIds": ["L0731"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "ads_from_inferred_interests_and_connections",
			"dataCategories": [
				"Page likes and other activity",
				"Interests Meta infers",
				"Connections’ activity"
			],
			"purposes": ["Personalize ads"],
			"recipients": ["The user"],
			"summary": "Meta may infer interests from a user’s activity and use those interests, or a connection’s activity, to select ads for the user.",
			"sourceLineIds": ["L0736", "L0738", "L0745"],
			"qualifications": [
				{
					"summary": "The user can manage inferred interests in ad topics.",
					"sourceLineIds": ["L0740"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "location_based_ads",
			"dataCategories": ["GPS location", "IP address and estimated general location"],
			"purposes": ["Find relevant public Wi-Fi networks", "Show ads for nearby businesses"],
			"recipients": ["The user"],
			"summary": "Meta may use location information to identify relevant nearby Wi-Fi networks and show ads for local businesses; an IP address may be used to estimate general location.",
			"sourceLineIds": ["L0762", "L0764"],
			"qualifications": [
				{
					"summary": "The GPS example depends on Location Services being on and location access being allowed in the Facebook app.",
					"sourceLineIds": ["L0762"]
				},
				{
					"summary": "When Location Services is turned off, Meta says it no longer collects GPS information; the later example uses the IP address to estimate general location instead.",
					"sourceLineIds": ["L0764"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "device_signal_collection",
			"dataCategories": ["Device signals, including nearby Bluetooth and Wi-Fi connections"],
			"purposes": [],
			"recipients": ["Meta"],
			"summary": "Meta receives different types of device signals from different operating systems, including nearby Bluetooth or Wi-Fi connections. The excerpt does not specify a purpose for receiving these signals.",
			"sourceLineIds": ["L0750"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "login_location_security_checks",
			"dataCategories": [
				"Locations from which the user normally logs in",
				"Other information used in security checks"
			],
			"purposes": [
				"Detect suspicious activity",
				"Check whether an attempted login is really the user"
			],
			"recipients": ["Meta"],
			"summary": "Meta combines information about the locations from which a user normally logs in with other information to detect suspicious activity and check unusual login attempts.",
			"sourceLineIds": ["L0769"],
			"qualifications": [
				{
					"summary": "The example describes checking an attempted login from a new location; the excerpt does not specify the other information used.",
					"sourceLineIds": ["L0769"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "advertiser_audience_reporting",
			"dataCategories": ["Ad-view information", "Age range", "Location", "Interests"],
			"purposes": ["Inform advertisers about the types of people who saw an ad"],
			"recipients": ["Advertisers"],
			"summary": "Meta may tell an advertiser demographic and interest characteristics of people who saw its ad, such as an age range, location, and interest category.",
			"sourceLineIds": ["L0779"],
			"qualifications": [
				{
					"summary": "The example describes information about a group of people; it does not say that the advertiser receives their names or other direct identifiers.",
					"sourceLineIds": ["L0779"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "cross_product_personalization",
			"dataCategories": [
				"Registration information such as a phone number",
				"Name and profile photo",
				"Interactions with cross-posted content"
			],
			"purposes": [
				"Personalize features, content, and suggestions across Meta Products",
				"Make registration and communication features available across Products"
			],
			"recipients": ["The user", "Other users, for name and profile-photo visibility"],
			"summary": "Meta may use information across its Products to prefill registration details, make a user’s name and profile photo searchable across Products, support communication, and bring cross-posted interactions together.",
			"sourceLineIds": ["L0789", "L0791", "L0792", "L0793"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "sharing_with_people_and_accounts",
			"dataCategories": [
				"Posts, photos, videos, stories, news articles, and profile information",
				"Messages",
				"Comments, reactions, ad engagement, story views, and device connections"
			],
			"purposes": [
				"Enable sharing and communication",
				"Make activity visible to people or businesses a user interacts with"
			],
			"recipients": [
				"The audience selected by the user",
				"People and businesses the user interacts with"
			],
			"summary": "Information a user shares or sends, and some activity on Meta Products, can be seen by the chosen audience or by the people and businesses with whom the user interacts.",
			"sourceLineIds": ["L0824", "L0826", "L0831", "L0842", "L0847"],
			"qualifications": [
				{
					"summary": "Audience choices are available only in some cases; the types of audiences depend on the Product and settings. Facebook offers choices including the public, connections, customized lists, oneself, and community members; Instagram offers private or public accounts and additional audience controls.",
					"sourceLineIds": ["L0824", "L1022", "L1030"]
				},
				{
					"summary": "Some Products provide settings for others to see when a user is active, including activity in a particular section or the last time a Product was used.",
					"sourceLineIds": ["L0858"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "supervisor_visibility",
			"dataCategories": [
				"Username",
				"Profile picture",
				"Whether the user blocked a supervised user",
				"Some activity and information"
			],
			"purposes": ["Provide supervision tools and insights to support a teen account"],
			"recipients": ["The supervised user’s parent or guardian"],
			"summary": "When a user interacts with a supervised user, that user’s parent or guardian can see some of the user’s activity and information.",
			"sourceLineIds": ["L0865", "L1044"],
			"qualifications": [
				{
					"summary": "This applies to interactions with supervised users; the excerpt says the information visible can include, but is not limited to, the listed examples.",
					"sourceLineIds": ["L0865"]
				},
				{
					"summary": "On some Products, a supervised user can let a parent or guardian know if the user reported them.",
					"sourceLineIds": ["L0865"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "sharing_content_about_others",
			"dataCategories": [
				"Photos and videos of a person",
				"Mentions, tags, and details about a person",
				"Messages and content shared by the person"
			],
			"purposes": ["Allow users to share or interact with content"],
			"recipients": [
				"The audience chosen by the person sharing",
				"People outside a user’s chosen audience"
			],
			"summary": "Users may share information about other people, and content or messages about a user may be shared by others, including through AI at Meta features.",
			"sourceLineIds": ["L0877", "L0882", "L0884", "L0885", "L0886", "L0887"],
			"qualifications": [
				{
					"summary": "People in a user’s audience can download, screenshot, or reshare the user’s content with anyone, on, across, or off Meta Products; a post’s sharer can also change its audience after a user comments or reacts.",
					"sourceLineIds": ["L0873", "L0875"]
				},
				{
					"summary": "When others interact with AI at Meta features, they may share information about the user, including messages and content the user shared, on or off Meta Products and beyond the user’s chosen audience.",
					"sourceLineIds": ["L0877"]
				},
				{
					"summary": "A user who is uncomfortable with something shared about them can report posts and stories; the excerpt also provides links for removing tags, changing audience settings, and deleting information.",
					"sourceLineIds": ["L0889", "L0895"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "public_information_and_content",
			"dataCategories": [
				"Name, Facebook and Instagram username, and profile picture",
				"Activity on public groups, Pages, channels, and public content",
				"Avatars",
				"Content set to Public"
			],
			"purposes": ["Make public information and content available and shareable"],
			"recipients": [
				"Anyone on or across Meta Products",
				"In some cases, anyone off Meta Products, including people without accounts",
				"Third-party services"
			],
			"summary": "Some information and activity are always public, and users can set other content to public. Public content can be viewed, shared, accessed, reshared, or downloaded by broad audiences, including through third-party services.",
			"sourceLineIds": ["L0904", "L0906", "L0913", "L0918", "L0925", "L0927"],
			"qualifications": [
				{
					"summary": "Public content may be seen off Meta Products, including by people without accounts, and may appear in internet search results or Meta research tools.",
					"sourceLineIds": ["L0918", "L0925"]
				},
				{
					"summary": "Public content may be accessed through APIs, media, connected apps and websites, and search engines; those third parties use the information under their own terms and policies, not Meta’s.",
					"sourceLineIds": ["L0927", "L0929", "L0934"]
				},
				{
					"summary": "On Instagram, a private account limits shared content to approved followers; a public account makes it viewable by anyone. Users can also block individual accounts and use a close-friends list for certain content.",
					"sourceLineIds": ["L1030"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "integrated_partner_access",
			"dataCategories": [
				"Public information",
				"Content posted or shared through a partner’s product or service",
				"Use of the partner’s services",
				"Device information",
				"Language setting on Meta Products"
			],
			"purposes": ["Enable use of integrated partners’ products and services"],
			"recipients": ["Integrated partners"],
			"summary": "Integrated partners can access public information, and when a user uses a partner’s product or service they can access information about what the user shares or does through the service, the device being used, and the user’s language setting on Meta Products.",
			"sourceLineIds": ["L0946", "L0948", "L0956", "L0958", "L0959", "L0960", "L0961"],
			"qualifications": [
				{
					"summary": "Connecting with an integrated partner is a user choice.",
					"sourceLineIds": ["L0946"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "permissioned_partner_access",
			"dataCategories": [
				"Additional account information, including email address, hometown, or birthday",
				"Private-account content, including photos and videos"
			],
			"purposes": ["Provide integrated partners access to information the user chooses to share"],
			"recipients": ["Integrated partners"],
			"summary": "An integrated partner may request access to additional information from a Facebook, Instagram, or Messenger account, and the user chooses whether to share it.",
			"sourceLineIds": ["L0968", "L0970"],
			"qualifications": [
				{
					"summary": "The partner’s request explains what information it wants to access; examples include Facebook email address, hometown, or birthday and Instagram content shared while the account was private.",
					"sourceLineIds": ["L0968", "L0970"]
				},
				{
					"summary": "Meta automatically logs when a user receives an integrated partner’s request for access. These requests are separate from Apps and Websites access managed in ad preferences or device settings.",
					"sourceLineIds": ["L0974"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "connected_app_access_duration",
			"dataCategories": ["Nonpublic information on Meta Products"],
			"purposes": [
				"Provide information to apps or websites connected through Facebook Login or Instagram"
			],
			"recipients": ["Apps and websites connected through Facebook Login or Instagram"],
			"summary": "Apps or websites a user has logged into with Facebook Login or connected to Instagram can access the user’s nonpublic information on Meta Products.",
			"sourceLineIds": ["L0979"],
			"qualifications": [
				{
					"summary": "Access may expire if Meta determines that the user has not used the app or website in 90 days; an app may still retain information previously shared with it after access expires.",
					"sourceLineIds": ["L0979"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "partner_receives_interaction_activity",
			"dataCategories": [
				"Interactions with Facebook, Instagram, or Messenger users, including comments"
			],
			"purposes": [
				"Support the user’s interaction with content on an integrated partner’s service"
			],
			"recipients": ["The integrated partner"],
			"summary": "An integrated partner receives information about a user’s activity when the user interacts with Facebook, Instagram, or Messenger users while using the partner’s product or service.",
			"sourceLineIds": ["L0993", "L0995"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "partner_handling_under_own_policies",
			"dataCategories": ["Information shared with integrated partners"],
			"purposes": ["Receive and process information shared with an integrated partner"],
			"recipients": ["Integrated partners", "In some cases, the partner’s service provider"],
			"summary": "Integrated partners handle information shared with them under their own terms and policies, not Meta’s; some may use a separate service provider to receive and process it.",
			"sourceLineIds": ["L1000"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "ai_feature_information_processing",
			"dataCategories": [
				"Prompts, questions, messages, media, and other information sent to AI features",
				"Responses and other information received from AI features",
				"Information from connected third-party apps and services",
				"Feedback",
				"Information used to personalize AI features",
				"Information about the user and others from connected third-party services"
			],
			"purposes": [
				"Operate and improve experiences that are part of AI at Meta",
				"Personalize AI features",
				"Enhance the user’s experience"
			],
			"recipients": ["Meta"],
			"summary": "When users or others interact or exchange information with Meta’s generative AI features, or those features perform actions, Meta collects and uses information about those interactions, connected services, feedback, and personalization.",
			"sourceLineIds": ["L1049", "L1051", "L1053", "L1054", "L1055", "L1056", "L1057", "L1058"],
			"qualifications": [
				{
					"summary": "The excerpt says responses may sometimes be provided with help from AI integrations.",
					"sourceLineIds": ["L1054"]
				},
				{
					"summary": "Third-party app and service information is included when the user connects those services to the AI features or Meta Products.",
					"sourceLineIds": ["L1055", "L1058"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "search_engine_visibility_controls",
			"dataCategories": ["Profile", "Public photos and videos", "Other public content"],
			"purposes": [
				"Control whether search engines show a profile or public photos and videos in search results outside Meta"
			],
			"recipients": ["Search engines", "People using search engines"],
			"summary": "Users can use privacy settings to control whether search engines can show their profile or public photos and videos in results outside Meta.",
			"sourceLineIds": ["L1063"],
			"qualifications": [
				{
					"summary": "Some public content may remain accessible through search engines if it is posted with a Public audience or profile, posted on a public Page or account depending on that account’s settings, or reshared by a professional Instagram account.",
					"sourceLineIds": ["L1063", "L1065", "L1066", "L1067"]
				}
			],
			"ambiguous": false,
			"negated": false
		}
	]
}
```

Exact cited source lines copied by code:

```json
[
	{
		"lineId": "L0722",
		"text": "For example, William checks into a local bakery on Facebook, so later we might show him ads on Instagram for other local bakeries."
	},
	{
		"lineId": "L0727",
		"text": "For example, Jane buys a pair of shoes from an online shoe store or in an online chat with a shoe seller. The seller shares Jane’s activity with us using our Business Tools, subject to our Business Tools Terms."
	},
	{
		"lineId": "L0729",
		"text": "Later, Jane sees an ad on Instagram for a discount on her next shoe purchase from the online store."
	},
	{
		"lineId": "L0731",
		"text": "If she doesn't want to see ads from this shoe store again, she can hide them in her [Advertisers setting](https://www.facebook.com/adpreferences/advertisers?entry_point=POLICY_STORY_ANNOTATION%3A2.story.6-YourActivityOnOur). Or if she doesn’t want us to show her any ads based on her activity on other websites and apps, she can make sure that this setting is turned off in her [Ad preferences](https://www.facebook.com/adpreferences/ad_settings?entry_point=POLICY_STORY_ANNOTATION%3A2.story.6-YourActivityOnOur)."
	},
	{
		"lineId": "L0736",
		"text": "For example, Jon likes several Facebook Pages about famous musicians, so we think he has an interest in \"music.\""
	},
	{
		"lineId": "L0738",
		"text": "Based on this interest, we might show him an ad for a local record shop or an online music publication."
	},
	{
		"lineId": "L0740",
		"text": "Jon can manage his interests in his [ad topics](https://www.facebook.com/adpreferences/ad_topics?entry_point=POLICY_STORY_ANNOTATION%3A2.story.6-YourActivityOnOur)."
	},
	{
		"lineId": "L0745",
		"text": "For example, Fiona’s friend likes an Instagram account for a local art fair. Based on her friend’s activity, we might show Fiona an ad for the art fair."
	},
	{
		"lineId": "L0750",
		"text": "We receive different types of device signals from different operating systems. They include things like nearby Bluetooth or Wi-Fi connections."
	},
	{
		"lineId": "L0762",
		"text": "For example, Marcus is going on a trip and wants to use Find Wi-Fi to find free, public Wi-Fi at the airport. He has turned on Location Services on his device and allowed location access on the Facebook app, so we can use his GPS information to help him find the most relevant public Wi-Fi networks. We’ll also use this information to show him ads for local businesses near the airport."
	},
	{
		"lineId": "L0764",
		"text": "Later, Marcus turns off Location Services before he lands, so we don’t collect his GPS information anymore. Later on his trip, he opens the Facebook app, and we can use the IP address we receive to estimate Marcus’ general location and show him ads for businesses nearby."
	},
	{
		"lineId": "L0769",
		"text": "For example, we use information about the locations you normally log in from, combined with other information, to detect suspicious activity. So if we detect an attempt to log into your account from a new location, we can check that it’s really you."
	},
	{
		"lineId": "L0779",
		"text": "For example, we might tell an advertiser that their ad was seen by women aged 25–34 who live in Madrid and like software engineering."
	},
	{
		"lineId": "L0789",
		"text": "For example we can:"
	},
	{
		"lineId": "L0791",
		"text": "*   Automatically fill in registration information, like your phone number, from one Meta Product when you sign up for an account on a different Product"
	},
	{
		"lineId": "L0792",
		"text": "*   Let others see and search your name and profile photo across our Products and communicate with you"
	},
	{
		"lineId": "L0793",
		"text": "*   Show all interactions in one place for content you’ve cross-posted to different Products"
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
		"lineId": "L0875",
		"text": "When you comment on a post or react to a photo, your comment or reaction can be seen by anyone who can see the post or photo. This can include people you aren’t connected to. The person who shared the post can also change their audience at any time after you’ve interacted with it."
	},
	{
		"lineId": "L0877",
		"text": "When others interact with our features that are part of AI at Meta, they can share information about you, including [messages and content you have shared\\[44\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A3.subpage.2-ContentOthersShareOr#annotation-44). This may be on or off our Products and with others outside your chosen audience."
	},
	{
		"lineId": "L0882",
		"text": "People who use our Products can share information about you with the audience they choose. For example, they can:"
	},
	{
		"lineId": "L0884",
		"text": "*   Share a photo or video of you in a post, comment, story, reel or message"
	},
	{
		"lineId": "L0885",
		"text": "*   Mention you in a post or story"
	},
	{
		"lineId": "L0886",
		"text": "*   Tag you in a post, comment, story or location"
	},
	{
		"lineId": "L0887",
		"text": "*   Share details about you in a post, story or message"
	},
	{
		"lineId": "L0889",
		"text": "If you’re uncomfortable with what others have shared about you on our Products, for example on Facebook, you can always choose to [report posts and stories](https://www.facebook.com/help/1380418588640631?ref=dp&entry_point=POLICY_SUBPAGE%3A3.subpage.2-ContentOthersShareOr)."
	},
	{
		"lineId": "L0895"
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
		"lineId": "L0929",
		"text": "*   [APIs](https://developers.facebook.com/docs/?entry_point=POLICY_SUBPAGE%3A3.subpage.3-PublicContentWhatContent)"
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
		"lineId": "L0961",
		"text": "*   The language setting you’ve chosen on our Products"
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
		"lineId": "L0974",
		"text": "We automatically log when you receive a request from an integrated partner to access your information. These requests to access information are separate from the Apps and Websites access that you manage in your Facebook or Instagram Ad preferences or in your mobile device settings."
	},
	{
		"lineId": "L0979",
		"text": "Apps or websites you’ve logged into using Facebook Login or connected to your Instagram account can access your nonpublic information on Meta Products unless it appears to us that you haven’t used the app or website in 90 days. Note that even if an app’s access to your information has expired, it can still retain information you shared with it previously."
	},
	{
		"lineId": "L0993",
		"text": "Integrated partners receive information about your activity when you interact with other Facebook, Instagram or Messenger users while they’re using the integrated partner’s product or service."
	},
	{
		"lineId": "L0995",
		"text": "For example, a gamer livestreams to Facebook using a partner app. Then you comment on that livestream. The app developer will receive information about your comment."
	},
	{
		"lineId": "L1000",
		"text": "Integrated partners handle the information you share with them according to their own terms and policies, not Meta’s. You can review their privacy policy on their website or app to learn how they receive and process your information. In some cases, they use a separate service provider to receive and process your information."
	},
	{
		"lineId": "L1022",
		"text": "On Facebook, the audience can be made up of:"
	},
	{
		"lineId": "L1030",
		"text": "On Instagram, you can set the audience for what you share by choosing between a private or public account. With a [private account](https://mbasic.facebook.com/privacy/policy/printable/https%3A%2F%2Flm.facebook.com%2Fl.php%3Fu=https%3A%2F%2Fhelp.instagram.com%2F448523408565555%3Fentry_point%3DPOLICY_ANNOTATION%253A3.ex.2-ChoosingAnAudienceOn), only followers you approve can see what you share. With a public account, your posts and other content on Instagram can be seen by anyone, on or off our Products, including if they don’t have an account. You can restrict the audience for your content by blocking individual accounts from viewing them. You can also create a close friends list for certain types of content that only the people on that list can see."
	},
	{
		"lineId": "L1044",
		"text": "Supervision provides supervisors chosen by a teen, like parents and guardians, with tools and insights to help support a teen account."
	},
	{
		"lineId": "L1049",
		"text": "Across Meta Company Products, you can interact with Meta’s generative AI features and experiences that are part of [AI at Meta](https://www.facebook.com/privacy/genai?entry_point=POLICY_ANNOTATION%3A1.ex.62-InformationYouOrOthersExchange)."
	},
	{
		"lineId": "L1051",
		"text": "When you or others use, or exchange information with these features, or when they perform actions, we collect and use information, such as:"
	},
	{
		"lineId": "L1053",
		"text": "*   Prompts that can include questions, messages, media and other information you or others share with or send to these features"
	},
	{
		"lineId": "L1054",
		"text": "*   Responses and other information you receive from these features. Sometimes these are provided with the help of our [AI integrations](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_ANNOTATION%3A1.ex.62-InformationYouOrOthersExchange#4.subpage.15-AiIntegrations)"
	},
	{
		"lineId": "L1055",
		"text": "*   Information from third-party apps and services you choose to connect to these features to do things like help manage your calendar and emails"
	},
	{
		"lineId": "L1056",
		"text": "*   Feedback you give to these features and responses to your feedback"
	},
	{
		"lineId": "L1057",
		"text": "*   [Information we collect](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_ANNOTATION%3A1.ex.62-InformationYouOrOthersExchange#1-WhatInformationDoWe) to personalize these features. [See examples](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_ANNOTATION%3A1.ex.62-InformationYouOrOthersExchange#2.subpage.5-HowWeUseInformationAI)"
	},
	{
		"lineId": "L1058",
		"text": "*   Information about you and others from third party apps and services that you connect to Meta Products to enhance your experience, including our features that are part of AI at Meta. [Learn more](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_ANNOTATION%3A1.ex.62-InformationYouOrOthersExchange#4.subpage.15-AiIntegrations)"
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
	}
]
```

### 5. Facebook, core L1072-L1390

Starting heading: How is your information shared on Meta Products or with integrated partners?. Context before: 1069-1071; context after: 1391-1393. Source: [pinned Facebook policy](https://github.com/OpenTermsArchive/pga-versions/blob/53fdfebe3c470bb1433e830394e86fd699f485e7/Facebook/Privacy%20Policy.md).

Status: completed; 19 findings; 5470 input and 4913 output tokens; $0.00314 estimated token cost.

Actual parsed Luna output:

```json
{
	"summary": "The excerpt describes disclosures to integrated partners, advertisers, businesses, vendors, researchers, third parties, and other Meta Companies, as well as limited user controls over some sharing. It also states that Meta does not sell information.",
	"findings": [
		{
			"practice": "integrated_partner_disclosures",
			"dataCategories": [
				"Information about you",
				"Activity when using an integrated partner’s product or service"
			],
			"purposes": ["Enable connections and integrations with partner products and services"],
			"recipients": ["Integrated partners, including app and website developers"],
			"summary": "When you use an integrated partner’s product or service, the partner may receive information about you and your activity. Examples include a game developer receiving game activity when you play using Facebook Login and a website receiving information about a Like on its article.",
			"sourceLineIds": ["L1077", "L1082", "L1178"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "friends_list_sharing",
			"dataCategories": [
				"List of Facebook friends who use the same app and have permitted access",
				"Your appearance on friends lists shared with the app"
			],
			"purposes": [
				"Enable app developers to access permitted friends lists through Facebook Login"
			],
			"recipients": ["App developers"],
			"summary": "If you give an app developer permission through Facebook Login, the developer can access a list of your Facebook friends who use that app and also permitted access. Your friends may also share their lists with app developers, which can cause you to appear on those lists.",
			"sourceLineIds": ["L1089", "L1091", "L1092", "L1096"],
			"qualifications": [
				{
					"summary": "The developer cannot access your nonpublic information through this friends-list process. A friend may separately provide more information or authorize the developer to access information from their account.",
					"sourceLineIds": ["L1091", "L1096"]
				},
				{
					"summary": "You can remove permission or remove the app if you no longer want to share your list or appear on other friends’ lists shared with that app.",
					"sourceLineIds": ["L1092"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "advertiser_ad_reporting",
			"dataCategories": [
				"Aggregated audience statistics",
				"General demographics and interests",
				"Ads engaged with, engagement timing, and where ads were shown",
				"Ads viewed that led to an action with an advertiser"
			],
			"purposes": [
				"Help advertisers understand their audiences and ad performance",
				"Confirm ad-related actions"
			],
			"recipients": ["Advertisers", "Advertiser vendors"],
			"summary": "Meta provides advertisers with reports about the number and kinds of people who see or engage with ads, and provides advertisers and their vendors information about ad engagement, timing, placement, and certain actions following ad views.",
			"sourceLineIds": ["L1125", "L1127", "L1133"],
			"qualifications": [
				{
					"summary": "Reports describe general demographics and interests and are presented as audience reports; the policy says Meta does not provide advertisers or their vendors information that by itself can contact or identify you, such as your name or email, unless you give permission.",
					"sourceLineIds": ["L1125", "L1133"]
				},
				{
					"summary": "If you submit a form with your name and contact information after clicking an advertiser’s ad to request more information, the advertiser receives what you provided.",
					"sourceLineIds": ["L1284"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "audience_network_disclosures",
			"dataCategories": [
				"Information about how many people see and engage with ads",
				"Information related to or responsive to a publisher’s request to serve an ad"
			],
			"purposes": ["Help show ads on publisher apps and websites outside Meta"],
			"recipients": ["Audience Network publishers", "Vendors facilitating Audience Network use"],
			"summary": "To help show ads on apps and websites outside Meta, Meta shares information with Audience Network publishers and vendors that facilitate the service.",
			"sourceLineIds": ["L1137", "L1139", "L1141", "L1142"],
			"qualifications": [
				{
					"summary": "Meta says it does not share information that by itself can contact or identify you, such as your name or email, with these publishers or vendors unless you give permission.",
					"sourceLineIds": ["L1144"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "partner_analytics_reports",
			"dataCategories": [
				"Aggregated counts of interactions",
				"General demographics and interests",
				"Information about how people use partner products and services to connect to Meta Products"
			],
			"purposes": [
				"Show partner performance",
				"Help partners understand users’ experience and connections to Meta Products"
			],
			"recipients": ["Partners using Meta analytics services"],
			"summary": "Meta uses information it collects about you to create aggregate reports for partners about how their content, features, products, and services perform and how people use them.",
			"sourceLineIds": ["L1151", "L1153", "L1155", "L1156", "L1157"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "seller_transaction_disclosures",
			"dataCategories": [
				"Order, payment, contact, and shipping information",
				"Device or connection information",
				"Information required by applicable regulation",
				"Other information you choose to share"
			],
			"purposes": [
				"Complete transactions",
				"Help secure transactions",
				"Meet applicable regulatory requirements"
			],
			"recipients": [
				"Sellers, creators, fundraisers, charities, payment services providers, commerce services platforms, and providers acting on their behalf"
			],
			"summary": "When you make a transaction or otherwise choose to share information with a commerce-related recipient, Meta shares information with that recipient and providers acting for them.",
			"sourceLineIds": ["L1164", "L1166", "L1168", "L1169", "L1170", "L1171"],
			"qualifications": [
				{
					"summary": "The information received depends on how you interact with the recipient and what you choose to share. In the donation example, PayPal Giving Fund receives the transaction amount and charity name, while its payment service provider receives payment-card credential information needed to facilitate payment.",
					"sourceLineIds": ["L1166", "L1171", "L1173"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "measurement_vendor_sharing",
			"dataCategories": [
				"Information about whether people saw or engaged with an ad",
				"Ad click information"
			],
			"purposes": [
				"Compile or aggregate measurement reports",
				"Measure ad performance and actions after ad exposure"
			],
			"recipients": ["Measurement vendors"],
			"summary": "Meta shares information such as whether people saw or engaged with an ad with measurement vendors, which aggregate or compile it for reports.",
			"sourceLineIds": ["L1186", "L1188"],
			"qualifications": [
				{
					"summary": "In the example, a vendor compares Meta’s ad-click information with purchase information from the advertiser and provides the advertiser aggregated reports.",
					"sourceLineIds": ["L1190"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "marketing_vendor_sharing",
			"dataCategories": [
				"Device identifiers and other identifiers",
				"Online and mobile app activity",
				"Interests and community and advertising interactions"
			],
			"purposes": [
				"Serve and personalize Meta advertising",
				"Track and categorize activity",
				"Measure marketing response and advertising effectiveness"
			],
			"recipients": ["Marketing vendors"],
			"summary": "Meta shares information about you, including identifiers, with marketing vendors to support advertising, categorize activity, provide information about interests and interactions, and measure marketing effectiveness.",
			"sourceLineIds": ["L1195", "L1197", "L1199", "L1200", "L1201", "L1203"],
			"qualifications": [
				{
					"summary": "The information can be used to determine who may find Meta advertising relevant and personalize which Meta ads are shown to you.",
					"sourceLineIds": ["L1203"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "service_provider_sharing",
			"dataCategories": ["Information Meta has about you"],
			"purposes": [
				"Investigate suspicious activity",
				"Detect and stop threats to personnel and property",
				"Facilitate payments",
				"Provide customer support",
				"Improve product functionality",
				"Provide technical infrastructure",
				"Analyze product use",
				"Conduct research and surveys",
				"Market and promote Meta Products"
			],
			"recipients": ["Service providers"],
			"summary": "Meta shares information it has about you with service providers to obtain services that help Meta provide its Products.",
			"sourceLineIds": [
				"L1211",
				"L1213",
				"L1214",
				"L1215",
				"L1216",
				"L1217",
				"L1218",
				"L1219",
				"L1220",
				"L1221"
			],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "external_researcher_disclosures",
			"dataCategories": ["Information provided by Meta; specific categories are not stated here"],
			"purposes": [
				"Scholarship and innovation",
				"Social good",
				"Technological advancement",
				"Safety and security",
				"Public interest",
				"Health and well-being"
			],
			"recipients": ["External researchers"],
			"summary": "Meta provides information to external researchers for research, including research supporting scholarship, innovation, safety, security, public interest, and health and well-being.",
			"sourceLineIds": ["L1229", "L1231", "L1233", "L1234", "L1235", "L1236", "L1237", "L1238"],
			"qualifications": [
				{
					"summary": "Meta says it ensures users’ privacy is protected when sharing information with external researchers but does not specify the protections in this excerpt.",
					"sourceLineIds": ["L1240"]
				}
			],
			"ambiguous": true,
			"negated": false
		},
		{
			"practice": "selected_ai_partner_sharing",
			"dataCategories": ["Certain information; specific categories are not stated here"],
			"purposes": ["Provide relevant information through features that use generative AI"],
			"recipients": ["Selected partners, such as search engine providers"],
			"summary": "Meta sometimes shares certain information with selected partners, including search engine providers, to provide relevant information for features that use generative AI.",
			"sourceLineIds": ["L1245"],
			"qualifications": [
				{
					"summary": "The policy says generative AI models may lack complete or recent information; the sharing with selected partners is described as occasional.",
					"sourceLineIds": ["L1245"]
				}
			],
			"ambiguous": true,
			"negated": false
		},
		{
			"practice": "connected_app_information_exchange",
			"dataCategories": [
				"Information exchanged with connected third-party apps and services",
				"Information about you and others used as described in the Policy"
			],
			"purposes": [
				"Enhance the Meta Products experience",
				"Perform actions for you involving connected apps and services"
			],
			"recipients": ["Third-party apps and services connected to a Meta account"],
			"summary": "When you connect third-party apps or services to your Meta account, you request an information exchange with them. Meta may use the exchanged information in the same ways described in the Policy and share information to perform actions for you involving those services.",
			"sourceLineIds": ["L1247"],
			"qualifications": [
				{
					"summary": "Connecting these apps and services is a choice made by the user.",
					"sourceLineIds": ["L1247"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "legal_and_harm_prevention_disclosures",
			"dataCategories": [
				"Information relevant to the request, legal compliance, or prevention of harm; specific categories are not stated here"
			],
			"purposes": ["Respond to legal requests", "Comply with applicable law", "Prevent harm"],
			"recipients": ["Other third parties"],
			"summary": "Meta shares information with other third parties in response to legal requests, to comply with applicable law, or to prevent harm.",
			"sourceLineIds": ["L1254"],
			"qualifications": [],
			"ambiguous": true,
			"negated": false
		},
		{
			"practice": "business_transfer_disclosures",
			"dataCategories": ["Your information; specific categories are not stated here"],
			"purposes": [
				"Transfer information as part of a sale or transfer of all or part of Meta’s business"
			],
			"recipients": ["A new owner of all or part of the business"],
			"summary": "In some cases, if Meta sells or transfers all or part of its business, it gives the new owner your information as part of the transaction.",
			"sourceLineIds": ["L1256"],
			"qualifications": [
				{
					"summary": "The disclosure is limited to cases where Meta sells or transfers all or part of the business and is subject to what the law allows.",
					"sourceLineIds": ["L1256"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "no_sale_of_information",
			"dataCategories": ["Your information"],
			"purposes": [],
			"recipients": [],
			"summary": "Meta states that it does not sell your information and will not sell it.",
			"sourceLineIds": ["L1111", "L1113"],
			"qualifications": [],
			"ambiguous": false,
			"negated": true
		},
		{
			"practice": "third_party_use_and_disclosure_rules",
			"dataCategories": ["Information Meta provides to partners and other third parties"],
			"purposes": ["Limit how recipients use and disclose information provided by Meta"],
			"recipients": ["Partners", "Other third parties"],
			"summary": "Meta says it requires partners and other third parties to follow rules governing how they may use and disclose information Meta provides.",
			"sourceLineIds": ["L1113"],
			"qualifications": [],
			"ambiguous": true,
			"negated": false
		},
		{
			"practice": "meta_company_information_sharing",
			"dataCategories": [
				"Information collected by Meta",
				"Infrastructure, systems, and technology",
				"Name, email address, friends, and other account information",
				"Videos"
			],
			"purposes": [
				"Safety, security, integrity, and legal compliance",
				"Optional features and integrations",
				"Understand product use and interactions",
				"Account verification and investigation of suspicious activity",
				"Innovation and training products and content-creation tools"
			],
			"recipients": ["Other Meta Companies, including companies providing Meta Company Products"],
			"summary": "Meta shares information, infrastructure, systems, and technology with other Meta Companies, and processes information received from them. Sharing supports safety and legal compliance, optional features and integrations, product-use analysis, account verification, and innovation; videos may also help train products and tools.",
			"sourceLineIds": [
				"L1333",
				"L1335",
				"L1340",
				"L1342",
				"L1343",
				"L1344",
				"L1376",
				"L1385",
				"L1389"
			],
			"qualifications": [
				{
					"summary": "For safety, security, integrity, and legal-compliance purposes, Meta may share your name, email address, who your friends are, and other account information within the Meta Companies.",
					"sourceLineIds": ["L1368", "L1370", "L1371", "L1372", "L1373", "L1374", "L1376"]
				},
				{
					"summary": "Some WhatsApp integrations with other Meta Company Products are available only in certain countries and can be chosen by the user.",
					"sourceLineIds": ["L1380", "L1382", "L1383"]
				},
				{
					"summary": "Meta says it processes information received from other Meta Companies according to their terms and policies and as permitted by applicable law; in some cases, Meta acts as their service provider and follows their instructions and terms.",
					"sourceLineIds": ["L1335"]
				},
				{
					"summary": "Meta says videos can help train products to recognize objects or activities and train tools for creating content, with the technology used to offer future products or features.",
					"sourceLineIds": ["L1385"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "public_product_usage_trends",
			"dataCategories": ["Counts of unique users", "Monthly active users", "Daily active users"],
			"purposes": [
				"Understand the community using Meta products",
				"Publicly share trends about product use"
			],
			"recipients": ["The public"],
			"summary": "Meta counts unique, monthly active, and daily active users to understand its product community and publicly share important trends about product use.",
			"sourceLineIds": ["L1389"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "remove_ad_interest_assignments",
			"dataCategories": ["Interests assigned to you for advertising"],
			"purposes": ["Let users review and manage assigned advertising interests"],
			"recipients": [],
			"summary": "You can view interests assigned to you in Ad preferences and remove them.",
			"sourceLineIds": ["L1273"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		}
	]
}
```

Exact cited source lines copied by code:

```json
[
	{
		"lineId": "L1077",
		"text": "For example, you might use your Facebook login to play an online game with your Facebook friends. The game developer automatically receives information about your activities in the game."
	},
	{
		"lineId": "L1082",
		"text": "Or you might use the Facebook Like button on an article posted on a news website. The website developer automatically receives information about your Like on their article."
	},
	{
		"lineId": "L1089",
		"text": "If you use Facebook Login to log into an app, the app developer might request access to your list of Facebook friends. Here's what happens if you give the app developer permission to view these lists:"
	},
	{
		"lineId": "L1091",
		"text": "*   They can view and access a list of your Facebook friends who use the same app and have given the app permission to access their list of friends. They can’t access nonpublic information about your friends or followers through this process. Note that the app developer will receive more information about your friends if your friends choose to share it themselves. They can share it by providing the information directly or giving the developer permission to access information from their account."
	},
	{
		"lineId": "L1092",
		"text": "*   You’ll appear on friends lists that your Facebook friends can choose to share with the same app. You can remove this permission, or the app entirely, if you later decide that you don’t want to share your friends list with an app, or don’t want to appear on other friends lists shared with that app."
	},
	{
		"lineId": "L1096",
		"text": "Your friends might choose to share their friends lists with app developers through Facebook Login. But your friends can’t use Facebook Login to share nonpublic information about you."
	},
	{
		"lineId": "L1111",
		"text": "We don’t sell your information, and we never will."
	},
	{
		"lineId": "L1113",
		"text": "We don't sell any of your information to anyone, and we never will. We also require [partners\\[49\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SECTION%3A4-HowDoWeShare#annotation-49) and other [third parties\\[50\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SECTION%3A4-HowDoWeShare#annotation-50) to follow rules about how they can and cannot use and disclose the information we provide."
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
		"lineId": "L1155",
		"text": "*   How many people interacted with our partners' content, products or services"
	},
	{
		"lineId": "L1156",
		"text": "*   The [general demographics and interests\\[51\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A4.subpage.4-PartnersWhoUseOur#annotation-51) of the people who interacted with it"
	},
	{
		"lineId": "L1157",
		"text": "*   How people use our partners’ products and services to connect to Meta Products and the performance of their connection and networks"
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
		"lineId": "L1173",
		"text": "For example, if you donate to a charity that receives funds through PayPal Giving Fund, your donation will be made to PayPal Giving Fund. The PayPal Giving Fund will receive information such as the transaction amount and name of the charity. Their payment service provider will also receive information needed to facilitate the payment, including your payment card credential information."
	},
	{
		"lineId": "L1178",
		"text": "When you choose to use integrated partners’ products or services, they may receive information about you and your activity. [Read the Policy](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A4.subpage.8-IntegratedPartnersWhenYou#3.subpage.4-WhenYouUseAn)."
	},
	{
		"lineId": "L1186",
		"text": "We don’t create every measurement and analytics report ourselves."
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
		"lineId": "L1197",
		"text": "Marketing vendors support our marketing and advertising efforts by:"
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
		"lineId": "L1214",
		"text": "*   Detecting and stopping threats to our personnel and property"
	},
	{
		"lineId": "L1215",
		"text": "*   Facilitating payments"
	},
	{
		"lineId": "L1216",
		"text": "*   Providing customer support"
	},
	{
		"lineId": "L1217",
		"text": "*   Improving the functionality of our Products"
	},
	{
		"lineId": "L1218",
		"text": "*   Providing technical infrastructure services"
	},
	{
		"lineId": "L1219",
		"text": "*   Analyzing how our Products are used"
	},
	{
		"lineId": "L1220",
		"text": "*   Conducting research and surveys"
	},
	{
		"lineId": "L1221",
		"text": "*   Marketing and promoting our Products"
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
		"lineId": "L1234",
		"text": "*   Social good. [Learn more](https://dataforgood.facebook.com/?entry_point=POLICY_SUBPAGE%3A4.subpage.14-ExternalResearchersWeProvide)."
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
		"lineId": "L1254",
		"text": "We also share information with other [third parties\\[50\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SECTION%3A4-HowDoWeShare#annotation-50) in response to legal requests, to comply with applicable law or to prevent harm. [Read the Policy](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SECTION%3A4-HowDoWeShare#10-HowDoWeRespond)."
	},
	{
		"lineId": "L1256",
		"text": "And if we sell or transfer all or part of our business to someone else, in some cases we’ll give the new owner your information as part of that transaction, but only as the law allows."
	},
	{
		"lineId": "L1273",
		"text": "You can see the “interests” assigned to you in your [Ad preferences](https://accountscenter.facebook.com/ad_preferences/) and remove them if you want."
	},
	{
		"lineId": "L1284",
		"text": "For example, you might request more information from a business by clicking their ad in your Facebook Feed and submitting a form with your name and contact information. Then the advertiser would receive the information you provided."
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
		"lineId": "L1368",
		"text": "For example, we share information with Meta Companies that provide financial products and services to help them promote safety, security and integrity and comply with applicable law. This includes:"
	},
	{
		"lineId": "L1370",
		"text": "*   Complying with their legal obligations"
	},
	{
		"lineId": "L1371",
		"text": "*   Helping keep you and others safe"
	},
	{
		"lineId": "L1372",
		"text": "*   Performing account verification"
	},
	{
		"lineId": "L1373",
		"text": "*   Investigating suspicious activities"
	},
	{
		"lineId": "L1374",
		"text": "*   Creating analytics"
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
		"lineId": "L1382",
		"text": "*   Use your Meta Pay account to pay for things on WhatsApp"
	},
	{
		"lineId": "L1383",
		"text": "*   Chat with your friends on other Meta Company Products, such as smart glasses, by connecting your WhatsApp account"
	},
	{
		"lineId": "L1385",
		"text": "We also share information with Meta Companies to support innovation. For example, your videos can help train our products to recognize objects, like trees, or activities, like when a dog chases a ball. They can also help train tools that let people and businesses create content, like images and videos. This technology is used to help us offer new products or features in the future."
	},
	{
		"lineId": "L1389",
		"text": "We count the number of unique users, monthly active users and daily active users on our products. This information helps us understand the community using our products and publicly share important trends about how our products are used."
	}
]
```

### 6. Facebook, core L1391-L1636

Starting heading: What is our legal basis for processing your information, and what are your rights?. Context before: 1388-1390; context after: 1637-1639. Source: [pinned Facebook policy](https://github.com/OpenTermsArchive/pga-versions/blob/53fdfebe3c470bb1433e830394e86fd699f485e7/Facebook/Privacy%20Policy.md).

Status: completed; 18 findings; 6686 input and 4419 output tokens; $0.00305 estimated token cost.

Actual parsed Luna output:

```json
{
	"summary": "The excerpt describes several legal bases for processing, individual data rights and controls, and information-retention and deletion practices. Many rights are subject to applicable law or other stated conditions.",
	"findings": [
		{
			"practice": "contract_necessity",
			"dataCategories": ["Information about you"],
			"purposes": ["Provide services necessary to fulfill the terms governing Meta Products"],
			"recipients": [],
			"summary": "Meta processes information it considers necessary to fulfill its contracts with users and provide the services described in the listed terms.",
			"sourceLineIds": ["L1415"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "consent_based_processing_and_ads",
			"dataCategories": [
				"Information about you",
				"Activity on advertisers’ and partners’ websites and apps",
				"Certain offline interactions, such as purchases"
			],
			"purposes": [
				"Processing for purposes to which the user consents",
				"Showing ads, including personalized ads"
			],
			"recipients": [
				"Advertisers and other partners provide information used for personalized ads"
			],
			"summary": "Meta processes information when a user consents. For ads, consent may allow use of information across Accounts Center accounts and personalized advertising based on information advertisers and other partners provide, including online activity and certain offline interactions.",
			"sourceLineIds": ["L1422", "L1424", "L1426", "L1427"],
			"qualifications": [
				{
					"summary": "Users can withdraw consent at any time in Ad preferences; withdrawal does not affect the lawfulness of consent-based processing before withdrawal.",
					"sourceLineIds": ["L1429", "L1479"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "legitimate_interests_processing",
			"dataCategories": ["Information about you"],
			"purposes": [
				"Providing an innovative, personalized, safe, and profitable service to users and partners",
				"Responding to legal requests",
				"Other legitimate interests of Meta or others"
			],
			"recipients": [],
			"summary": "Meta processes information as necessary for its or others’ legitimate interests, including the stated service, safety, profitability, and legal-request purposes.",
			"sourceLineIds": ["L1436"],
			"qualifications": [
				{
					"summary": "Meta says it will not rely on this basis when the user’s interests or fundamental rights and freedoms override the relevant interests.",
					"sourceLineIds": ["L1436"]
				},
				{
					"summary": "Users may object to certain processing based on legitimate interests; the objection process and exceptions are described separately.",
					"sourceLineIds": ["L1436", "L1518", "L1524"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "vital_interests_processing",
			"dataCategories": ["Information about you"],
			"purposes": ["Protecting a person or preventing harm, including saving a life"],
			"recipients": [],
			"summary": "Meta processes information when doing so would protect the user or prevent harm to someone.",
			"sourceLineIds": ["L1443"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "legal_obligation_processing",
			"dataCategories": ["Information about you"],
			"purposes": ["Complying with a legal obligation"],
			"recipients": [],
			"summary": "Meta processes information as necessary to comply with legal obligations.",
			"sourceLineIds": ["L1450"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "public_interest_processing",
			"dataCategories": ["Information about you"],
			"purposes": [
				"Public-interest purposes, including research and promoting safety, security, and integrity"
			],
			"recipients": [],
			"summary": "Meta processes information as necessary for the public interest, including conducting research and promoting safety, security, and integrity.",
			"sourceLineIds": ["L1457"],
			"qualifications": [
				{
					"summary": "Users may object to processing based on a task in the public interest; the objection process and exceptions are described separately.",
					"sourceLineIds": ["L1518", "L1524"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "access_and_correction_right",
			"dataCategories": ["Information about you"],
			"purposes": ["Enabling users to access and correct their information"],
			"recipients": [],
			"summary": "Users have the right to access and correct their information. The policy also says access, rectification, and deletion can always be requested regardless of which legal basis applies.",
			"sourceLineIds": ["L1408", "L1469"],
			"qualifications": [
				{
					"summary": "The access-and-correction right is subject to applicable law.",
					"sourceLineIds": ["L1469"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "consent_withdrawal_right",
			"dataCategories": ["Information processed on the basis of consent"],
			"purposes": ["Allowing users to withdraw consent for consent-based processing"],
			"recipients": [],
			"summary": "Where processing relies on consent, users can withdraw it at any time.",
			"sourceLineIds": ["L1479"],
			"qualifications": [
				{
					"summary": "Withdrawal does not affect the lawfulness of processing based on consent before the withdrawal.",
					"sourceLineIds": ["L1479"]
				},
				{
					"summary": "The policy directs users to Help Centers, Facebook and Instagram settings, and device-based settings to exercise rights.",
					"sourceLineIds": ["L1481"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "information_portability_right",
			"dataCategories": ["Information about you"],
			"purposes": ["Allowing users to port their information"],
			"recipients": [],
			"summary": "Users may have a right to port their information.",
			"sourceLineIds": ["L1486"],
			"qualifications": [
				{
					"summary": "The right applies only in certain cases and is subject to applicable law.",
					"sourceLineIds": ["L1486"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "information_erasure_and_account_deletion",
			"dataCategories": [
				"Information about you",
				"Posted content, including photos and status updates"
			],
			"purposes": [
				"Allowing users to request erasure, delete specific information or content, or permanently delete an account"
			],
			"recipients": [],
			"summary": "Users can request erasure, use available controls to delete certain information or content, or permanently delete a Facebook or Instagram account. Deleted content is no longer visible to other users; account deletion removes the user’s information, including posted content, subject to the policy’s retention exceptions.",
			"sourceLineIds": ["L1491", "L1495", "L1496", "L1607", "L1608"],
			"qualifications": [
				{
					"summary": "An erasure request requires valid grounds and is subject to applicable law.",
					"sourceLineIds": ["L1491"]
				},
				{
					"summary": "Deletion applies to certain information for which tools are provided; account deletion may not remove information Meta needs to retain under its retention policy.",
					"sourceLineIds": ["L1495", "L1496", "L1608"]
				},
				{
					"summary": "After permanent account deletion, the account cannot be reactivated and the user cannot retrieve information, including posted content.",
					"sourceLineIds": ["L1496", "L1608"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "deletion_timing_and_trash",
			"dataCategories": [
				"Information or content requested for deletion",
				"Deleted information in backups and disaster recovery"
			],
			"purposes": ["Carrying out deletion requests"],
			"recipients": [],
			"summary": "After an account-deletion process begins or a content-deletion request is received, deletion may take up to 90 days; removing deleted information from backups and disaster recovery may take up to another 90 days.",
			"sourceLineIds": ["L1501", "L1612"],
			"qualifications": [
				{
					"summary": "If content remains in Facebook trash or Instagram Recently Deleted, deletion begins automatically after 30 days; users can start it sooner by deleting the content from those folders.",
					"sourceLineIds": ["L1503", "L1614"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "processing_objection_and_restriction_right",
			"dataCategories": ["Information about you"],
			"purposes": ["Allowing users to object to or restrict certain processing"],
			"recipients": [],
			"summary": "Users can object to or restrict certain processing. They may object when Meta relies on legitimate interests or performs a task in the public interest; Meta assesses the objection using stated factors and says it will cease the processing if the objection is upheld.",
			"sourceLineIds": ["L1508", "L1518", "L1520", "L1521", "L1522", "L1524"],
			"qualifications": [
				{
					"summary": "Meta says it will uphold an objection unless it finds compelling legitimate grounds that are not outweighed by the user’s interests or fundamental rights and freedoms, or the processing is needed for legal reasons.",
					"sourceLineIds": ["L1524"]
				},
				{
					"summary": "The assessment considers users’ reasonable expectations, benefits and risks to users and others, and whether less invasive means are available without disproportionate effort.",
					"sourceLineIds": ["L1520", "L1521", "L1522"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "direct_marketing_unsubscribe",
			"dataCategories": ["Information used for direct marketing"],
			"purposes": ["Stopping use of information for direct marketing"],
			"recipients": [],
			"summary": "Users can use the unsubscribe link in marketing communications to stop Meta from using their information for that direct marketing.",
			"sourceLineIds": ["L1513"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "supervisory_authority_complaint",
			"dataCategories": ["Information about you"],
			"purposes": ["Enabling users to lodge a data-protection complaint"],
			"recipients": [
				"Meta Platforms Ireland Limited’s lead supervisory authority, the Irish Data Protection Commission, or the user’s local supervisory authority"
			],
			"summary": "Users may lodge a complaint with Meta Platforms Ireland Limited’s lead supervisory authority or their local supervisory authority.",
			"sourceLineIds": ["L1529"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "case_by_case_information_retention",
			"dataCategories": ["Information about you"],
			"purposes": [
				"Providing Products and features",
				"Complying with legal obligations",
				"Protecting Meta’s or others’ interests"
			],
			"recipients": [],
			"summary": "Meta keeps information for as long as it considers necessary to provide its Products, comply with legal obligations, or protect its or others’ interests. It decides retention periods case by case, considering the service or feature, applicable legal obligations, and other legitimate purposes.",
			"sourceLineIds": ["L1551", "L1553", "L1554", "L1555", "L1556"],
			"qualifications": [
				{
					"summary": "Examples of other legitimate purposes include preventing harm, investigating possible terms or policy violations, promoting safety, security, and integrity, and protecting Meta, its rights, property, or products.",
					"sourceLineIds": ["L1556"]
				},
				{
					"summary": "Information may be kept for an extended period for specific reasons, including those described in the policy’s preservation section.",
					"sourceLineIds": ["L1558"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "account_profile_and_search_retention",
			"dataCategories": [
				"Profile information",
				"Posted photos not deleted",
				"Security information",
				"Facebook search history",
				"Device and location information associated with searches"
			],
			"purposes": ["Maintaining an account", "Providing and displaying search history"],
			"recipients": [],
			"summary": "Meta says it keeps profile information, undeleted posted photos, and security information for the lifetime of an account. Facebook search history remains until the user clears it in the activity log or deletes the account; associated device or location information not needed to display the history is deleted within six months of the search.",
			"sourceLineIds": ["L1563", "L1565", "L1567"],
			"qualifications": [
				{
					"summary": "After a user clears a search or deletes the account, the search is no longer visible to the user and is deleted.",
					"sourceLineIds": ["L1565"]
				},
				{
					"summary": "The six-month deletion applies to search-related information not needed to show the search history, such as device or location information; it does not say the search history itself is deleted on that schedule.",
					"sourceLineIds": ["L1567"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "vanish_mode_message_retention",
			"dataCategories": ["Messenger vanish-mode message content"],
			"purposes": ["Operating the vanish-mode messaging feature"],
			"recipients": ["The chat participants, as described in the example"],
			"summary": "In the stated Messenger vanish-mode example, a message is deleted after the recipient reads it, or after a longer period if it is never read.",
			"sourceLineIds": ["L1572", "L1574"],
			"qualifications": [
				{
					"summary": "The example says the message disappears from the sender’s view after leaving the chat and is shown to the recipient only the first time the recipient opens the chat; deletion occurs one hour after it is read or after 14 days if it is never read.",
					"sourceLineIds": ["L1572", "L1574"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "extended_retention_and_preservation",
			"dataCategories": [
				"Information about you",
				"Financial transaction data related to purchases or money transfers",
				"Information from disabled accounts",
				"Content removed for policy violations"
			],
			"purposes": [
				"Responding to legal requests or obligations",
				"Governmental investigations",
				"Investigating possible terms or policy violations",
				"Preventing harm",
				"Safety, security, and integrity",
				"Protecting Meta, its rights, property, or products",
				"Legal claims, complaints, litigation, or regulatory proceedings"
			],
			"recipients": [],
			"summary": "Meta may preserve and access information for an extended period for specified legal, investigative, safety, security, integrity, harm-prevention, and protective purposes. This may include financial transaction data and may occur even after a user requests deletion, or for disabled accounts and content removed for violations.",
			"sourceLineIds": [
				"L1588",
				"L1590",
				"L1591",
				"L1592",
				"L1593",
				"L1594",
				"L1595",
				"L1596",
				"L1600"
			],
			"qualifications": [
				{
					"summary": "Examples include preserving information after account deletion in response to a valid legal request, retaining transaction information to meet accounting obligations, retaining information about disabled users to prevent new accounts after violations, and retaining information during reviews of suspicious activity, including suspected money laundering or terrorist funding.",
					"sourceLineIds": ["L1621", "L1625", "L1629", "L1631"]
				},
				{
					"summary": "Meta may preserve information when it deems preservation necessary for a legal claim or complaint, including to defend itself in legal proceedings.",
					"sourceLineIds": ["L1635"]
				}
			],
			"ambiguous": false,
			"negated": false
		}
	]
}
```

Exact cited source lines copied by code:

```json
[
	{
		"lineId": "L1408",
		"text": "You also have particular rights available to you depending on which legal basis we use, and we’ve explained these here. No matter what legal basis applies, you always have the right to request access to, rectification of and deletion of your information. To exercise your rights, see the \"What are your rights?\" section."
	},
	{
		"lineId": "L1415",
		"text": "We process your information that’s necessary to fulfil our contracts with you. This means providing the services laid out in the [Meta Terms of Service](https://www.facebook.com/terms.php?ref=dp&entry_point=POLICY_SUBPAGE%3A7.subpage.1-WhatIsOurLegal), the [Instagram Terms of Use](https://mbasic.facebook.com/privacy/policy/printable/https%3A%2F%2Flm.facebook.com%2Fl.php%3Fu=https%3A%2F%2Fhelp.instagram.com%2F581066165581870%2F%3Fhelpref%3Duf_share%26entry_point%3DPOLICY_SUBPAGE%253A7.subpage.1-WhatIsOurLegal), the [Supplemental Meta Platforms Technologies Terms of Service](https://www.oculus.com/legal/terms-of-service/?locale=en_GB&entry_point=POLICY_SUBPAGE%3A7.subpage.1-WhatIsOurLegal), the [Supplemental Portal Terms of Service](https://portal.facebook.com/gb/legal/terms-of-service/?entry_point=POLICY_SUBPAGE%3A7.subpage.1-WhatIsOurLegal), the [Meta AI Terms of Service](https://www.facebook.com/legal/eu-ai-terms?entry_point=POLICY_SUBPAGE%3A7.subpage.1-WhatIsOurLegal) and the [Supplemental Facebook View Terms of Service](https://www.facebook.com/help/ray-ban-stories/1247963662288636?entry_point=POLICY_SUBPAGE%3A7.subpage.1-WhatIsOurLegal), together, the “terms.”"
	},
	{
		"lineId": "L1422",
		"text": "We process your information if you give your consent."
	},
	{
		"lineId": "L1424",
		"text": "For example, if we show you ads:"
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
		"lineId": "L1429",
		"text": "You can withdraw consent at any time in [Ad preferences](https://accountscenter.facebook.com/ad_preferences/)."
	},
	{
		"lineId": "L1436",
		"text": "We process your information as necessary for our or others' legitimate interests. Our interests include providing an innovative, personalised, safe and profitable service to our users and partners, and responding to legal requests. But we won’t process your information if your interests, or your fundamental rights and freedoms, override ours. Where we rely on legitimate interests, you have the right to object to our use of certain information."
	},
	{
		"lineId": "L1443",
		"text": "We process information if it will protect you or prevent harm, like saving your life or someone else’s."
	},
	{
		"lineId": "L1450",
		"text": "We process information as necessary for us to comply with a legal obligation."
	},
	{
		"lineId": "L1457",
		"text": "We process information as necessary for the public interest, such as conducting research or promoting safety, security and integrity."
	},
	{
		"lineId": "L1469",
		"text": "You have the right to access and correct your information, subject to applicable law."
	},
	{
		"lineId": "L1479",
		"text": "Where we rely on your consent to process your information, you can withdraw your consent at any time. If you choose to withdraw your consent this will not affect the lawfulness of processing based on consent before its withdrawal."
	},
	{
		"lineId": "L1481",
		"text": "To exercise your rights, visit our Help Centers, your settings for Facebook and Instagram and your device-based settings."
	},
	{
		"lineId": "L1486",
		"text": "In certain cases and subject to applicable law, you have the right to [port your information](https://www.facebook.com/tyi/?source=yfi_web_settings&entry_point=POLICY_SUBPAGE%3A7.subpage.7-PortYourInformationIn)."
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
		"lineId": "L1508",
		"text": "You have the [right to object to](https://help.meta.com/support/privacy/?entry_point=POLICY_SUBPAGE%3A7.subpage.11-ObjectYouHaveThe) and restrict certain processing of your information."
	},
	{
		"lineId": "L1513",
		"text": "You can use the \"unsubscribe\" link in our marketing communications to stop us from using your information for that direct marketing."
	},
	{
		"lineId": "L1518",
		"text": "You can [object](https://help.meta.com/support/privacy/?entry_point=POLICY_SUBPAGE%3A7.subpage.11-ObjectYouHaveThe) to our processing your information when we rely on legitimate interests or perform a task in the public interest. We will consider several factors when assessing an objection, including:"
	},
	{
		"lineId": "L1520",
		"text": "*   Our users' reasonable expectations"
	},
	{
		"lineId": "L1521",
		"text": "*   The benefits and risks to you, us, other users or [third parties\\[62\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBPAGE%3A7.subpage.11-ObjectYouHaveThe#annotation-62)"
	},
	{
		"lineId": "L1522",
		"text": "*   Other available means to achieve the same purpose that may be less invasive and do not require disproportionate effort"
	},
	{
		"lineId": "L1524",
		"text": "Unless we find that we have compelling legitimate grounds for this processing which are not outweighed by your interests or fundamental rights and freedoms, or the processing is needed for legal reasons, your objection will be upheld. In that case, we will cease processing your information. To learn more about the circumstances in which an objection may be successful, please visit the [Help Center](https://www.facebook.com/help/2069235856423257?entry_point=POLICY_SUBPAGE%3A7.subpage.11-ObjectYouHaveThe)."
	},
	{
		"lineId": "L1529",
		"text": "You also can lodge a complaint with Meta Platforms Ireland Limited's lead supervisory authority, the Irish Data Protection Commission or your local supervisory authority."
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
		"lineId": "L1558",
		"text": "In some instances and for specific reasons, we’ll keep information for an extended period of time. [Read our Policy\\[66\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SECTION%3A8-HowLongDoWe#annotation-66) about when we may preserve your information."
	},
	{
		"lineId": "L1563",
		"text": "For example, we keep profile information, photos you’ve posted (and not deleted) and security information for the lifetime of your account."
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
		"lineId": "L1591",
		"text": "*   A governmental investigation"
	},
	{
		"lineId": "L1592",
		"text": "*   An investigation of possible violations of our terms or policies"
	},
	{
		"lineId": "L1593",
		"text": "*   To prevent harm"
	},
	{
		"lineId": "L1594",
		"text": "*   For safety, security and integrity purposes"
	},
	{
		"lineId": "L1595",
		"text": "*   To protect ourselves, including our rights, property or products"
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
		"lineId": "L1621",
		"text": "For example, we might preserve your information after you delete your account when we receive a valid legal request, such as a preservation order or search warrant, related to your account."
	},
	{
		"lineId": "L1625",
		"text": "For example, we preserve certain information about purchases or transactions associated with an account, in line with Meta’s accounting obligations."
	},
	{
		"lineId": "L1629",
		"text": "For example, if we disable an account for violating our terms or policies, we preserve information about that user to prevent them from opening a new account."
	},
	{
		"lineId": "L1631",
		"text": "We also might preserve some of your account information as part of our review of suspicious activity. This includes any suspicious activity associated with our financial products, like suspected money laundering or terrorist funding."
	},
	{
		"lineId": "L1635",
		"text": "We may preserve your information where we deem it necessary for reasons related to a legal claim or complaint. For example, we may be required to defend ourselves in legal proceedings in a claim related to your information."
	}
]
```

### 7. Facebook, core L1637-L1843

Starting heading: How do we transfer information?. Context before: 1634-1636; context after: 1844-1846. Source: [pinned Facebook policy](https://github.com/OpenTermsArchive/pga-versions/blob/53fdfebe3c470bb1433e830394e86fd699f485e7/Facebook/Privacy%20Policy.md).

Status: completed; 7 findings; 5532 input and 2739 output tokens; $0.00206 estimated token cost.

Actual parsed Luna output:

```json
{
	"summary": "The policy describes global information transfers and safeguards, disclosures for legal and safety purposes, extended preservation, and ways to contact Meta or complain to a supervisory authority.",
	"findings": [
		{
			"practice": "global_information_transfers",
			"dataCategories": ["Information Meta collects"],
			"purposes": [
				"Operating and providing Meta Products",
				"Enabling people to share information and connect globally",
				"Fixing, analyzing, and improving Products"
			],
			"recipients": [
				"Meta offices and data centers",
				"Partners",
				"Measurement vendors",
				"Service providers",
				"Other third parties"
			],
			"summary": "Meta transfers information globally, both within its organization and to external recipients. Information controlled by Meta Platforms Ireland Limited may be transferred, transmitted, stored, or processed in countries where Meta has infrastructure or data centers, where its Products are available, and where relevant external recipients are located.",
			"sourceLineIds": ["L1649", "L1651", "L1652", "L1657", "L1659", "L1660", "L1661"],
			"qualifications": [
				{
					"summary": "The stated locations for transfer, storage, and processing specifically concern information controlled by Meta Platforms Ireland Limited.",
					"sourceLineIds": ["L1657"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "international_transfer_safeguards",
			"dataCategories": ["Information transferred internationally"],
			"purposes": ["Providing safeguards for international data transfers"],
			"recipients": [
				"Meta Platforms, Inc. in the United States, for products and services specified in its certification"
			],
			"summary": "Meta says it uses appropriate mechanisms and safeguards for international transfers, including encrypting information in transit over public networks. Mechanisms described include adequacy decisions, the EU-U.S. and Swiss-U.S. Data Privacy Frameworks, standard contractual clauses, and legal derogations.",
			"sourceLineIds": ["L1666", "L1668", "L1700", "L1701", "L1702"],
			"qualifications": [
				{
					"summary": "The listed transfer mechanisms apply in different circumstances: adequacy decisions apply to specified destinations, the Data Privacy Framework applies to transfers to Meta Platforms, Inc. for products and services covered by its certification, and UK contractual clauses apply where appropriate; applicable-law derogations may also be used.",
					"sourceLineIds": ["L1700", "L1701", "L1702"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "legal_request_disclosures",
			"dataCategories": ["Your information"],
			"purposes": ["Responding to legal requests", "Complying with applicable law"],
			"recipients": ["Civil litigants", "Law enforcement", "Government authorities"],
			"summary": "Meta may access, preserve, use, and share information in response to legal requests, including warrants, court orders, production orders, or subpoenas, and in accordance with applicable law.",
			"sourceLineIds": ["L1731", "L1732"],
			"qualifications": [
				{
					"summary": "Meta responds when legally required and may also respond when not legally compelled if the response may affect users in that jurisdiction and is consistent with internationally recognized standards.",
					"sourceLineIds": ["L1745", "L1747", "L1748"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "safety_and_integrity_disclosures",
			"dataCategories": ["Your information"],
			"purposes": [
				"Detecting, preventing, and addressing unauthorized use or policy violations",
				"Investigating suspicious activity",
				"Protecting Meta, users, employees, property, and Products",
				"Preventing abuse, fraud, and other harmful or illegal activity",
				"Protecting people during investigations or regulatory inquiries",
				"Responding to emergencies involving risk of death or imminent bodily harm"
			],
			"recipients": [
				"Law enforcement",
				"Government authorities",
				"Meta Companies",
				"Other third parties, including industry peers"
			],
			"summary": "Meta shares information with the listed recipients when it has a good-faith belief that sharing is necessary to detect, prevent, or address safety, security, or integrity concerns, including the specified investigations and emergencies.",
			"sourceLineIds": ["L1760", "L1762", "L1763", "L1764", "L1765", "L1766", "L1767", "L1768"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "extended_information_preservation",
			"dataCategories": [
				"Your information",
				"Financial transaction data related to purchases or money transfers on Meta Products"
			],
			"purposes": [
				"Meeting legal requests or obligations and complying with applicable law",
				"Governmental investigations",
				"Investigating possible violations of terms or policies",
				"Preventing harm",
				"Safety, security, and integrity",
				"Protecting Meta's rights, property, or Products",
				"Legal claims, complaints, litigation, or regulatory proceedings"
			],
			"recipients": [],
			"summary": "Meta may preserve and access information for an extended period for the listed legal, investigative, harm-prevention, safety, security, integrity, and protective purposes. In some cases it may continue preserving information after an account or content deletion request, or retain information from disabled accounts and content removed for policy violations.",
			"sourceLineIds": [
				"L1735",
				"L1773",
				"L1775",
				"L1776",
				"L1777",
				"L1778",
				"L1779",
				"L1780",
				"L1781",
				"L1785"
			],
			"qualifications": [
				{
					"summary": "Preservation after a deletion request or for disabled accounts and removed content occurs in some cases and is based on the stated reasons for extended preservation.",
					"sourceLineIds": ["L1785"]
				},
				{
					"summary": "Examples include preserving information after account deletion in response to a valid legal request, retaining purchase or transaction information to meet accounting obligations, and keeping information about disabled accounts or suspicious activity for safety and integrity purposes.",
					"sourceLineIds": ["L1802", "L1806", "L1810", "L1812"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "privacy_contact_and_complaints",
			"dataCategories": [
				"Information about you, in connection with questions, complaints, or requests"
			],
			"purposes": ["Receiving privacy questions, complaints, and requests"],
			"recipients": [
				"Meta Platforms Ireland Limited",
				"The Irish Data Protection Commission or the individual's local supervisory authority"
			],
			"summary": "People may contact Meta about the Policy or questions, complaints, or requests regarding their information. They also have the right to lodge a complaint with the Irish Data Protection Commission, Meta Platforms Ireland's lead supervisory authority, or their local supervisory authority.",
			"sourceLineIds": ["L1826", "L1828", "L1840", "L1842"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "material_policy_change_notice",
			"dataCategories": [],
			"purposes": ["Notifying users of material Policy changes"],
			"recipients": ["Users"],
			"summary": "Meta says it will notify users before making material changes to the Policy and give them an opportunity to review the revised Policy before choosing whether to continue using its Products.",
			"sourceLineIds": ["L1821"],
			"qualifications": [
				{
					"summary": "The notice commitment concerns material changes to the Policy.",
					"sourceLineIds": ["L1821"]
				}
			],
			"ambiguous": false,
			"negated": false
		}
	]
}
```

Exact cited source lines copied by code:

```json
[
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
		"lineId": "L1731",
		"text": "*   In response to legal requests, like search warrants, court orders, production orders or subpoenas. These requests come from [third parties\\[76\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SECTION%3A10-HowDoWeRespond#annotation-76) such as civil litigants, law enforcement and other government authorities. [Learn more\\[77\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SECTION%3A10-HowDoWeRespond#annotation-77) about when we respond to legal requests."
	},
	{
		"lineId": "L1732",
		"text": "*   In accordance with applicable law"
	},
	{
		"lineId": "L1735",
		"text": "We may access or preserve your information for an extended amount of time. [Learn more\\[80\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SECTION%3A10-HowDoWeRespond#annotation-80)."
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
		"lineId": "L1763",
		"text": "*   Violations of our terms and policies. [See an example.\\[82\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_ANNOTATION%3A10.ex.2-HowWePromoteSafety#annotation-82)"
	},
	{
		"lineId": "L1764",
		"text": "*   Investigating suspicious activity"
	},
	{
		"lineId": "L1765",
		"text": "*   Protecting ourselves, including our rights, property, personnel or Products"
	},
	{
		"lineId": "L1766",
		"text": "*   Preventing abuse, fraud, or other harmful or illegal activity, on and off our Products"
	},
	{
		"lineId": "L1767",
		"text": "*   Protecting you or others, including as part of investigations or regulatory inquiries"
	},
	{
		"lineId": "L1768",
		"text": "*   Emergency situations, such as risk of death or imminent bodily harm"
	},
	{
		"lineId": "L1773",
		"text": "Your information, including financial transaction data related to purchases or money transfers made on our Products, may be preserved and accessed for a longer time period if it’s related to any of the following:"
	},
	{
		"lineId": "L1775",
		"text": "*   A legal request or obligation, including obligations of Meta Companies or to comply with applicable law"
	},
	{
		"lineId": "L1776",
		"text": "*   A governmental investigation"
	},
	{
		"lineId": "L1777",
		"text": "*   An investigation of possible violations of our terms or policies"
	},
	{
		"lineId": "L1778",
		"text": "*   To prevent harm"
	},
	{
		"lineId": "L1779",
		"text": "*   For safety, security and integrity purposes"
	},
	{
		"lineId": "L1780",
		"text": "*   To protect ourselves, including our rights, property or products"
	},
	{
		"lineId": "L1781",
		"text": "*   If it’s needed in relation to a legal claim, complaint, litigation or regulatory proceedings"
	},
	{
		"lineId": "L1785",
		"text": "In some cases, we may preserve your information based on the above reasons even after you request deletion of your account or some of your content. We may also preserve information from accounts that have been disabled and content that has been removed for violations of our terms and policies."
	},
	{
		"lineId": "L1802",
		"text": "For example, we might preserve your information after you delete your account when we receive a valid legal request, such as a preservation order or search warrant, related to your account."
	},
	{
		"lineId": "L1806",
		"text": "For example, we preserve certain information about purchases or transactions associated with an account, in line with Meta’s accounting obligations."
	},
	{
		"lineId": "L1810",
		"text": "For example, if we disable an account for violating our terms or policies, we preserve information about that user to prevent them from opening a new account."
	},
	{
		"lineId": "L1812",
		"text": "We also might preserve some of your account information as part of our review of suspicious activity. This includes any suspicious activity associated with our financial products, like suspected money laundering or terrorist funding."
	},
	{
		"lineId": "L1821",
		"text": "We'll notify you before we make material changes to this Policy. You’ll have the opportunity to review the revised Policy before you choose to continue using our Products."
	},
	{
		"lineId": "L1826",
		"text": "You can learn more about how privacy works on [Facebook](https://www.facebook.com/help?entry_point=POLICY_SECTION%3A13-HowToContactMeta) and on [Instagram](https://mbasic.facebook.com/privacy/policy/printable/https%3A%2F%2Flm.facebook.com%2Fl.php%3Fu=https%3A%2F%2Fhelp.instagram.com%2F196883487377501%3Fref%3Ddp%26entry_point%3DPOLICY_SECTION%253A13-HowToContactMeta), and in the [Facebook Help Center](https://www.facebook.com/help/?entry_point=POLICY_SECTION%3A13-HowToContactMeta). If you have questions about this Policy, or have questions, complaints or requests regarding your information, you can contact us as described below."
	},
	{
		"lineId": "L1828",
		"text": "The data controller responsible for your information is Meta Platforms Ireland Limited, which you can [contact online](https://help.meta.com/support/privacy/?entry_point=POLICY_SECTION%3A13-HowToContactMeta), or by mail at:"
	},
	{
		"lineId": "L1840",
		"text": "Contact the [Data Protection Officer](https://help.meta.com/support/privacy/?entry_point=POLICY_SECTION%3A13-HowToContactMeta) for Meta Platforms Ireland Limited."
	},
	{
		"lineId": "L1842",
		"text": "You also have the right to lodge a complaint with Meta Platforms Ireland's lead supervisory authority, the Irish Data Protection Commission, or your local supervisory authority."
	}
]
```

### 8. Facebook, core L1844-L2107

Starting heading: Legal basis information. Context before: 1841-1843; context after: 2108-2110. Source: [pinned Facebook policy](https://github.com/OpenTermsArchive/pga-versions/blob/53fdfebe3c470bb1433e830394e86fd699f485e7/Facebook/Privacy%20Policy.md).

Status: completed; 12 findings; 6589 input and 4961 output tokens; $0.00330 estimated token cost.

Actual parsed Luna output:

```json
{
	"summary": "The excerpt describes processing based on consent and contract performance, including advertising, product features, account linking, safety, and user rights concerning consent-based information.",
	"findings": [
		{
			"practice": "special_protection_information",
			"dataCategories": [
				"Sensitive information users choose to provide, such as religious, sexual-orientation, political, health, racial or ethnic, philosophical, or trade-union information"
			],
			"purposes": [
				"Share information with people the user chooses",
				"Provide, personalize, and improve Products",
				"Conduct analytics"
			],
			"recipients": ["People the user chooses"],
			"summary": "Meta collects, stores, publishes, and processes information with special protections that a user chooses to provide for sharing with chosen people and for Product-related purposes and analytics.",
			"sourceLineIds": ["L1856", "L1862"],
			"qualifications": [
				{
					"summary": "This processing is described as occurring when the user has given consent; the listed sensitive information is provided by choice and requires explicit consent.",
					"sourceLineIds": ["L1850", "L1862"]
				},
				{
					"summary": "Processing may be automated or, sometimes, manual.",
					"sourceLineIds": ["L1856"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "personalized_advertising",
			"dataCategories": [
				"Activity and content, including content created or supplied, interactions and viewing activity, feature use, transactions, hashtags, and activity timing",
				"Connections",
				"App, browser, and device information, including device characteristics, identifiers, signals, settings, location-related information, network information, performance reports, and cookie data"
			],
			"purposes": ["Personalize ads on and off Meta Company Products", "Measure ad performance"],
			"recipients": ["Meta Company Products", "Apps using Meta Audience Network"],
			"summary": "When ads are shown, Meta may use information associated with the user across accounts in their Accounts Centre to personalize ads on and off Meta Company Products, including through cookies, and to measure ad performance.",
			"sourceLineIds": ["L1868", "L1870", "L1882", "L1885", "L1895", "L1903"],
			"qualifications": [
				{
					"summary": "The policy describes this as consent-based processing; whether information is used across Accounts Centre accounts depends on the user's settings, and the practice applies if Meta shows the user ads.",
					"sourceLineIds": ["L1850", "L1868"]
				},
				{
					"summary": "Ad preferences affect personalization, and the user can change their choice at any time in Ad Preferences.",
					"sourceLineIds": ["L1870", "L1876"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "third_party_information_for_ads",
			"dataCategories": [
				"Information from partners, vendors, and other third parties about activity off Meta Company Products"
			],
			"purposes": [
				"Personalize ads on and across Meta Company Products and on websites, apps, and devices that use Meta advertising services"
			],
			"recipients": [
				"Meta Company Products",
				"Websites, apps, and devices using Meta advertising services"
			],
			"summary": "Meta uses information that partners, vendors, and other third parties provide about a user's off-Meta activity, when associated with the user, to tailor ads.",
			"sourceLineIds": ["L1949", "L1953"],
			"qualifications": [
				{
					"summary": "The policy says this applies when Meta shows ads with the user's consent, and says Meta receives this information whether or not the person is logged in or has an account on Meta Products.",
					"sourceLineIds": ["L1949"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "whatsapp_accounts_center_linking",
			"dataCategories": [
				"Meta account activity and content",
				"AI feature interactions and related metadata",
				"App, browser, and device information, including device and network information, identifiers, location-related information, and cookie data",
				"Connections"
			],
			"purposes": [
				"Associate Meta Product accounts with a WhatsApp account in the same Accounts Centre",
				"Share information with WhatsApp"
			],
			"recipients": ["WhatsApp"],
			"summary": "If a user adds a WhatsApp account to an Accounts Centre containing other Meta Product accounts, Meta associates those accounts and shares information with WhatsApp.",
			"sourceLineIds": ["L1911", "L1913", "L1921", "L1924", "L1935", "L1941"],
			"qualifications": [
				{
					"summary": "The listed information categories concern information from Meta; the policy refers readers elsewhere for information WhatsApp shares with Meta.",
					"sourceLineIds": ["L1917"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "user_directed_third_party_sharing",
			"dataCategories": [
				"Content and other information the user chooses to share, such as contact or profile information, posts, or comments"
			],
			"purposes": ["Carry out a user's request to share information with a third party"],
			"recipients": ["The third party the user directs Meta to share with, such as an advertiser"],
			"summary": "At the user's direction, Meta shares information with a third party; an example is sharing an email address or other chosen information with an advertiser so it can provide additional information about a promoted product.",
			"sourceLineIds": ["L1959", "L1965"],
			"qualifications": [
				{
					"summary": "The type of third party and information shared depend on the circumstances and on what the user asks Meta to share.",
					"sourceLineIds": ["L1959"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "device_setting_information",
			"dataCategories": [
				"Information made available through device-based settings, such as GPS location, camera, or photos"
			],
			"purposes": ["Provide the features or services described when the setting is enabled"],
			"recipients": [],
			"summary": "Meta collects information that a user allows it to receive through enabled device-based settings and uses it to provide the feature or service described when the setting is enabled.",
			"sourceLineIds": ["L1971", "L1977"],
			"qualifications": [
				{
					"summary": "Collection is limited to information the user allows Meta to receive through the device-based settings they enable.",
					"sourceLineIds": ["L1971"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "face_analysis_for_identity",
			"dataCategories": [
				"Account information and account photos",
				"A photo or video selfie, if the user chooses to provide it"
			],
			"purposes": [
				"Verify identity or an account",
				"Help protect against suspicious activity, impersonation, and identity misuse"
			],
			"recipients": [],
			"summary": "Meta uses face analysis to verify a user's identity or account and help protect against suspicious activity; this may include facial recognition technology.",
			"sourceLineIds": ["L1983", "L1989", "L1990"],
			"qualifications": [
				{
					"summary": "Facial recognition technology may be used if the user selects it; a photo or video selfie is used only if the user chooses to provide one.",
					"sourceLineIds": ["L1983", "L1990"]
				},
				{
					"summary": "The section describes processing information based on user consent.",
					"sourceLineIds": ["L1850"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "withdraw_consent",
			"dataCategories": ["Information the user provided to Meta based on consent"],
			"purposes": ["Enable the user to withdraw consent to processing"],
			"recipients": [],
			"summary": "Users may withdraw consent to processing of information they provided based on consent.",
			"sourceLineIds": ["L1992"],
			"qualifications": [
				{
					"summary": "Withdrawal does not affect the lawfulness of processing that occurred before consent was withdrawn. The policy directs users to device-based settings, Facebook and Instagram settings, and Help Centers to exercise the right.",
					"sourceLineIds": ["L1992"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "port_consent_based_information",
			"dataCategories": ["Information the user provided to Meta based on consent"],
			"purposes": ["Enable the user to port consent-based information"],
			"recipients": [],
			"summary": "Users have a right to port information they provided to Meta based on consent.",
			"sourceLineIds": ["L1992"],
			"qualifications": [
				{
					"summary": "The policy directs users to device-based settings, Facebook and Instagram settings, and Help Centers to exercise the right.",
					"sourceLineIds": ["L1992"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "non_ad_product_personalization",
			"dataCategories": [
				"Activity and content, including content created or supplied, optional-feature messages subject to applicable law, interactions, feature use, transactions, hashtags, and activity timing",
				"Connections",
				"App, browser, and device information, including device characteristics, identifiers, signals, settings, location-related information, network information, performance reports, and cookie data",
				"Information from partners, vendors, and other third parties"
			],
			"purposes": [
				"Personalize Product features and content",
				"Suggest people, groups, events, and topics"
			],
			"recipients": [],
			"summary": "Meta's systems automatically process information associated with the user and others to understand interests and preferences and provide personalized experiences across Meta Products, including personalized content and suggestions.",
			"sourceLineIds": ["L2003", "L2005", "L2006", "L2012", "L2014", "L2026", "L2036"],
			"qualifications": [
				{
					"summary": "This processing is described as necessary to perform Meta's contracts with people who have legal capacity to enter an enforceable contract.",
					"sourceLineIds": ["L1997"]
				},
				{
					"summary": "The actual information used depends on the user's circumstances. Messages are listed for optional features the user chooses to use and are subject to applicable law.",
					"sourceLineIds": ["L2008", "L2014"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "providing_meta_products",
			"dataCategories": [
				"User-provided and created content, public profile information, messages and metadata, AI feature interactions, viewed content and interactions, feature use, transactions, hashtags, activity timing, and support selfies if provided",
				"Connections",
				"App, browser, and device information, including device characteristics, identifiers, signals, settings, location-related information, network information, and cookie data",
				"Information from partners, vendors, and other third parties"
			],
			"purposes": [
				"Create and maintain accounts and profiles",
				"Connect accounts to integrated partners for sign-in or information sharing",
				"Facilitate sharing, provide and curate features, and provide messaging, voice, and video calls",
				"Provide AI features that create or understand content and perform actions",
				"Conduct analytics, facilitate purchases and payments, troubleshoot Products, develop and test products and features, and obtain feedback"
			],
			"recipients": [
				"Integrated partners, when connecting an account for sign-in or information sharing",
				"Other users or people involved in content sharing and communications, as applicable to the features used"
			],
			"summary": "To provide Meta Products, Meta collects and stores information and, where relevant, shares, profiles, reviews, and curates it. Uses include account and feature operation, communications, AI features, analytics, payments, troubleshooting, product development, and feedback.",
			"sourceLineIds": [
				"L2042",
				"L2044",
				"L2045",
				"L2046",
				"L2048",
				"L2049",
				"L2050",
				"L2051",
				"L2052",
				"L2053",
				"L2054",
				"L2060",
				"L2061",
				"L2063",
				"L2065",
				"L2068",
				"L2071",
				"L2077",
				"L2083"
			],
			"qualifications": [
				{
					"summary": "This processing is described as necessary to perform Meta's contracts with people who have legal capacity to enter an enforceable contract.",
					"sourceLineIds": ["L1997"]
				},
				{
					"summary": "Processing may include automated and manual human review. Messages and message metadata are subject to applicable law; a support selfie is included only if the user provides one when contacting account support.",
					"sourceLineIds": ["L2042", "L2063", "L2064", "L2071"]
				},
				{
					"summary": "The information actually used depends on the user's circumstances.",
					"sourceLineIds": ["L2056"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "product_safety_and_integrity",
			"dataCategories": ["Information Meta has associated with the user"],
			"purposes": [
				"Verify accounts, identity, and activity",
				"Find and address policy violations",
				"Investigate suspicious activity",
				"Detect, prevent, or combat harmful or unlawful behavior and spam",
				"Protect personnel and property and maintain Product integrity"
			],
			"recipients": [],
			"summary": "Meta processes information associated with users to support the safety, integrity, and security of its Products, including verification, investigations, policy enforcement, and prevention of harmful behavior and spam.",
			"sourceLineIds": ["L2092", "L2094", "L2095", "L2096", "L2097", "L2098", "L2099", "L2100"],
			"qualifications": [
				{
					"summary": "Processing may be automated and, in some instances, involve manual human review. In some cases, decisions about policy violations are reviewed by the Oversight Board.",
					"sourceLineIds": ["L2092", "L2095"]
				},
				{
					"summary": "This processing is described within the contract-performance section, which applies to people with legal capacity to enter an enforceable contract.",
					"sourceLineIds": ["L1997"]
				}
			],
			"ambiguous": false,
			"negated": false
		}
	]
}
```

Exact cited source lines copied by code:

```json
[
	{
		"lineId": "L1850",
		"text": "We process information as described below when you have given us your consent to do so, which we may ask through in-product experiences, to enable particular features, or to enable device-based settings. The categories of information we use and why and how they are processed are set out below:"
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
		"lineId": "L1868",
		"text": "If we show you ads, depending on your [settings](https://accountscenter.facebook.com/ads/?entry_point=POLICY_SUBSECTION%3A18.1-ConsentWeProcessInformation), we will use your information across the account(s) in your Accounts Centre to show you ads, including using cookies, to personalize your ads on and off the Meta Company Products, including apps using Meta Audience Network, and measure how those ads perform."
	},
	{
		"lineId": "L1870",
		"text": "If we show you ads, our ads system automatically processes information that we've collected and stored associated with you. In accordance with your Ad preferences, our ads system uses this information to understand your interests and your preferences and personalize your ads on and off the Meta Company Products. [Learn more](https://www.facebook.com/help/468797095528474?entry_point=POLICY_SUBSECTION%3A18.1-ConsentWeProcessInformation) about your Ad preferences."
	},
	{
		"lineId": "L1876",
		"text": "You can change your choice at any time in your Ad Preferences."
	},
	{
		"lineId": "L1882",
		"text": "*   Content that you create, such as posts, comments or audio"
	},
	{
		"lineId": "L1885",
		"text": "*   Types of content, including ads, that you view or interact with, and how you interact with it"
	},
	{
		"lineId": "L1895",
		"text": "*   Device characteristics and device software"
	},
	{
		"lineId": "L1903",
		"text": "*   Information from cookies and similar technologies"
	},
	{
		"lineId": "L1911",
		"text": "If you add a WhatsApp account to an Accounts Center with other accounts on Meta Company Products:"
	},
	{
		"lineId": "L1913",
		"text": "To associate your accounts on Meta Company Products with your WhatsApp account in the same Accounts Center and share your information with WhatsApp."
	},
	{
		"lineId": "L1917",
		"text": "Note: the list below is about information from Meta. For information that WhatsApp shares with Meta, see the [WhatsApp in Accounts Centre Supplemental Privacy Policy](https://mbasic.facebook.com/privacy/policy/printable/https%3A%2F%2Flm.facebook.com%2Fl.php%3Fu=https%3A%2F%2Fwww.whatsapp.com%2Flegal%2Faccounts-centre-supplemental-privacy-policy-eea%3Fentry_point%3DPOLICY_SUBSECTION%253A18.1-ConsentWeProcessInformation)."
	},
	{
		"lineId": "L1921",
		"text": "*   Content you create, like posts, comments or audio"
	},
	{
		"lineId": "L1924",
		"text": "*   Interactions with our features that are part of [AI at Meta](https://www.facebook.com/privacy/genai?entry_point=POLICY_SUBSECTION%3A18.1-ConsentWeProcessInformation) and related metadata. For example, information like content and messages you or others exchange with these features."
	},
	{
		"lineId": "L1935",
		"text": "*   Device characteristics and device software"
	},
	{
		"lineId": "L1941",
		"text": "*   Information about the network you connect your device to and your connection, including your IP address"
	},
	{
		"lineId": "L1949",
		"text": "Using information from partners, vendors and other third parties to tailor the ads you see: If we show you ads with your consent we'll use information that partners, vendors and other third parties provide us about activity off the Meta Company Products and that we have associated with you to personalize the ads you see on and across the Meta Company Products, and on websites, apps and devices that use our advertising services. We receive this information whether or not you're logged in or have an account on our Products, see the [Cookies Policy](https://www.facebook.com/policies/cookies/?entry_point=POLICY_SUBSECTION%3A18.1-ConsentWeProcessInformation) for more information."
	},
	{
		"lineId": "L1953",
		"text": "[Information from partners, vendors and third parties](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.1-ConsentWeProcessInformation#1.subpage.4-InformationFromPartnersVendors)"
	},
	{
		"lineId": "L1959",
		"text": "The type of third party and categories of information shared depend on the circumstances of what you ask us to share. For example, when you direct us we share your email address or other information that you might choose to share with an advertiser so that they can contact you with additional information about a promoted product."
	},
	{
		"lineId": "L1965",
		"text": "*   Content you create, like your contact, profile or other information, like posts or comments"
	},
	{
		"lineId": "L1971",
		"text": "Collecting information that you allow us to receive through the device-based settings you enable (such as access to your GPS location, camera or photos) which we use to provide the features or services described when you enable the setting."
	},
	{
		"lineId": "L1977",
		"text": "*   Information from device settings"
	},
	{
		"lineId": "L1983",
		"text": "Verifying your identity or account, or helping to protect against suspicious activity including impersonation and identity misuse, using face analysis which may include facial recognition technology if you select it."
	},
	{
		"lineId": "L1989",
		"text": "*   Your account information, account photos, or"
	},
	{
		"lineId": "L1990",
		"text": "*   your photo or video selfie, if you choose to provide it"
	},
	{
		"lineId": "L1992",
		"text": "When we process information that you provide to us based on your consent, you have the right to withdraw your consent at any time without affecting the lawfulness of processing based on consent before its withdrawal. You also have the right to port that information you provide to us based on your consent. To exercise your rights, visit your device-based settings, and visit the Facebook settings and Instagram settings and our Help Centers."
	},
	{
		"lineId": "L1997",
		"text": "For all people who have the legal capacity to enter into an enforceable contract (for example, by being the age of majority or above in their country of residence), we process information as necessary to conclude and perform our contracts with you (the [Meta Terms](https://www.facebook.com/legal/terms/update?entry_point=POLICY_SUBSECTION%3A18.2-PerformanceOfAContract) and [Instagram Terms](https://mbasic.facebook.com/privacy/policy/printable/https%3A%2F%2Flm.facebook.com%2Fl.php%3Fu=https%3A%2F%2Fhelp.instagram.com%2F581066165581870%3Fentry_point%3DPOLICY_SUBSECTION%253A18.2-PerformanceOfAContract), the [Supplemental Meta Platforms Technologies Terms of Service](https://www.oculus.com/legal/terms-of-service/?entry_point=POLICY_SUBSECTION%3A18.2-PerformanceOfAContract), the [Supplemental Portal Terms of Service](https://portal.facebook.com/gb/legal/terms-of-service/?entry_point=POLICY_SUBSECTION%3A18.2-PerformanceOfAContract), the [Meta AI Terms of Service](https://www.facebook.com/legal/eu-ai-terms?entry_point=POLICY_SUBSECTION%3A18.2-PerformanceOfAContract) and the [Supplemental Meta View Terms of Service](https://www.facebook.com/help/ray-ban-stories/1247963662288636?entry_point=POLICY_SUBSECTION%3A18.2-PerformanceOfAContract), together, the “terms\"). The purposes for which we process information for our contracts, the categories of information we use and how information is processed are set out below:"
	},
	{
		"lineId": "L2003",
		"text": "Our systems automatically process information we have collected and stored associated with you and others to assess and understand your interests and your preferences and provide you personalised experiences across the Meta Products in accordance with our terms. This is how we:"
	},
	{
		"lineId": "L2005",
		"text": "*   Personalise features and content (such as your [Facebook Feed](https://www.facebook.com/help/166738576721085?ref=dp&entry_point=POLICY_SUBSECTION%3A18.2-PerformanceOfAContract), [Instagram Feed](https://mbasic.facebook.com/privacy/policy/printable/https%3A%2F%2Flm.facebook.com%2Fl.php%3Fu=https%3A%2F%2Fhelp.instagram.com%2F1986234648360433%3Fentry_point%3DPOLICY_SUBSECTION%253A18.2-PerformanceOfAContract) and Stories); and"
	},
	{
		"lineId": "L2006",
		"text": "*   Make suggestions for you (such as people you may know, groups or events that you may be interested in or topics that you may want to follow) on and off our Products."
	},
	{
		"lineId": "L2008",
		"text": "**Information categories we use (see '[What Information do we collect?](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.2-PerformanceOfAContract#1-WhatInformationDoWe)' for more detail on each information category). The actual information we use depends on your factual circumstances, but could include any of the following:**"
	},
	{
		"lineId": "L2012",
		"text": "*   Content you create, like posts, comments or audio"
	},
	{
		"lineId": "L2014",
		"text": "*   Messages you send and receive, including their content and metadata, for optional features you choose to use, and subject to [applicable law](https://www.facebook.com/help/499392929200216?entry_point=POLICY_SUBSECTION%3A18.2-PerformanceOfAContract)."
	},
	{
		"lineId": "L2026",
		"text": "*   Device characteristics and device software"
	},
	{
		"lineId": "L2036",
		"text": "[Information from partners, vendors and third parties](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.2-PerformanceOfAContract#1.subpage.4-InformationFromPartnersVendors)"
	},
	{
		"lineId": "L2042",
		"text": "The provision of the Meta Products includes collecting, storing, and, where relevant, sharing, profiling, reviewing and curating, and in some instances not only automated processing but also manual (human) reviewing, to:"
	},
	{
		"lineId": "L2044",
		"text": "*   Create and maintain your account and profile"
	},
	{
		"lineId": "L2045",
		"text": "*   Connect your Meta Products account, including your public profile information, to an integrated partner to sign in or share your information"
	},
	{
		"lineId": "L2046",
		"text": "*   Facilitate the sharing of content and status"
	},
	{
		"lineId": "L2048",
		"text": "*   Provide messaging services, the ability to make voice and video calls and connect with others"
	},
	{
		"lineId": "L2049",
		"text": "*   Provide our features that are part of [AI at Meta](https://www.facebook.com/privacy/genai?entry_point=POLICY_SUBSECTION%3A18.2-PerformanceOfAContract) that do things like create and understand content (like text, audio, images and videos, including by understanding and recognising your use of content in the features) and perform actions"
	},
	{
		"lineId": "L2050",
		"text": "*   Undertake analytics"
	},
	{
		"lineId": "L2051",
		"text": "*   Facilitate your purchases and payments on Meta Pay or other Meta checkout experiences"
	},
	{
		"lineId": "L2052",
		"text": "*   See if our Products are working correctly, such as troubleshooting, and fixing it when it’s not working"
	},
	{
		"lineId": "L2053",
		"text": "*   Build and test out new products and features to see if they work"
	},
	{
		"lineId": "L2054",
		"text": "*   Get feedback on Meta Products and ideas for products or features"
	},
	{
		"lineId": "L2056",
		"text": "**Information categories we use (see '[What Information do we collect?](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.2-PerformanceOfAContract#1-WhatInformationDoWe)' for more detail on each information category). The actual information we use depends on your factual circumstances, but could include any of the following:**"
	},
	{
		"lineId": "L2060",
		"text": "*   Content you create, like posts, comments or audio"
	},
	{
		"lineId": "L2061",
		"text": "*   Your public profile information (including your name, username and profile picture)"
	},
	{
		"lineId": "L2063",
		"text": "*   Messages you send and receive, including their content, subject to [applicable law](https://www.facebook.com/help/499392929200216?entry_point=POLICY_SUBSECTION%3A18.2-PerformanceOfAContract)"
	},
	{
		"lineId": "L2064",
		"text": "*   Metadata about content and messages, subject to [applicable law](https://www.facebook.com/help/499392929200216?entry_point=POLICY_SUBSECTION%3A18.2-PerformanceOfAContract)"
	},
	{
		"lineId": "L2065",
		"text": "*   Interactions with our features that are part of [AI at Meta](https://www.facebook.com/privacy/genai?entry_point=POLICY_SUBSECTION%3A18.2-PerformanceOfAContract) and related metadata. For example, information like content and messages you or others exchange with these features"
	},
	{
		"lineId": "L2068",
		"text": "*   Purchases or other transactions you make, including truncated credit card information"
	},
	{
		"lineId": "L2071",
		"text": "*   Your photo or video selfie if you provide it when you contact us for account support"
	},
	{
		"lineId": "L2077",
		"text": "*   Device characteristics and device software"
	},
	{
		"lineId": "L2083",
		"text": "*   Information about the network you connect your device to, including your IP address"
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
		"lineId": "L2096",
		"text": "*   Investigate suspicious activity"
	},
	{
		"lineId": "L2097",
		"text": "*   Detect, prevent and combat harmful or unlawful behavior, such as to review and, in some cases, remove content reported to us"
	},
	{
		"lineId": "L2098",
		"text": "*   Detect and prevent spam and other bad experiences"
	},
	{
		"lineId": "L2099",
		"text": "*   Detect and stop threats to our personnel and property"
	},
	{
		"lineId": "L2100",
		"text": "*   Maintain the integrity of our Products"
	}
]
```

### 9. Facebook, core L2108-L2357

Starting heading: Legal basis information. Context before: 2105-2107; context after: 2358-2360. Source: [pinned Facebook policy](https://github.com/OpenTermsArchive/pga-versions/blob/53fdfebe3c470bb1433e830394e86fd699f485e7/Facebook/Privacy%20Policy.md).

Status: completed; 8 findings; 6340 input and 4083 output tokens; $0.00283 estimated token cost.

Actual parsed Luna output:

```json
{
	"summary": "The excerpt describes using information to provide services and communicate with users, global transfers, legally required disclosures, product personalization and advertising, and product operation and improvement. It also describes a GDPR portability right for certain contract-related information.",
	"findings": [
		{
			"practice": "provide_services",
			"dataCategories": [
				"Content and messages",
				"Interactions with features, including AI features",
				"Viewing and usage activity",
				"Purchases and transactions",
				"Device, browser, network, and cookie information",
				"Location-related information",
				"Connections and information from partners, vendors, and third parties"
			],
			"purposes": ["Provide services described in the applicable Meta Product terms"],
			"recipients": [],
			"summary": "Meta uses information it has to provide its services. The excerpt also describes processing information when necessary to conclude or perform a contract with the user.",
			"sourceLineIds": ["L2203", "L2205"],
			"qualifications": [
				{
					"summary": "If a user does not provide certain information, the experience may be affected or use of the Products may be restricted. Limited account information is necessary to create a Facebook or Instagram account.",
					"sourceLineIds": ["L2203"]
				},
				{
					"summary": "The portability right described applies to information processed as necessary to conclude or perform a contract and is stated for users under the GDPR.",
					"sourceLineIds": ["L2205"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "communicate_with_users",
			"dataCategories": [
				"Profile contact information",
				"Communications with Meta",
				"Content users create or provide",
				"Device, browser, network, and cookie information",
				"Location-related information"
			],
			"purposes": [
				"Send email or in-product communications about Meta Products, product-related issues, research, terms, and policies",
				"Respond when users contact Meta"
			],
			"recipients": ["The user"],
			"summary": "Meta uses information users provide, including contact information, to send product-related communications and uses contact information such as an email address to respond to user inquiries.",
			"sourceLineIds": ["L2139", "L2141", "L2143"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "global_information_transfers",
			"dataCategories": [
				"Content and content metadata",
				"Interactions with AI features and related metadata",
				"Viewing and usage activity",
				"Purchases and transactions",
				"Device, browser, network, and cookie information",
				"Location-related information",
				"Connections and information from partners, vendors, and third parties"
			],
			"purposes": [
				"Operate and provide Meta Product services",
				"Enable users to share information and connect with others globally",
				"Fix, analyze, and improve Products"
			],
			"recipients": [
				"Meta offices and data centers",
				"Partners",
				"Third parties",
				"Service providers"
			],
			"summary": "Meta transfers information globally, both within the company and externally, to operate and provide services and to fix, analyze, and improve its Products.",
			"sourceLineIds": ["L2168", "L2170"],
			"qualifications": [
				{
					"summary": "The policy says transfers are necessary because Meta, its users, partners, and employees are located around the world.",
					"sourceLineIds": ["L2168"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "legally_required_disclosures",
			"dataCategories": [
				"Information responsive to a particular legal request or obligation, potentially including content, messages and metadata, activity, transactions, device information, and contact or login information"
			],
			"purposes": [
				"Comply with legal obligations, including valid requests and obligations involving civil, criminal, consumer, corporate, tax, regulatory, financial, or public-sector matters"
			],
			"recipients": [
				"Regulators",
				"Law enforcement",
				"Other recipients where disclosure is required"
			],
			"summary": "When legally obligated to disclose information, Meta may access, preserve, and/or share it with regulators, law enforcement, or others. The information processed depends on the circumstances of the request or obligation.",
			"sourceLineIds": ["L2216", "L2234"],
			"qualifications": [
				{
					"summary": "Only information necessary to comply with the relevant obligation will be processed. For civil matters, this will typically be limited information such as contact and login details, though the information may vary with the circumstances.",
					"sourceLineIds": ["L2234"]
				},
				{
					"summary": "The policy gives examples of laws and requests but says the way information is processed depends on the specific circumstances.",
					"sourceLineIds": ["L2218", "L2222", "L2230"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "personalize_products_and_recommendations",
			"dataCategories": [
				"Content users create or provide",
				"Messages and, for optional features, their content and metadata",
				"Viewing and interaction activity",
				"Apps, features, and actions taken in them",
				"Purchases and transactions",
				"Hashtags and activity timing",
				"Device, browser, network, cookie, and location-related information"
			],
			"purposes": [
				"Assess and understand interests and preferences",
				"Personalize features and content",
				"Suggest people, groups, events, and topics, including on and off Meta Products"
			],
			"recipients": ["The user"],
			"summary": "Meta automatically processes information it has collected and stored about users and others to assess interests and preferences, personalize experiences, and make suggestions on and off its Products.",
			"sourceLineIds": ["L2276", "L2278", "L2279"],
			"qualifications": [
				{
					"summary": "The policy identifies a specific case for registered users under the age of majority who have limited ability to enter an enforceable contract: Meta may be unable to rely on contractual necessity for processing their information.",
					"sourceLineIds": ["L2272"]
				},
				{
					"summary": "The stated legitimate interests for this processing include additional safeguards for users under their Member State's age of consent.",
					"sourceLineIds": ["L2287", "L2289"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "select_ads",
			"dataCategories": [
				"Information used to determine interests and preferences; specific information used for ad selection is not specified here"
			],
			"purposes": [
				"Prioritize ads based on the audience advertisers want to reach and match ads to people who might be interested"
			],
			"recipients": ["The user"],
			"summary": "Meta's ads system prioritizes which ad to show based on the audience advertisers want to reach, then matches the ad to people who might be interested.",
			"sourceLineIds": ["L2281", "L2283"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "operate_and_improve_products",
			"dataCategories": [
				"Account and profile information",
				"Content and status shared through Products",
				"Messaging and calling information",
				"Information about use of AI features",
				"Analytics and product performance information"
			],
			"purposes": [
				"Create and maintain accounts and profiles",
				"Connect accounts to integrated partners for sign-in or information sharing",
				"Enable content sharing, messaging, voice and video calls, advertising, and AI features",
				"Curate features, conduct analytics, troubleshoot, and fix Products",
				"Develop, test, and improve products and features and conduct research and surveys"
			],
			"recipients": ["Integrated partners, for sign-in or information sharing"],
			"summary": "Providing Meta Products involves collecting and storing information and, where relevant, sharing, profiling, reviewing, curating, automated processing, and sometimes manual review. Meta also uses information to develop, research, test, and improve its Products.",
			"sourceLineIds": [
				"L2328",
				"L2330",
				"L2331",
				"L2332",
				"L2333",
				"L2334",
				"L2335",
				"L2336",
				"L2337",
				"L2338",
				"L2340",
				"L2342",
				"L2343",
				"L2344",
				"L2345"
			],
			"qualifications": [
				{
					"summary": "The policy identifies a specific case for registered users under the age of majority who have limited ability to enter an enforceable contract: Meta may be unable to rely on contractual necessity for processing their information.",
					"sourceLineIds": ["L2324"]
				},
				{
					"summary": "The stated legitimate interests include additional safeguards for users under the age of consent.",
					"sourceLineIds": ["L2349", "L2351"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "gdpr_data_portability",
			"dataCategories": [
				"Information processed as necessary to conclude or perform a contract with the user"
			],
			"purposes": ["Allow users to exercise a right to port qualifying information"],
			"recipients": ["The user or a third party requested by the user"],
			"summary": "Under the GDPR, users have a right to port information processed as necessary to conclude or perform their contracts with Meta.",
			"sourceLineIds": ["L2205"],
			"qualifications": [
				{
					"summary": "The right is described for contract-necessary processing under the GDPR; the policy directs users to Facebook or Instagram settings or the Help Centers to exercise it.",
					"sourceLineIds": ["L2205"]
				}
			],
			"ambiguous": false,
			"negated": false
		}
	]
}
```

Exact cited source lines copied by code:

```json
[
	{
		"lineId": "L2139",
		"text": "We use information you’ve given us (like contact information on your profile) to send you a communication, like an e-mail or in-product notice, for example:"
	},
	{
		"lineId": "L2141",
		"text": "*   We’ll contact you via email or in-product notifications in relation to the Meta Products, product-related issues, research or to let you know about our terms and policies."
	},
	{
		"lineId": "L2143",
		"text": "We also use contact information like your e-mail address to respond when you contact us."
	},
	{
		"lineId": "L2168",
		"text": "We share information we collect globally, both internally across our offices and data centers and externally with our partners, third parties and service providers. Because Meta is global, with users, partners and employees around the world, transfers are necessary to:"
	},
	{
		"lineId": "L2170",
		"text": "*   Operate and provide the services described in the terms that apply to the Meta Product(s) you are using. This includes allowing you to share information and connect with your family and friends around the globe; and"
	},
	{
		"lineId": "L2203",
		"text": "We'll use the information we have to provide these services; if you choose not to provide certain information (other than limited account information which is necessary to create a [Facebook account](https://www.facebook.com/help/188157731232424?entry_point=POLICY_SUBSECTION%3A18.2-PerformanceOfAContract) or an [Instagram account](https://mbasic.facebook.com/privacy/policy/printable/https%3A%2F%2Flm.facebook.com%2Fl.php%3Fu=https%3A%2F%2Fhelp.instagram.com%2F155940534568753%3Fentry_point%3DPOLICY_SUBSECTION%253A18.2-PerformanceOfAContract)), your experience using the Meta Products may be affected. For example, you may see less relevant recommendations on the Products, or your use of the Products may be restricted."
	},
	{
		"lineId": "L2205",
		"text": "When we process information that you provide to us as necessary for concluding or performing our contracts with you, you have the right to port it under the GDPR. To exercise your rights, visit the Facebook settings and Instagram settings, or learn more in our Help Centers."
	},
	{
		"lineId": "L2216",
		"text": "Where we are under an obligation to disclose information such as, for example, if we receive a valid legal request for certain information (such as an Irish search warrant), we will access, preserve and / or share your information with regulators, law enforcement or others."
	},
	{
		"lineId": "L2218",
		"text": "The way in which the information will be processed depends on the specific circumstances, see [How do we respond to legal requests, prevent harm and promote safety and integrity?](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.3-ComplianceWithALegal#10-HowDoWeRespond) for more. [Information for Law Enforcement Authorities](https://www.meta.com/safety/communities/law/guidelines/?entry_point=POLICY_SUBSECTION%3A18.3-ComplianceWithALegal) provides information on the operational guidelines law enforcement needs to follow."
	},
	{
		"lineId": "L2222",
		"text": "*   Civil and commercial matters: where we are in receipt of a court order or otherwise required to disclose information for the purposes of court proceedings, such as under Regulation (EU) No 1215/2012 on jurisdiction and the recognition and enforcement of judgments in civil and commercial matters."
	},
	{
		"lineId": "L2230",
		"text": "View the [current list of laws](https://www.facebook.com/help/264930705713965?entry_point=POLICY_SUBSECTION%3A18.3-ComplianceWithALegal) which are enforceable in Ireland that give rise to a legal obligation for Meta which results in the processing of information. New laws may be enacted or other obligations may become binding on our processing of your information which may require us to process your information and we will update this list from time to time."
	},
	{
		"lineId": "L2234",
		"text": "The categories of information depend on the specific circumstances of each mandatory request or obligation. Only the information necessary to comply with the relevant legal obligation will be processed. For example, for civil matters, this will typically include limited information (such as contact details and login information). However, depending on the circumstances it could include the following:"
	},
	{
		"lineId": "L2272",
		"text": "ⓘ For registered users of the Meta Products under the age of majority (under 18, in most applicable countries) who have a limited ability to enter into an enforceable contract only, where we may be unable to process your information on the grounds of contractual necessity."
	},
	{
		"lineId": "L2276",
		"text": "Our systems automatically process information we have collected and stored associated with you and others to assess and understand your interests and your preferences and provide you personalised experiences across the Meta Products in accordance with our terms. This is how we:"
	},
	{
		"lineId": "L2278",
		"text": "*   Personalise features and content (such as your [News Feed](https://www.facebook.com/help/166738576721085?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely), [Instagram Feed](https://mbasic.facebook.com/privacy/policy/printable/https%3A%2F%2Flm.facebook.com%2Fl.php%3Fu=https%3A%2F%2Fhelp.instagram.com%2F1986234648360433%3Fentry_point%3DPOLICY_SUBSECTION%253A18.4-LegitimateInterestsWeRely) and Stories),"
	},
	{
		"lineId": "L2279",
		"text": "*   Make suggestions for you (such as people you may know, groups or events that you may be interested in or topics that you may want to follow) on and off our Products."
	},
	{
		"lineId": "L2281",
		"text": "Our ads system prioritizes what ad to show you based on what audience advertisers want to reach. Then we match the ad to people who might be interested. [Learn more\\[84\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely#annotation-84) about how our ads system works."
	},
	{
		"lineId": "L2283",
		"text": "[Learn more](https://www.facebook.com/ads/about?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely) about how we choose the ads that you see."
	},
	{
		"lineId": "L2287",
		"text": "*   To create, provide, support and maintain innovative products and features that enable people under the age of majority to express themselves, communicate, discover and engage with information and communities relevant to their interests, build community and utilise tools and features that promote their well-being."
	},
	{
		"lineId": "L2289",
		"text": "*   To provide, personalize and improve the Meta Products in a consistent manner while ensuring additional safeguards for those under their Member State's age of consent."
	},
	{
		"lineId": "L2324",
		"text": "ⓘ For registered users of the Meta Products under the age of majority (under 18, in most applicable countries) who have a limited ability to enter into an enforceable contract only, where we may be unable to process your information on the grounds of contractual necessity."
	},
	{
		"lineId": "L2328",
		"text": "The provision of Meta Products includes collecting, storing, and, where relevant, sharing, profiling, reviewing and curating, automated processing, and in some instances manual (human) reviewing, to:"
	},
	{
		"lineId": "L2330",
		"text": "*   Create and maintain your account and profile"
	},
	{
		"lineId": "L2331",
		"text": "*   Connect your Meta Products account, including your public profile information, to an integrated partner to sign in or share your information"
	},
	{
		"lineId": "L2332",
		"text": "*   Facilitate the sharing of content and status"
	},
	{
		"lineId": "L2333",
		"text": "*   Provide and curate features"
	},
	{
		"lineId": "L2334",
		"text": "*   Provide messaging services, the ability to make voice and video calls and connect with others"
	},
	{
		"lineId": "L2335",
		"text": "*   Provide advertising products"
	},
	{
		"lineId": "L2336",
		"text": "*   Provide and curate [AI at Meta](https://www.facebook.com/privacy/genai?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely) in our Products, enabling the creation of content like text, audio, images and videos, including by understanding and recognising your use of content in the features"
	},
	{
		"lineId": "L2337",
		"text": "*   Undertake analytics"
	},
	{
		"lineId": "L2338",
		"text": "*   See if our Products are working correctly, such as troubleshooting, and fixing it when it’s not working."
	},
	{
		"lineId": "L2340",
		"text": "We also use information we have to develop, research and test improvements to Meta Products. We use information we collect to:"
	},
	{
		"lineId": "L2342",
		"text": "*   Develop and improve products and features"
	},
	{
		"lineId": "L2343",
		"text": "*   Build and test out new products and features to see if they work"
	},
	{
		"lineId": "L2344",
		"text": "*   Get feedback on our ideas for products or features"
	},
	{
		"lineId": "L2345",
		"text": "*   Conduct surveys and other research on what we can do better for Meta Products and brands"
	},
	{
		"lineId": "L2349",
		"text": "*   In our interest to create, provide, support and maintain innovative products and features that enable people under the age of majority to express themselves, communicate, discover and engage with information and communities relevant to their interests, build community and utilise tools and features that promote their well-being."
	},
	{
		"lineId": "L2351",
		"text": "*   In our interest to provide, personalize and improve Meta Products while ensuring additional safeguards for those under the age of consent."
	}
]
```

### 10. Facebook, core L2358-L2639

Starting heading: Legal basis information. Context before: 2355-2357; context after: 2640-2642. Source: [pinned Facebook policy](https://github.com/OpenTermsArchive/pga-versions/blob/53fdfebe3c470bb1433e830394e86fd699f485e7/Facebook/Privacy%20Policy.md).

Status: completed; 6 findings; 6609 input and 4665 output tokens; $0.00316 estimated token cost.

Actual parsed Luna output:

```json
{
	"summary": "The policy describes processing for safety and security, communications, business and advertising measurement, AI development, and product improvement. The information used varies by circumstance; the stated information categories are examples of what could be used.",
	"findings": [
		{
			"practice": "safety_integrity_security",
			"dataCategories": [
				"User-created content, including posts, comments, and audio",
				"Camera, camera-roll, and voice-feature content",
				"Message content and message metadata",
				"Interactions with AI at Meta features and related metadata",
				"Content viewed or interacted with and interaction patterns",
				"Apps and features used and actions taken",
				"Purchases and transactions, including truncated credit card information",
				"Hashtags and activity timing, frequency, and duration",
				"Device characteristics, software, signals, and identifiers",
				"Device activity, settings information, and location-related information",
				"Network information, including IP address",
				"Cookie and similar technology information"
			],
			"purposes": [
				"Verify accounts and activity",
				"Find and address violations of terms or policies",
				"Investigate suspicious activity",
				"Detect, prevent, and combat harmful or unlawful behavior",
				"Detect and prevent spam and other bad experiences",
				"Protect personnel and property",
				"Maintain product integrity and promote safety and security"
			],
			"recipients": [],
			"summary": "Meta says it processes information associated with users to protect the safety, integrity, and security of its products and their users. It uses automated processing and, in some instances, manual human review.",
			"sourceLineIds": [
				"L2392",
				"L2394",
				"L2395",
				"L2396",
				"L2397",
				"L2398",
				"L2399",
				"L2400",
				"L2413",
				"L2414",
				"L2415",
				"L2416",
				"L2417",
				"L2418",
				"L2419",
				"L2420",
				"L2421",
				"L2422",
				"L2428",
				"L2429",
				"L2430",
				"L2431",
				"L2432",
				"L2433",
				"L2434",
				"L2435"
			],
			"qualifications": [
				{
					"summary": "For registered users under the age of majority who have limited ability to enter an enforceable contract, Meta says it may be unable to rely on contractual necessity as the basis for processing.",
					"sourceLineIds": ["L2388"]
				},
				{
					"summary": "Some decisions about violations may be reviewed by the Oversight Board.",
					"sourceLineIds": ["L2395"]
				},
				{
					"summary": "The information used depends on the user's circumstances; the listed categories are possible examples.",
					"sourceLineIds": ["L2409"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "user_communications",
			"dataCategories": [
				"Profile contact information and communications with Meta",
				"User-created content, including posts, comments, and audio",
				"Camera, camera-roll, and voice-feature content",
				"Device characteristics, software, and signals",
				"Device activity, settings information, and identifiers",
				"Location-related information",
				"Network information, including IP address",
				"Cookie and similar technology information"
			],
			"purposes": [
				"Send email or in-product notices about Meta products, product-related issues, research, terms, and policies",
				"Respond when a user contacts Meta"
			],
			"recipients": ["The user"],
			"summary": "Meta says it uses information a user has provided, including profile contact information, to send product-related communications and uses contact information such as an email address to respond to the user.",
			"sourceLineIds": [
				"L2445",
				"L2447",
				"L2449",
				"L2459",
				"L2460",
				"L2461",
				"L2465",
				"L2466",
				"L2467",
				"L2468",
				"L2469",
				"L2470",
				"L2471",
				"L2472"
			],
			"qualifications": [
				{
					"summary": "For registered users under the age of majority who have limited ability to enter an enforceable contract, Meta says it may be unable to rely on contractual necessity; it identifies meaningful product updates to underage users as a legitimate interest.",
					"sourceLineIds": ["L2441", "L2453"]
				},
				{
					"summary": "The information used depends on the user's circumstances; the listed categories are possible examples.",
					"sourceLineIds": ["L2455"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "business_measurement_analytics",
			"dataCategories": [
				"User-created content, including posts, comments, and audio",
				"Camera, camera-roll, and voice-feature content",
				"Interactions with AI at Meta features and related metadata",
				"Content viewed or interacted with and interaction patterns",
				"Apps and features used and actions taken",
				"Purchases and transactions",
				"Hashtags and activity timing, frequency, and duration",
				"Device characteristics, software, signals, and identifiers",
				"Device activity, settings information, and location-related information",
				"Network and connection information, including IP address",
				"Reports about product performance on the device",
				"Cookie and similar technology information"
			],
			"purposes": [
				"Measure the effectiveness and distribution of businesses' and partners' content and services",
				"Report on audiences, content performance, and how people interact with partners' products, services, websites, and apps",
				"Provide aggregated user analytics and insights",
				"Support pricing, performance statistics, billing options, and partners' business evaluation"
			],
			"recipients": ["Businesses", "Other partners"],
			"summary": "Meta says it processes information about users and others to provide businesses and partners with insights and measurement reports, as well as aggregated user analytics and insights. The reports can help recipients understand audiences, content performance, and interactions with their offerings.",
			"sourceLineIds": [
				"L2480",
				"L2482",
				"L2483",
				"L2487",
				"L2488",
				"L2494",
				"L2495",
				"L2496",
				"L2497",
				"L2498",
				"L2499",
				"L2500",
				"L2501",
				"L2507",
				"L2508",
				"L2509",
				"L2510",
				"L2511",
				"L2512",
				"L2513",
				"L2514",
				"L2515"
			],
			"qualifications": [
				{
					"summary": "The policy describes aggregated user analytics and insights, but does not say that every measurement report is aggregated.",
					"sourceLineIds": ["L2482", "L2483"]
				},
				{
					"summary": "The information used depends on the user's circumstances; the listed categories are possible examples.",
					"sourceLineIds": ["L2490"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "advertising_measurement_analytics",
			"dataCategories": [
				"User-created content, including posts, comments, and audio",
				"Camera, camera-roll, and voice-feature content",
				"Content viewed or interacted with and interaction patterns",
				"Apps and features used and actions taken",
				"Purchases and transactions",
				"Hashtags and activity timing, frequency, and duration",
				"Device characteristics, software, signals, and identifiers",
				"Device activity, settings information, and location-related information",
				"Network and connection information, including IP address",
				"Reports about product performance on the device",
				"Cookie and similar technology information"
			],
			"purposes": [
				"Measure the effectiveness and distribution of ads, content, and services",
				"Report on audiences and ad or content performance on and off Meta products",
				"Provide aggregated user analytics and insights",
				"Support pricing, performance statistics, billing options, and partners' evaluation of advertising and other offerings"
			],
			"recipients": ["Businesses", "Advertisers", "Other partners"],
			"summary": "When Meta shows a user ads, it says it processes information about users and others to provide advertisers, businesses, and other partners with advertising measurement reports and aggregated analytics about audiences and performance.",
			"sourceLineIds": [
				"L2525",
				"L2527",
				"L2529",
				"L2531",
				"L2532",
				"L2536",
				"L2537",
				"L2543",
				"L2544",
				"L2545",
				"L2546",
				"L2547",
				"L2548",
				"L2549",
				"L2555",
				"L2556",
				"L2557",
				"L2558",
				"L2559",
				"L2560",
				"L2561",
				"L2562",
				"L2563"
			],
			"qualifications": [
				{
					"summary": "This practice is described for the circumstance in which Meta shows the user ads.",
					"sourceLineIds": ["L2525"]
				},
				{
					"summary": "The policy describes aggregated user analytics and insights, but does not say that every measurement report is aggregated.",
					"sourceLineIds": ["L2531", "L2532"]
				},
				{
					"summary": "The information used depends on the user's circumstances; the listed categories are possible examples.",
					"sourceLineIds": ["L2539"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "develop_and_improve_ai",
			"dataCategories": [
				"Interactions with AI at Meta features and related metadata, including content and messages exchanged with those features"
			],
			"purposes": [
				"Develop and improve AI for Meta products and for third parties",
				"Create, provide, support, improve, and maintain AI technology",
				"Improve model responses for safety and accuracy"
			],
			"recipients": [],
			"summary": "Meta says it uses information from interactions with AI at Meta features and related metadata to develop and improve AI technology for Meta products and third parties. It identifies safety and accuracy improvements as an objective.",
			"sourceLineIds": ["L2575", "L2579", "L2580", "L2581", "L2587"],
			"qualifications": [
				{
					"summary": "The policy describes this purpose as applying to all registered users of Meta products, including users under the age of majority.",
					"sourceLineIds": ["L2571"]
				},
				{
					"summary": "The listed user information is described as information that could be used, depending on the user's circumstances.",
					"sourceLineIds": ["L2583"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "improve_meta_products",
			"dataCategories": [
				"User-created content, including posts, comments, and audio",
				"Public information, including name, username, and profile picture",
				"Camera, camera-roll, and voice-feature content",
				"Interactions with AI at Meta features and related metadata",
				"Message content and message metadata",
				"Content viewed or interacted with and interaction patterns",
				"Apps and features used and actions taken",
				"Purchases and transactions, including truncated credit card information",
				"Hashtags and activity timing, frequency, and duration",
				"Photo or video selfie provided for account support",
				"Device characteristics, software, signals, and identifiers",
				"Device activity, settings information, and location-related information",
				"Network information, including IP address",
				"Cookie and similar technology information"
			],
			"purposes": [
				"Evaluate the impact of new products and features through research and analytics",
				"Collect feedback on product or feature ideas",
				"Conduct surveys and research to determine product improvements",
				"Inform future feature development and product direction"
			],
			"recipients": [],
			"summary": "Meta says it uses collected information to research and evaluate products and features, gather feedback, conduct surveys, and improve existing products or develop new features.",
			"sourceLineIds": [
				"L2597",
				"L2599",
				"L2600",
				"L2601",
				"L2605",
				"L2606",
				"L2607",
				"L2608",
				"L2614",
				"L2615",
				"L2616",
				"L2617",
				"L2618",
				"L2619",
				"L2620",
				"L2621",
				"L2622",
				"L2623",
				"L2624",
				"L2625",
				"L2631",
				"L2632",
				"L2633",
				"L2634",
				"L2635",
				"L2636",
				"L2637",
				"L2638"
			],
			"qualifications": [
				{
					"summary": "The policy describes this purpose as applying to all registered users of Meta products, including users under the age of majority.",
					"sourceLineIds": ["L2593"]
				},
				{
					"summary": "Messages and message metadata are subject to applicable law.",
					"sourceLineIds": ["L2618", "L2619"]
				},
				{
					"summary": "The information used depends on the user's circumstances; the listed categories are possible examples.",
					"sourceLineIds": ["L2610"]
				}
			],
			"ambiguous": false,
			"negated": false
		}
	]
}
```

Exact cited source lines copied by code:

```json
[
	{
		"lineId": "L2388",
		"text": "ⓘ For registered users of the Meta Products under the age of majority (under 18, in most applicable countries) who have a limited ability to enter into an enforceable contract only, where we may be unable to process your information on the grounds of contractual necessity."
	},
	{
		"lineId": "L2392",
		"text": "The Meta Products are designed to help ensure the safety, integrity and security of those services and those people who enjoy them. We process information we have associated with you and apply automated processing techniques and, in some instances, conduct manual (human) review to:"
	},
	{
		"lineId": "L2394",
		"text": "*   Verify accounts and activity,"
	},
	{
		"lineId": "L2395",
		"text": "*   Find and address violations of our terms or policies. In some cases, the decisions we make about violations are reviewed by the Oversight Board,"
	},
	{
		"lineId": "L2396",
		"text": "*   Investigate suspicious activity,"
	},
	{
		"lineId": "L2397",
		"text": "*   Detect, prevent and combat harmful or unlawful behavior, such as to review, and in some cases remove, content reported to us,"
	},
	{
		"lineId": "L2398",
		"text": "*   Detect and prevent spam and other bad experiences,"
	},
	{
		"lineId": "L2399",
		"text": "*   Detect and stop threats to our personnel and property, and"
	},
	{
		"lineId": "L2400",
		"text": "*   Maintain the integrity of our Products."
	},
	{
		"lineId": "L2409",
		"text": "**Information categories we use (see '[What Information do we collect?](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely#1-WhatInformationDoWe)' for more detail on each information category). The actual information we use depends on your factual circumstances, but could include any of the following:**"
	},
	{
		"lineId": "L2413",
		"text": "*   Content you create, like posts, comments or audio"
	},
	{
		"lineId": "L2414",
		"text": "*   Content you provide through our camera feature or your camera roll settings, or through our voice-enabled features"
	},
	{
		"lineId": "L2415",
		"text": "*   Messages you send and receive, including their content, subject to [applicable law](https://www.facebook.com/help/499392929200216?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely)"
	},
	{
		"lineId": "L2416",
		"text": "*   Metadata about content and messages, subject to [applicable law](https://www.facebook.com/help/499392929200216?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely)"
	},
	{
		"lineId": "L2417",
		"text": "*   Interactions with our features that are part of [AI at Meta](https://www.facebook.com/privacy/genai?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely) and related metadata. For example, information like content and messages you or others exchange with these features"
	},
	{
		"lineId": "L2418",
		"text": "*   Types of content you view or interact with, and how you interact with it"
	},
	{
		"lineId": "L2419",
		"text": "*   Apps and features you use, and what actions you take in them"
	},
	{
		"lineId": "L2420",
		"text": "*   Purchases or other transactions you make, including truncated credit card information"
	},
	{
		"lineId": "L2421",
		"text": "*   Hashtags you use"
	},
	{
		"lineId": "L2422",
		"text": "*   The time, frequency and duration of your activities on our Products"
	},
	{
		"lineId": "L2428",
		"text": "*   Device characteristics and device software"
	},
	{
		"lineId": "L2429",
		"text": "*   What you’re doing on your device, like whether our app is in the foreground or if your mouse is moving (which can help tell humans from bots)"
	},
	{
		"lineId": "L2430",
		"text": "*   Identifiers that tell your device apart from other users’"
	},
	{
		"lineId": "L2431",
		"text": "*   Device signals"
	},
	{
		"lineId": "L2432",
		"text": "*   Information you’ve shared through your device settings"
	},
	{
		"lineId": "L2433",
		"text": "*   Location-related information"
	},
	{
		"lineId": "L2434",
		"text": "*   Information about the network you connect your device to, including your IP address"
	},
	{
		"lineId": "L2435",
		"text": "*   Information from cookies and similar technologies"
	},
	{
		"lineId": "L2441",
		"text": "ⓘ For registered users of the Meta Products under the age of majority (under 18, in most applicable countries) who have a limited ability to enter into an enforceable contract only, where we may be unable to process your information on the grounds of contractual necessity."
	},
	{
		"lineId": "L2445",
		"text": "We use information you have given us (like contact information you’ve entered on your profile) to send you a communication, like an e-mail or in-product notice, for example:"
	},
	{
		"lineId": "L2447",
		"text": "*   we’ll contact you via email or in-product notifications in relation to the Meta Products, product-related issues, research or to let you know about our terms and policies."
	},
	{
		"lineId": "L2449",
		"text": "We also use contact information like your email address to respond to you when you contact us."
	},
	{
		"lineId": "L2453",
		"text": "*   To share meaningful updates with our users under the age of majority about our Products and promoting our Products."
	},
	{
		"lineId": "L2455",
		"text": "**Information categories we use (see '[What Information do we collect?](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely#1-WhatInformationDoWe)' for more detail on each information category). The actual information we use depends on your factual circumstances, but could include any of the following:**"
	},
	{
		"lineId": "L2459",
		"text": "*   Contact information on your profile and your communications with us"
	},
	{
		"lineId": "L2460",
		"text": "*   Content you create, like posts, comments or audio"
	},
	{
		"lineId": "L2461",
		"text": "*   Content you provide through our camera feature or your camera roll settings, or through our voice-enabled features"
	},
	{
		"lineId": "L2465",
		"text": "*   Device characteristics and device software"
	},
	{
		"lineId": "L2466",
		"text": "*   What you’re doing on your device, like whether our app is in the foreground or if your mouse is moving (which can help tell humans from bots)"
	},
	{
		"lineId": "L2467",
		"text": "*   Identifiers that tell your device apart from other users’"
	},
	{
		"lineId": "L2468",
		"text": "*   Device signals"
	},
	{
		"lineId": "L2469",
		"text": "*   Information you’ve shared through your device settings"
	},
	{
		"lineId": "L2470",
		"text": "*   Location-related information"
	},
	{
		"lineId": "L2471",
		"text": "*   Information about the network you connect your device to, including your IP address"
	},
	{
		"lineId": "L2472",
		"text": "*   Information from cookies and similar technologies"
	},
	{
		"lineId": "L2480",
		"text": "Our systems automatically, as well as with some manual (human) processing, process information we have collected and stored about you and others. We use this information to:"
	},
	{
		"lineId": "L2482",
		"text": "*   Provide insights and measurement reports to businesses, and other partners to help them measure the effectiveness and distribution of their, or their client's content and services, to understand the kinds of people who are seeing their content and how their content is performing on and off the Meta Products, and"
	},
	{
		"lineId": "L2483",
		"text": "*   Provide aggregated user analytics and insights reports that help users, businesses, and other partners better understand things like the audiences with whom they may want to connect, as well as the types of people who use their products and services and how people interact with their content, websites, apps, products and services, including to connect to Meta Products, and the performance of their connection and networks and users’ experience with them."
	},
	{
		"lineId": "L2487",
		"text": "*   In our interest to provide accurate and reliable reporting to our businesses, and other partners, to ensure accurate pricing and statistics on performance and to demonstrate the value that our partners realise using Meta Company Products, and to provide suitable payment and billing options to our other partners; and"
	},
	{
		"lineId": "L2488",
		"text": "*   In the interests of developers and other partners to help them understand their customers and improve their businesses, validate our pricing models and evaluate the effectiveness of their products, services, online content on and off the Meta Company Products."
	},
	{
		"lineId": "L2490",
		"text": "**Information categories we use (see '[What Information do we collect?](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely#1-WhatInformationDoWe)' for more detail on each information category). The actual information we use depends on your factual circumstances, but could include any of the following:**"
	},
	{
		"lineId": "L2494",
		"text": "*   Content you create, like posts, comments or audio"
	},
	{
		"lineId": "L2495",
		"text": "*   Content you provide through our camera feature or your camera roll settings, or through our voice-enabled features"
	},
	{
		"lineId": "L2496",
		"text": "*   Interactions with our features that are part of [AI at Meta](https://www.facebook.com/privacy/genai?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely) and related metadata. For example, information like content and messages you or others exchange with these features"
	},
	{
		"lineId": "L2497",
		"text": "*   Types of content you view or interact with, and how you interact with it"
	},
	{
		"lineId": "L2498",
		"text": "*   Apps and features you use, and what actions you take in them"
	},
	{
		"lineId": "L2499",
		"text": "*   Purchases or other transactions you make"
	},
	{
		"lineId": "L2500",
		"text": "*   Hashtags you use"
	},
	{
		"lineId": "L2501",
		"text": "*   The time, frequency and duration of your activities on our Products"
	},
	{
		"lineId": "L2507",
		"text": "*   Device characteristics and device software"
	},
	{
		"lineId": "L2508",
		"text": "*   What you’re doing on your device, like whether our app is in the foreground or if your mouse is moving (which can help tell humans from bots)"
	},
	{
		"lineId": "L2509",
		"text": "*   Identifiers that tell your device apart from other users"
	},
	{
		"lineId": "L2510",
		"text": "*   Device signals"
	},
	{
		"lineId": "L2511",
		"text": "*   Information you’ve shared through your device settings"
	},
	{
		"lineId": "L2512",
		"text": "*   Location-related information"
	},
	{
		"lineId": "L2513",
		"text": "*   Information about the network you connect your device to and your connection, including your IP address"
	},
	{
		"lineId": "L2514",
		"text": "*   Reports about our Products' performance on your device"
	},
	{
		"lineId": "L2515",
		"text": "*   Information from cookies and similar technologies"
	},
	{
		"lineId": "L2525",
		"text": "If we show you ads:"
	},
	{
		"lineId": "L2527",
		"text": "Providing measurement, analytics and other business services to businesses, advertisers and other partners:"
	},
	{
		"lineId": "L2529",
		"text": "Our systems automatically, as well as with some manual (human) processing, process information we have collected and stored about you and others. We use this information to:"
	},
	{
		"lineId": "L2531",
		"text": "*   Provide insights and measurement reports to businesses, advertisers and other partners to help them measure the effectiveness and distribution of their, or their client's ads, content and services, to understand the kinds of people who are seeing their content and ads, and how their content and ads are performing on and off the Meta Company Products, and"
	},
	{
		"lineId": "L2532",
		"text": "*   Provide aggregated user analytics and insights reports that help businesses, advertisers and other partners better understand things like the audiences with whom they may want to connect, as well as the types of people who use their products and services and how people interact with their websites, apps, products and services, including to connect to Meta Products, and the performance of their connection and networks and users’ experience with them."
	},
	{
		"lineId": "L2536",
		"text": "*   In our interest to provide accurate and reliable reporting to our businesses, advertisers, and other partners, to ensure accurate pricing and statistics on performance and to demonstrate the value that our partners realize using Meta Company Products, and to provide suitable payment and billing options to our advertisers and other partners; and"
	},
	{
		"lineId": "L2537",
		"text": "*   In the interests of advertisers, developers and other partners to help them understand their customers and improve their businesses, validate our pricing models and evaluate the effectiveness of their products, services, online content and advertising on and off the Meta Company Products."
	},
	{
		"lineId": "L2539",
		"text": "**Information categories we use (see '[What Information do we collect?](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely#1-WhatInformationDoWe)' for more detail on each information category). The actual information we use depends on your factual circumstances, but could include any of the following:**"
	},
	{
		"lineId": "L2543",
		"text": "*   Content you create, like posts, comments or audio"
	},
	{
		"lineId": "L2544",
		"text": "*   Content you provide through our camera feature or your camera roll settings, or through our voice-enabled features"
	},
	{
		"lineId": "L2545",
		"text": "*   Types of content you view or interact with, and how you interact with it"
	},
	{
		"lineId": "L2546",
		"text": "*   Apps and features you use, and what actions you take in them"
	},
	{
		"lineId": "L2547",
		"text": "*   Purchases or other transactions you make"
	},
	{
		"lineId": "L2548",
		"text": "*   Hashtags you use"
	},
	{
		"lineId": "L2549",
		"text": "*   The time, frequency and duration of your activities on our Products"
	},
	{
		"lineId": "L2555",
		"text": "*   Device characteristics and device software"
	},
	{
		"lineId": "L2556",
		"text": "*   What you’re doing on your device, like whether our app is in the foreground or if your mouse is moving (which can help tell humans from bots)"
	},
	{
		"lineId": "L2557",
		"text": "*   Identifiers that tell your device apart from other users"
	},
	{
		"lineId": "L2558",
		"text": "*   Device signals"
	},
	{
		"lineId": "L2559",
		"text": "*   Information you’ve shared through your device settings"
	},
	{
		"lineId": "L2560",
		"text": "*   Location-related information"
	},
	{
		"lineId": "L2561",
		"text": "*   Information about the network you connect your device to and your connection, including your IP address"
	},
	{
		"lineId": "L2562",
		"text": "*   Reports about our Products' performance on your device"
	},
	{
		"lineId": "L2563",
		"text": "*   Information from cookies and similar technologies"
	},
	{
		"lineId": "L2571",
		"text": "ⓘ For all registered users of the Meta Products, including those under the age of majority"
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
		"lineId": "L2580",
		"text": "*   In our interest, and in the interests of third parties and the public at large to offer artificial intelligence technology to third parties, including developers and researchers."
	},
	{
		"lineId": "L2581",
		"text": "*   In our interest, and in the interests of users and third parties to develop and improve artificial intelligence technology while ensuring appropriate safeguards, such as improving model responses for safety and accuracy."
	},
	{
		"lineId": "L2583",
		"text": "**Information categories we use (see '[What Information do we collect?](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely#1-WhatInformationDoWe)' for more detail on each information category). The actual information we use depends on your factual circumstances, but could include any of the following:**"
	},
	{
		"lineId": "L2587",
		"text": "*   Interactions with our features that are part of AI at Meta and related metadata. For example, information like content and messages you or others exchange with these features"
	},
	{
		"lineId": "L2593",
		"text": "ⓘ For all registered users of the Meta Products, including those under the age of majority"
	},
	{
		"lineId": "L2597",
		"text": "Improve Meta Products by developing new features or updating existing features. We use information we collect to:"
	},
	{
		"lineId": "L2599",
		"text": "*   Conduct research and analytics to evaluate the impact of new products and features,"
	},
	{
		"lineId": "L2600",
		"text": "*   Get feedback on our ideas for products or features, and"
	},
	{
		"lineId": "L2601",
		"text": "*   Conduct surveys and other research on what we can do better for Meta Products and brands."
	},
	{
		"lineId": "L2605",
		"text": "*   In our interest to create, provide, support, improve and maintain Meta Products that enable people, businesses and others to access new and innovative features to express themselves, communicate, and discover and engage with information they’re interested in."
	},
	{
		"lineId": "L2606",
		"text": "*   In our interest to evaluate the use of Meta Products and adoption of new features to inform the development of future features and improve product direction and development."
	},
	{
		"lineId": "L2607",
		"text": "*   In our interest to develop and improve Meta Products while ensuring appropriate safeguards."
	},
	{
		"lineId": "L2608",
		"text": "*   In the interests of users, businesses and other third parties to access and benefit from Meta Products that have new and innovative features."
	},
	{
		"lineId": "L2610",
		"text": "**Information categories we use (see '[What Information do we collect?](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely#1-WhatInformationDoWe)' for more detail on each information category). The actual information we use depends on your factual circumstances, but could include any of the following:**"
	},
	{
		"lineId": "L2614",
		"text": "*   Content you create, like posts, comments or audio"
	},
	{
		"lineId": "L2615",
		"text": "*   Your public information (including your name, username and profile picture)"
	},
	{
		"lineId": "L2616",
		"text": "*   Content you provide through our camera feature or your camera roll settings, or through our voice-enabled features"
	},
	{
		"lineId": "L2617",
		"text": "*   Interactions with our features that are part of [AI at Meta](https://www.facebook.com/privacy/genai?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely) and related metadata. For example, information like content and messages you or others exchange with these features"
	},
	{
		"lineId": "L2618",
		"text": "*   Messages you send and receive, including their content, subject to [applicable law](https://mbasic.facebook.com/privacy/policy/printable/https%3A%2F%2Flm.facebook.com%2Fl.php%3Fu=https%3A%2F%2Fabout.fb.com%2Fnews%2F2020%2F12%2Fchanges-to-facebook-messaging-services-in-europe%2F%3Fentry_point%3DPOLICY_SUBSECTION%253A18.4-LegitimateInterestsWeRely)"
	},
	{
		"lineId": "L2619",
		"text": "*   Metadata about content and messages, subject to [applicable law](https://www.facebook.com/help/499392929200216?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely)"
	},
	{
		"lineId": "L2620",
		"text": "*   Types of content you view or interact with, and how you interact with it"
	},
	{
		"lineId": "L2621",
		"text": "*   Apps and features you use, and what actions you take in them"
	},
	{
		"lineId": "L2622",
		"text": "*   Purchases or other transactions you make, including truncated credit card information"
	},
	{
		"lineId": "L2623",
		"text": "*   Hashtags you use"
	},
	{
		"lineId": "L2624",
		"text": "*   The time, frequency and duration of your activities on our Products"
	},
	{
		"lineId": "L2625",
		"text": "*   Your photo or video selfie if you provide it when you contact us for account support"
	},
	{
		"lineId": "L2631",
		"text": "*   Device characteristics and device software"
	},
	{
		"lineId": "L2632",
		"text": "*   What you’re doing on your device, like whether our app is in the foreground or if your mouse is moving (which can help tell humans from bots)"
	},
	{
		"lineId": "L2633",
		"text": "*   Identifiers that tell your device apart from other users’"
	},
	{
		"lineId": "L2634",
		"text": "*   Device signals"
	},
	{
		"lineId": "L2635",
		"text": "*   Information you’ve shared through your device settings"
	},
	{
		"lineId": "L2636",
		"text": "*   Location-related information"
	},
	{
		"lineId": "L2637",
		"text": "*   Information about the network you connect your device to, including your IP address"
	},
	{
		"lineId": "L2638",
		"text": "*   Information from cookies and similar technologies"
	}
]
```

### 11. Facebook, core L2640-L2949

Starting heading: Legal basis information. Context before: 2637-2639; context after: 2950-2952. Source: [pinned Facebook policy](https://github.com/OpenTermsArchive/pga-versions/blob/53fdfebe3c470bb1433e830394e86fd699f485e7/Facebook/Privacy%20Policy.md).

Status: completed; 7 findings; 6874 input and 3738 output tokens; $0.00273 estimated token cost.

Actual parsed Luna output:

```json
{
	"summary": "The excerpt describes processing for cross-product experiences, analytics, marketing, social-good research, anonymization, legal-request responses, and safety and security. It does not provide the substantive details of the heading on sharing information with third parties at the user’s request.",
	"findings": [
		{
			"practice": "cross_product_experience",
			"dataCategories": [
				"Content and content metadata",
				"AI feature interactions and related metadata",
				"Viewing, feature use, purchases, hashtags, and activity timing",
				"Connections",
				"Device, settings, location, network, performance, and cookie information"
			],
			"purposes": [
				"Enable cross-app interactions, sharing, viewing, and engagement with content",
				"Provide a seamless, consistent, richer, and innovative experience across Meta Company Products"
			],
			"recipients": ["Users interacting across Meta Company Products"],
			"summary": "Meta uses information to support cross-app interactions and sharing, viewing, and engagement with content across its products.",
			"sourceLineIds": [
				"L2650",
				"L2660",
				"L2663",
				"L2664",
				"L2670",
				"L2674",
				"L2679",
				"L2680",
				"L2682"
			],
			"qualifications": [
				{
					"summary": "The listed information categories are examples; the information actually used depends on the user’s circumstances.",
					"sourceLineIds": ["L2656"]
				},
				{
					"summary": "This practice applies to registered users, including users under the age of majority.",
					"sourceLineIds": ["L2644"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "business_analytics_and_reporting",
			"dataCategories": [
				"Content and content metadata",
				"AI feature interactions and related metadata",
				"Viewing, feature use, purchases, hashtags, and activity timing",
				"Connections",
				"Device, settings, location, network, and cookie information"
			],
			"purposes": [
				"Understand product usage in aggregate and count people and businesses",
				"Validate metrics to inform product direction and development",
				"Support accurate and reliable reporting obligations"
			],
			"recipients": ["Meta (for product development and reporting)"],
			"summary": "Meta processes information to understand product usage in aggregate, count people and businesses, validate related metrics, improve product direction and development, and support reporting.",
			"sourceLineIds": [
				"L2694",
				"L2699",
				"L2705",
				"L2707",
				"L2709",
				"L2715",
				"L2719",
				"L2723",
				"L2725",
				"L2726"
			],
			"qualifications": [
				{
					"summary": "The listed information categories are examples, and the information used depends on the user’s circumstances; metadata and messages are subject to applicable law.",
					"sourceLineIds": ["L2701", "L2707"]
				},
				{
					"summary": "This practice applies to registered users, including users under the age of majority.",
					"sourceLineIds": ["L2690"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "direct_marketing",
			"dataCategories": [
				"Information and content provided by the user, including contact information such as email address",
				"Device identifiers"
			],
			"purposes": ["Send direct marketing and promote Meta Company Products"],
			"recipients": ["The user"],
			"summary": "Meta collects and stores user information to send marketing communications, such as email, and may share marketing communications with the user.",
			"sourceLineIds": ["L2736", "L2737", "L2741", "L2747", "L2751"],
			"qualifications": [
				{
					"summary": "Sharing marketing communications with the user depends on the user’s settings.",
					"sourceLineIds": ["L2736"]
				},
				{
					"summary": "The listed information categories are examples; the information used depends on the user’s circumstances.",
					"sourceLineIds": ["L2743"]
				},
				{
					"summary": "This practice applies to registered users, including users under the age of majority.",
					"sourceLineIds": ["L2732"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "social_good_research",
			"dataCategories": [
				"User-created and user-provided content and content metadata",
				"AI feature interactions and related metadata",
				"Viewing, feature use, purchases, hashtags, and activity timing",
				"Connections",
				"Device, settings, location, network, and cookie information"
			],
			"purposes": [
				"Conduct and support research and innovation on social welfare, technology, public interest, health, and well-being",
				"Support research in artificial intelligence and machine learning"
			],
			"recipients": [
				"Collaborating researchers",
				"Other recipients as necessary for the research (not specified)"
			],
			"summary": "Meta conducts and supports social-good research and innovation, using and, when necessary, sharing information for that work.",
			"sourceLineIds": [
				"L2761",
				"L2763",
				"L2764",
				"L2776",
				"L2778",
				"L2780",
				"L2786",
				"L2790",
				"L2795",
				"L2797"
			],
			"qualifications": [
				{
					"summary": "Research may use information from researchers Meta collaborates with, and processing can include collection, storage, combination, analysis, automated techniques such as aggregation, and human review.",
					"sourceLineIds": ["L2761", "L2763"]
				},
				{
					"summary": "The listed information categories are examples; the information used depends on the user’s circumstances, and metadata and messages are subject to applicable law.",
					"sourceLineIds": ["L2772", "L2778"]
				},
				{
					"summary": "This practice applies to registered users, including users under the age of majority.",
					"sourceLineIds": ["L2755"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "anonymization_and_use",
			"dataCategories": [
				"Information Meta has about users, including activity on and off Meta Products",
				"Potential inputs include user content and activity, connections, and device, location, network, and cookie information"
			],
			"purposes": [
				"Provide and improve Meta Products, including ads",
				"Support advertising delivery and relevance"
			],
			"recipients": ["Not specified"],
			"summary": "In some cases, Meta anonymizes information it has about users and uses the resulting information to provide and improve its products, including ads.",
			"sourceLineIds": [
				"L2807",
				"L2811",
				"L2812",
				"L2819",
				"L2823",
				"L2829",
				"L2833",
				"L2838",
				"L2839",
				"L2841"
			],
			"qualifications": [
				{
					"summary": "Anonymization occurs only in some cases; the policy gives activity on and off Meta Products as an example of information that may be anonymized.",
					"sourceLineIds": ["L2807"]
				},
				{
					"summary": "The listed information categories are examples, and the information used depends on the user’s circumstances.",
					"sourceLineIds": ["L2815"]
				},
				{
					"summary": "This practice applies to registered users, including users under the age of majority.",
					"sourceLineIds": ["L2803"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "legal_requests_and_protective_disclosures",
			"dataCategories": [
				"User content, content metadata, and product activity",
				"Photo or video selfie provided for account support",
				"Connections",
				"Device, settings, location, network, and cookie information"
			],
			"purposes": [
				"Respond to legal requests and comply with applicable law or legitimate legal purposes",
				"Promote safety, security, and integrity and protect people, property, and Meta Products"
			],
			"recipients": [
				"Third parties, including civil litigants, law enforcement, and government authorities"
			],
			"summary": "Depending on the circumstances and purpose, Meta may access, preserve, use, and share information in response to third-party legal requests, for legal purposes, or to promote safety, security, and integrity.",
			"sourceLineIds": [
				"L2853",
				"L2857",
				"L2858",
				"L2859",
				"L2865",
				"L2871",
				"L2879",
				"L2881",
				"L2885",
				"L2889",
				"L2891"
			],
			"qualifications": [
				{
					"summary": "The categories of information depend on the specific circumstances; responses to legal requests that are not compelled by law typically include limited information, such as contact and login information.",
					"sourceLineIds": ["L2853"]
				},
				{
					"summary": "The listed information categories are examples, and the information used depends on the user’s circumstances.",
					"sourceLineIds": ["L2867"]
				},
				{
					"summary": "This practice applies to registered users, including users under the age of majority.",
					"sourceLineIds": ["L2847"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "safety_integrity_and_security_processing",
			"dataCategories": [
				"User-created and user-provided content and content metadata",
				"AI feature interactions and related metadata",
				"Viewing, feature use, purchases, hashtags, and activity timing",
				"Photo or video selfie provided for account support",
				"Connections",
				"Device, settings, location, network, and cookie information"
			],
			"purposes": [
				"Verify accounts and activity",
				"Combat harmful conduct and detect or prevent spam and other security issues or bad experiences",
				"Investigate suspicious activity or policy breaches",
				"Maintain product integrity and promote safety and security on and off Meta Products"
			],
			"recipients": ["Not specified"],
			"summary": "Meta uses automated processing and human review to verify accounts and activity, address harmful conduct and spam, investigate suspicious activity or policy breaches, and promote safety, integrity, and security.",
			"sourceLineIds": [
				"L2903",
				"L2904",
				"L2905",
				"L2911",
				"L2918",
				"L2921",
				"L2922",
				"L2927",
				"L2929",
				"L2933",
				"L2938",
				"L2939",
				"L2940"
			],
			"qualifications": [
				{
					"summary": "This processing is described as occurring in limited circumstances outside performance of Meta’s contracts with users.",
					"sourceLineIds": ["L2901"]
				},
				{
					"summary": "The listed information categories are examples, and the information used depends on the user’s circumstances.",
					"sourceLineIds": ["L2914"]
				},
				{
					"summary": "This practice applies to registered users, including users under the age of majority.",
					"sourceLineIds": ["L2897"]
				}
			],
			"ambiguous": false,
			"negated": false
		}
	]
}
```

Exact cited source lines copied by code:

```json
[
	{
		"lineId": "L2644",
		"text": "ⓘ For all registered users of the Meta Products, including those under the age of majority"
	},
	{
		"lineId": "L2650",
		"text": "*   To provide a seamless, consistent and richer, innovative, experience across the Meta Company Products and to enable cross app interactions, sharing, viewing and engaging with content, including posts and videos."
	},
	{
		"lineId": "L2656",
		"text": "**Information categories we use (see '[What Information do we collect?](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely#1-WhatInformationDoWe)' for more detail on each information category). The actual information we use depends on your factual circumstances, but could include any of the following:**"
	},
	{
		"lineId": "L2660",
		"text": "*   Content you create, like posts, comments or audio"
	},
	{
		"lineId": "L2663",
		"text": "*   Interactions with our features that are part of [AI at Meta](https://www.facebook.com/privacy/genai?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely) and related metadata. For example, information like content and messages you or others exchange with these features"
	},
	{
		"lineId": "L2664",
		"text": "*   Types of content you view or interact with, and how you interact with it"
	},
	{
		"lineId": "L2670",
		"text": "[Friends, followers and other connections](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely#1.subpage.2-FriendsFollowersAndOther)"
	},
	{
		"lineId": "L2674",
		"text": "*   Device characteristics and device software"
	},
	{
		"lineId": "L2679",
		"text": "*   Location-related information"
	},
	{
		"lineId": "L2680",
		"text": "*   Information about the network you connect your device to and your connection, including your IP address"
	},
	{
		"lineId": "L2682",
		"text": "*   Information from cookies and similar technologies"
	},
	{
		"lineId": "L2690",
		"text": "ⓘ For all registered users of the Meta Products, including those under the age of majority"
	},
	{
		"lineId": "L2694",
		"text": "*   To understand, in aggregate, your usage of and across our Products, to accurately count people and businesses; and"
	},
	{
		"lineId": "L2699",
		"text": "In our interest to measure the use of our Products and count the people who interact with our Products in order to inform and improve product direction and development and to enable provision of accurate and reliable reporting."
	},
	{
		"lineId": "L2701",
		"text": "**Information categories we use (see '[What Information do we collect?](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely#1-WhatInformationDoWe)' for more detail on each information category). The actual information we use depends on your factual circumstances, but could include any of the following:**"
	},
	{
		"lineId": "L2705",
		"text": "*   Content you create, like posts, comments or audio"
	},
	{
		"lineId": "L2707",
		"text": "*   Metadata about content and messages, subject to [applicable law](https://www.facebook.com/help/499392929200216?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely)"
	},
	{
		"lineId": "L2709",
		"text": "*   Types of content you view or interact with, and how you interact with it"
	},
	{
		"lineId": "L2715",
		"text": "[Friends, followers and other connections](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely#1.subpage.2-FriendsFollowersAndOther)"
	},
	{
		"lineId": "L2719",
		"text": "*   Device characteristics and device software"
	},
	{
		"lineId": "L2723",
		"text": "*   Location-related information"
	},
	{
		"lineId": "L2725",
		"text": "*   Information about the network you connect your device to, including your IP address"
	},
	{
		"lineId": "L2726",
		"text": "*   Information from cookies and similar technologies"
	},
	{
		"lineId": "L2732",
		"text": "ⓘ For all registered users of the Meta Products, including those under the age of majority"
	},
	{
		"lineId": "L2736",
		"text": "*   Depending on your settings, we’ll share marketing communications with you."
	},
	{
		"lineId": "L2737",
		"text": "*   We’ll collect and store your information and use it to send marketing communications to you, like an e-mail."
	},
	{
		"lineId": "L2741",
		"text": "In our interest to promote Meta Company Products and send our direct marketing."
	},
	{
		"lineId": "L2743",
		"text": "**Information categories we use (see '[What Information do we collect?](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely#1-WhatInformationDoWe)' for more detail on each information category). The actual information we use depends on your factual circumstances, but could include any of the following:**"
	},
	{
		"lineId": "L2747",
		"text": "*   Information and content you provide, including your contact information like e-mail address"
	},
	{
		"lineId": "L2751",
		"text": "*   Device identifiers"
	},
	{
		"lineId": "L2755",
		"text": "ⓘ For all registered users of the Meta Products, including those under the age of majority"
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
		"lineId": "L2764",
		"text": "*   We support research in areas like artificial intelligence and machine learning."
	},
	{
		"lineId": "L2772",
		"text": "**Information categories we use (see '[What Information do we collect?](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely#1-WhatInformationDoWe)' for more detail on each information category). The actual information we use depends on your factual circumstances, but could include any of the following:**"
	},
	{
		"lineId": "L2776",
		"text": "*   Content you create, like posts, comments or audio"
	},
	{
		"lineId": "L2778",
		"text": "*   Metadata about content and messages, subject to [applicable law](https://www.facebook.com/help/499392929200216?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely)"
	},
	{
		"lineId": "L2780",
		"text": "*   Types of content you view or interact with, and how you interact with it"
	},
	{
		"lineId": "L2786",
		"text": "[Friends, followers and other connections](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely#1.subpage.2-FriendsFollowersAndOther)"
	},
	{
		"lineId": "L2790",
		"text": "*   Device characteristics and device software"
	},
	{
		"lineId": "L2795",
		"text": "*   Information about the network you connect your device to, including your IP address"
	},
	{
		"lineId": "L2797",
		"text": "*   Information from cookies and similar technologies"
	},
	{
		"lineId": "L2803",
		"text": "ⓘ For all registered users of the Meta Products, including those under the age of majority"
	},
	{
		"lineId": "L2807",
		"text": "In some cases, we anonymise information we have about you, such as your activity on and off our Products, and use the resulting information, for example, to provide and improve our Meta Products, including ads."
	},
	{
		"lineId": "L2811",
		"text": "*   In our interest to fund our provision of the Meta Products, provide relevant advertising to users, and improve ads delivery and Meta Products;"
	},
	{
		"lineId": "L2812",
		"text": "*   In the interests of advertisers to help them to reach relevant audiences who may be interested in their information, products or services;"
	},
	{
		"lineId": "L2815",
		"text": "**Information categories we use (see '[What Information do we collect?](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely#1-WhatInformationDoWe)' for more detail on each information category). The actual information we use depends on your factual circumstances, but could include any of the following:**"
	},
	{
		"lineId": "L2819",
		"text": "*   Content you create, like posts, comments or audio"
	},
	{
		"lineId": "L2823",
		"text": "*   Types of content you view or interact with, and how you interact with it"
	},
	{
		"lineId": "L2829",
		"text": "[Friends, followers and other connections](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely#1.subpage.2-FriendsFollowersAndOther)"
	},
	{
		"lineId": "L2833",
		"text": "*   Device characteristics and device software"
	},
	{
		"lineId": "L2838",
		"text": "*   Location-related information"
	},
	{
		"lineId": "L2839",
		"text": "*   Information about the network you connect your device to and your connection, including your IP address"
	},
	{
		"lineId": "L2841",
		"text": "*   Information from cookies and similar technologies"
	},
	{
		"lineId": "L2847",
		"text": "ⓘ For all registered users of the Meta Products, including those under the age of majority"
	},
	{
		"lineId": "L2853",
		"text": "The categories of information we access, preserve, use and share depend on the specific circumstances. For example, responses to legal requests where not compelled by law, will typically include limited information (such as contact details and login information)."
	},
	{
		"lineId": "L2857",
		"text": "*   In response to [legal requests\\[85\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely#annotation-85) from third parties such as civil litigants, law enforcement and other government authorities."
	},
	{
		"lineId": "L2858",
		"text": "*   To comply with applicable law or legitimate legal purposes."
	},
	{
		"lineId": "L2859",
		"text": "*   To promote the safety, security and integrity of Meta, Meta Products, Products, users, employees, property and the public."
	},
	{
		"lineId": "L2865",
		"text": "In our interest and the interest of the general public to prevent and address fraud, unauthorised use of the Meta Company Products, violations of our terms or policies, or other harmful or illegal activity; to protect ourselves (including our rights, Meta personnel and property or Meta Products), our users or others, including as part of investigations or regulatory enquiries; or to prevent death or imminent bodily harm."
	},
	{
		"lineId": "L2867",
		"text": "**Information categories we use (see '[What Information do we collect?](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely#1-WhatInformationDoWe)' for more detail on each information category). The actual information we use depends on your factual circumstances, but could include any of the following:**"
	},
	{
		"lineId": "L2871",
		"text": "*   Content you create, like posts, comments or audio"
	},
	{
		"lineId": "L2879",
		"text": "*   Your photo or video selfie if you provide it when you contact us for account support"
	},
	{
		"lineId": "L2881",
		"text": "[Friends, followers and other connections](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely#1.subpage.2-FriendsFollowersAndOther)"
	},
	{
		"lineId": "L2885",
		"text": "*   Device characteristics and device software"
	},
	{
		"lineId": "L2889",
		"text": "*   Information about the network you connect your device to, including your IP address"
	},
	{
		"lineId": "L2891",
		"text": "*   Information from cookies and similar technologies"
	},
	{
		"lineId": "L2897",
		"text": "ⓘ For all registered users of the Meta Products, including those under the age of majority"
	},
	{
		"lineId": "L2901",
		"text": "Promote safety, integrity and security in limited circumstances outside of the performance of our contracts with you:"
	},
	{
		"lineId": "L2903",
		"text": "*   Our Meta Products are delivered to ensure the safety, integrity and security of those services and those people who enjoy them."
	},
	{
		"lineId": "L2904",
		"text": "*   We apply automated processing, as well as manual (human) review to verify accounts and activity, combat harmful conduct, detect and prevent spam and other security matters as well as bad experiences of other types, maintain the integrity of our Products, and promote safety, integrity and security on and off Meta Products."
	},
	{
		"lineId": "L2905",
		"text": "*   For example, we use information that we have to investigate suspicious activity or breaches of our terms or policies, or to detect when someone needs help."
	},
	{
		"lineId": "L2911",
		"text": "*   In our interest to secure our platform and network, to verify accounts and activity, to combat harmful conduct, to detect, prevent, and address spam and other bad experiences, to keep the Meta Company Products free of harmful or inappropriate content, and to investigate and take action in respect of suspicious activity or breaches of our terms or policies; and"
	},
	{
		"lineId": "L2914",
		"text": "**Information categories we use (see '[What Information do we collect?](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely#1-WhatInformationDoWe)' for more detail on each information category). The actual information we use depends on your factual circumstances, but could include any of the following:**"
	},
	{
		"lineId": "L2918",
		"text": "*   Content you create, like posts, comments or audio"
	},
	{
		"lineId": "L2921",
		"text": "*   Interactions with our features that are part of [AI at Meta](https://www.facebook.com/privacy/genai?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely) and related metadata. For example, information like content and messages you or others exchange with these features"
	},
	{
		"lineId": "L2922",
		"text": "*   Types of content you view or interact with, and how you interact with it"
	},
	{
		"lineId": "L2927",
		"text": "*   Your photo or video selfie if you provide it when you contact us for account support"
	},
	{
		"lineId": "L2929",
		"text": "[Friends, followers and other connections](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely#1.subpage.2-FriendsFollowersAndOther)"
	},
	{
		"lineId": "L2933",
		"text": "*   Device characteristics and device software"
	},
	{
		"lineId": "L2938",
		"text": "*   Location-related information"
	},
	{
		"lineId": "L2939",
		"text": "*   Information about the network you connect your device to, including your IP address"
	},
	{
		"lineId": "L2940",
		"text": "*   Information from cookies and similar technologies"
	}
]
```

### 12. Facebook, core L2950-L3205

Starting heading: Legal basis information. Context before: 2947-2949; context after: 3206-3208. Source: [pinned Facebook policy](https://github.com/OpenTermsArchive/pga-versions/blob/53fdfebe3c470bb1433e830394e86fd699f485e7/Facebook/Privacy%20Policy.md).

Status: completed; 10 findings; 6402 input and 4417 output tokens; $0.00301 estimated token cost.

Actual parsed Luna output:

```json
{
	"summary": "The excerpt describes information sharing with connected apps, several uses of information for AI, safety, marketing, research, legal requests, and product improvement, and a right to object to certain processing.",
	"findings": [
		{
			"practice": "connected_app_sharing",
			"dataCategories": [
				"Contact information",
				"Profile information",
				"Other information the user chooses to share, such as email address, birthday, friends list, or hometown"
			],
			"purposes": [
				"Enable features used by a connected partner app",
				"Facilitate and improve users’ experiences in partner apps"
			],
			"recipients": ["Partners whose apps the user connects to Facebook"],
			"summary": "Users may choose to share information with partners by connecting their Facebook account to a partner app.",
			"sourceLineIds": ["L2950", "L2954", "L2955", "L2959"],
			"qualifications": [
				{
					"summary": "The information shared depends on the service features used and how the user chooses to use them.",
					"sourceLineIds": ["L2950"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "ai_development_registered_adults",
			"dataCategories": [
				"Public content created or shared on Meta Products",
				"Content and messages exchanged with AI features and related metadata",
				"Information from partners, vendors, and third parties"
			],
			"purposes": [
				"Develop and improve AI at Meta for Meta Products and third parties",
				"Create, support, maintain, and improve AI technology, including improving safety and accuracy"
			],
			"recipients": [
				"Third parties, including developers and researchers, may be offered AI technology"
			],
			"summary": "Meta uses information to develop and improve AI at Meta, including AI technology intended for third parties.",
			"sourceLineIds": ["L2967", "L2971", "L2972", "L2973", "L2979", "L2980", "L2982"],
			"qualifications": [
				{
					"summary": "This section applies to registered Meta Products users over the age of majority, which is 18 in most applicable countries.",
					"sourceLineIds": ["L2963"]
				},
				{
					"summary": "The specific information used depends on the circumstances and may include the listed categories.",
					"sourceLineIds": ["L2975", "L2977"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "safety_integrity_and_security",
			"dataCategories": [
				"AI feature interactions and related metadata",
				"Content viewed or interacted with and interaction patterns",
				"Apps, features, and actions taken",
				"Activity timing, frequency, and duration",
				"Device characteristics, software, activity, identifiers, and signals",
				"Device settings information",
				"Location-related information",
				"Network information, including IP address",
				"Cookie and similar-technology information",
				"Information from partners, vendors, and third parties"
			],
			"purposes": [
				"Verify accounts and activity",
				"Combat harmful conduct and spam",
				"Detect and address security problems and bad experiences",
				"Investigate suspicious activity or policy breaches",
				"Maintain product integrity and promote safety, integrity, and security on and off Meta Products"
			],
			"recipients": [],
			"summary": "Meta collects and stores information and uses automated processing and human review to protect its services, investigate suspicious activity, and address harmful conduct and other security concerns.",
			"sourceLineIds": [
				"L2990",
				"L2991",
				"L2992",
				"L3005",
				"L3006",
				"L3007",
				"L3008",
				"L3012",
				"L3013",
				"L3014",
				"L3015",
				"L3016",
				"L3017",
				"L3018",
				"L3019",
				"L3021"
			],
			"qualifications": [
				{
					"summary": "This section applies when Meta cannot associate the person or device with a registered Meta Products user.",
					"sourceLineIds": ["L2986"]
				},
				{
					"summary": "The information used varies with the person’s circumstances; the listed categories are possible examples.",
					"sourceLineIds": ["L3001", "L3003"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "direct_marketing",
			"dataCategories": [
				"Information and content provided by the person, including contact information such as an email address"
			],
			"purposes": ["Send direct marketing communications promoting Meta Company Products"],
			"recipients": [],
			"summary": "Meta collects and stores information, such as an email address, to send marketing communications.",
			"sourceLineIds": ["L3029", "L3033", "L3039"],
			"qualifications": [
				{
					"summary": "This section applies when Meta cannot associate the person or device with a registered Meta Products user.",
					"sourceLineIds": ["L3025"]
				},
				{
					"summary": "The information used depends on the circumstances; the listed information is an example.",
					"sourceLineIds": ["L3035", "L3037"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "social_good_research",
			"dataCategories": [
				"AI feature interactions and related metadata",
				"Content viewed or interacted with and interaction patterns",
				"Apps, features, and actions taken",
				"Activity timing, frequency, and duration",
				"Device characteristics, software, activity, identifiers, and signals",
				"Device settings information",
				"Location-related information",
				"Network information, including IP address",
				"Cookie and similar-technology information",
				"Information from partners, vendors, and third parties"
			],
			"purposes": [
				"Conduct surveys and research on social welfare, technological advancement, public interest, health, and well-being",
				"Support research and innovation, including in artificial intelligence and machine learning"
			],
			"recipients": ["Research partners are a source of information used in this work"],
			"summary": "Meta collects, stores, combines, analyzes, and processes information, including through aggregation and human review, to conduct and support research and innovation for social good.",
			"sourceLineIds": [
				"L3047",
				"L3048",
				"L3049",
				"L3061",
				"L3062",
				"L3063",
				"L3064",
				"L3068",
				"L3069",
				"L3070",
				"L3071",
				"L3072",
				"L3073",
				"L3074",
				"L3075",
				"L3077"
			],
			"qualifications": [
				{
					"summary": "This section applies when Meta cannot associate the person or device with a registered Meta Products user.",
					"sourceLineIds": ["L3043"]
				},
				{
					"summary": "The information used depends on the circumstances; the listed categories are possible examples.",
					"sourceLineIds": ["L3057", "L3059"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "legal_requests_and_harm_prevention",
			"dataCategories": [
				"AI feature interactions and related metadata",
				"Content viewed or interacted with and interaction patterns",
				"Apps, features, and actions taken",
				"Activity timing, frequency, and duration",
				"Device characteristics, software, activity, identifiers, and signals",
				"Device settings information",
				"Location-related information",
				"Network information, including IP address",
				"Cookie and similar-technology information",
				"Information from partners, vendors, and third parties"
			],
			"purposes": [
				"Respond to legal requests",
				"Comply with applicable law or other legitimate legal purposes",
				"Promote safety, security, and integrity and address fraud, unauthorized use, policy violations, or other harmful or illegal activity"
			],
			"recipients": [
				"Civil litigants",
				"Law enforcement",
				"Government authorities",
				"Other parties making legal requests"
			],
			"summary": "Depending on the circumstances, Meta accesses, preserves, uses, and shares information to respond to legal requests, comply with law, and protect people, Meta, and the public.",
			"sourceLineIds": [
				"L3085",
				"L3087",
				"L3091",
				"L3092",
				"L3093",
				"L3099",
				"L3105",
				"L3106",
				"L3107",
				"L3108",
				"L3112",
				"L3113",
				"L3114",
				"L3115",
				"L3116",
				"L3117",
				"L3118",
				"L3119",
				"L3121"
			],
			"qualifications": [
				{
					"summary": "This section applies when Meta cannot associate the person or device with a registered Meta Products user.",
					"sourceLineIds": ["L3081"]
				},
				{
					"summary": "The information processed and shared depends on the specific circumstances. For legal requests not compelled by law, responses typically include limited information, such as contact and login information.",
					"sourceLineIds": ["L3087"]
				},
				{
					"summary": "The information used depends on the circumstances; the listed categories are possible examples.",
					"sourceLineIds": ["L3101", "L3103"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "product_provision_and_improvement",
			"dataCategories": [
				"Content viewed or interacted with and interaction patterns",
				"Apps, features, and actions taken",
				"Activity timing, frequency, and duration",
				"Device characteristics, software, activity, identifiers, and signals",
				"Device settings information",
				"Location-related information",
				"Network information, including IP address",
				"Cookie and similar-technology information",
				"Information from partners, vendors, and third parties"
			],
			"purposes": [
				"Provide products and curate features",
				"Troubleshoot and fix products",
				"Test products and features",
				"Get feedback and conduct research to improve products and brands"
			],
			"recipients": [],
			"summary": "Meta uses information to provide and improve its products, troubleshoot technical issues, test features, and gather feedback.",
			"sourceLineIds": [
				"L3129",
				"L3131",
				"L3132",
				"L3133",
				"L3134",
				"L3135",
				"L3145",
				"L3146",
				"L3147",
				"L3151",
				"L3152",
				"L3153",
				"L3154",
				"L3155",
				"L3156",
				"L3157",
				"L3158",
				"L3160"
			],
			"qualifications": [
				{
					"summary": "This section applies when Meta cannot associate the person or device with a registered Meta Products user.",
					"sourceLineIds": ["L3125"]
				},
				{
					"summary": "The information used depends on the circumstances; the listed categories are possible examples.",
					"sourceLineIds": ["L3141", "L3143"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "ai_development_outside_contract",
			"dataCategories": [
				"Public content created or shared on Meta Products",
				"Content and messages exchanged with AI features and related metadata",
				"Information from partners, vendors, and third parties"
			],
			"purposes": [
				"Provide, develop, and improve AI at Meta for Meta Products and third parties outside performance of the contract with the user",
				"Offer AI technology to third parties, including developers and researchers, and improve safety and accuracy"
			],
			"recipients": [
				"Third parties, including developers and researchers, may be offered AI technology"
			],
			"summary": "Meta processes information to provide, develop, and improve AI at Meta for third parties, separately from processing to perform its contract with the user.",
			"sourceLineIds": ["L3168", "L3172", "L3173", "L3174", "L3180", "L3181", "L3183"],
			"qualifications": [
				{
					"summary": "This section applies when Meta cannot associate the person or device with a registered Meta Products user.",
					"sourceLineIds": ["L3164"]
				},
				{
					"summary": "The information used depends on the circumstances; the listed categories are possible examples.",
					"sourceLineIds": ["L3176", "L3178"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "public_interest_research",
			"dataCategories": [
				"Content created, such as posts, comments, or audio",
				"Content provided through camera features, camera-roll settings, or voice-enabled features",
				"Content metadata"
			],
			"purposes": [
				"Conduct research and other tasks in the public interest",
				"Share relevant research data with international organizations and academics"
			],
			"recipients": ["International organizations", "Academics"],
			"summary": "Meta collects, stores, combines, analyzes, and processes information, including through aggregation and human review, for research and other public-interest tasks, and may share relevant research data with third parties.",
			"sourceLineIds": ["L3200", "L3204", "L3206", "L3207", "L3208"],
			"qualifications": [
				{
					"summary": "The public-interest task must be laid down in applicable law; the policy identifies specified European Union treaty provisions as the basis in this case.",
					"sourceLineIds": ["L3200"]
				},
				{
					"summary": "Research-data sharing may involve recipients both inside and outside the EEA.",
					"sourceLineIds": ["L3200"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "legitimate_interest_objection_right",
			"dataCategories": [
				"Information processed in reliance on Meta’s or a third party’s legitimate interests"
			],
			"purposes": [
				"Allow people to object to and seek restriction of legitimate-interest processing"
			],
			"recipients": [],
			"summary": "A person may object to and seek restriction of processing based on Meta’s or a third party’s legitimate interests. Meta assesses the objection and, if it is upheld, stops the processing.",
			"sourceLineIds": ["L3185", "L3187"],
			"qualifications": [
				{
					"summary": "Meta considers reasonable expectations, benefits and risks, and whether less invasive means are available without disproportionate effort. An objection will be upheld unless compelling legitimate grounds outweigh the person’s interests or fundamental rights and freedoms, or the processing is needed for legal reasons.",
					"sourceLineIds": ["L3187"]
				},
				{
					"summary": "For a person below the age of majority who has no enforceable contract, Meta gives particular consideration to their age in its assessment and says it provides specific protections concerning processing risks, consequences, safeguards, and rights.",
					"sourceLineIds": ["L3189"]
				}
			],
			"ambiguous": false,
			"negated": false
		}
	]
}
```

Exact cited source lines copied by code:

```json
[
	{
		"lineId": "L2950",
		"text": "You may choose to share your contact information, profile information and other data with our partners. The types of partners with whom information is shared depends on the features of our service that you use and the manner in which you choose to use them. For example, you may choose to share your email address, birthday, friends list, hometown or other information with a partner if you choose to connect your Facebook account to their app."
	},
	{
		"lineId": "L2954",
		"text": "*   To deliver quality experiences to users who use our partners’ apps, in our best interest and in the interest of our users."
	},
	{
		"lineId": "L2955",
		"text": "*   To facilitate and improve users' experiences in their apps, in the interests of our partners who want to facilitate and improve consumers' experiences in their apps."
	},
	{
		"lineId": "L2959",
		"text": "[Information you provide (for example, your email address, birthday, friends’ list and hometown)](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely#1.subpage.1-YourActivityAndInformation)"
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
		"lineId": "L2971",
		"text": "*   In our interest, and in the interests of users and third parties to create, provide, support, improve and maintain artificial intelligence technology that enables people, businesses and others to express themselves, communicate, and discover and engage with information they’re interested in."
	},
	{
		"lineId": "L2972",
		"text": "*   In our interest, and in the interests of third parties and the public at large to offer artificial intelligence technology to third parties, including developers and researchers."
	},
	{
		"lineId": "L2973",
		"text": "*   In our interest, and in the interests of users and third parties to develop and improve artificial intelligence technology while ensuring appropriate safeguards, such as improving model responses for safety and accuracy."
	},
	{
		"lineId": "L2975",
		"text": "**Information categories we use (see '[What Information do we collect?](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely#1-WhatInformationDoWe)' for more detail on each information category). The actual information we use depends on your factual circumstances, but could include any of the following:**"
	},
	{
		"lineId": "L2977",
		"text": "[Your activity and information you provide](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely#1.subpage.1-YourActivityAndInformation):"
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
		"lineId": "L2982",
		"text": "[Information from partners, vendors and third parties](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely#1.subpage.4-InformationFromPartnersVendors)"
	},
	{
		"lineId": "L2986",
		"text": "ⓘ If we cannot associate you or your device with a registered user of the Meta Products"
	},
	{
		"lineId": "L2990",
		"text": "*   Our Meta Products are delivered in a manner to ensure the safety, integrity and security of those services and those people who enjoy them."
	},
	{
		"lineId": "L2991",
		"text": "*   We collect and store information we have for this purpose and apply automated processing and manual (i.e. human) review to verify accounts and activity, combat harmful conduct, detect and prevent spam and other security matters as well as bad experiences of other types, maintain the integrity of our Products, and research and promote safety, integrity and security on and off Meta Products."
	},
	{
		"lineId": "L2992",
		"text": "*   For example, we use information that we have to investigate suspicious activity or breaches of our terms or policies, or to detect when someone needs help."
	},
	{
		"lineId": "L3001",
		"text": "**Information categories we use (see '[What Information do we collect?](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely#1-WhatInformationDoWe)' for more detail on each information category). The actual information we use depends on your factual circumstances, but could include any of the following:**"
	},
	{
		"lineId": "L3003",
		"text": "[Your activity and information you provide](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely#1.subpage.1-YourActivityAndInformation):"
	},
	{
		"lineId": "L3005",
		"text": "*   Interactions with our features that are part of [AI at Meta](https://www.facebook.com/privacy/genai?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely) and related metadata. For example, information like content and messages you or others exchange with these features"
	},
	{
		"lineId": "L3006",
		"text": "*   Types of content you view or interact with, and how you interact with it"
	},
	{
		"lineId": "L3007",
		"text": "*   Apps and features you use, and what actions you take in them"
	},
	{
		"lineId": "L3008",
		"text": "*   The time, frequency and duration of your activities on our Products"
	},
	{
		"lineId": "L3012",
		"text": "*   Device characteristics and device software"
	},
	{
		"lineId": "L3013",
		"text": "*   What you’re doing on your device, like whether our app is in the foreground or if your mouse is moving (which can help tell humans from bots)"
	},
	{
		"lineId": "L3014",
		"text": "*   Identifiers that tell your device apart from other users’"
	},
	{
		"lineId": "L3015",
		"text": "*   Device signals"
	},
	{
		"lineId": "L3016",
		"text": "*   Information you’ve shared through your device settings"
	},
	{
		"lineId": "L3017",
		"text": "*   Location-related information"
	},
	{
		"lineId": "L3018",
		"text": "*   Information about the network you connect your device to, including your IP address"
	},
	{
		"lineId": "L3019",
		"text": "*   Information from cookies and similar technologies"
	},
	{
		"lineId": "L3021",
		"text": "[Information from partners, vendors and third parties](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely#1.subpage.4-InformationFromPartnersVendors)"
	},
	{
		"lineId": "L3025",
		"text": "ⓘ If we cannot associate you or your device with a registered user of the Meta Products"
	},
	{
		"lineId": "L3029",
		"text": "We’ll collect and store your information and use it to send marketing communications to you, like an e-mail address."
	},
	{
		"lineId": "L3033",
		"text": "In our interest to promote Meta Company Products and send our direct marketing."
	},
	{
		"lineId": "L3035",
		"text": "**Information categories we use (see '[What Information do we collect?](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely#1-WhatInformationDoWe)' for more detail on each information category). The actual information we use depends on your factual circumstances, but could include any of the following:**"
	},
	{
		"lineId": "L3037",
		"text": "[Your activity and information you provide](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely#1.subpage.1-YourActivityAndInformation):"
	},
	{
		"lineId": "L3039",
		"text": "*   Information and content you provide including your contact information like your e-mail address"
	},
	{
		"lineId": "L3043",
		"text": "ⓘ If we cannot associate you or your device with a registered user of the Meta Products"
	},
	{
		"lineId": "L3047",
		"text": "*   We carry out surveys and use information (including from research partners we collaborate with) to conduct and support research and innovation on topics of general social welfare, technological advancement, public interest, health and well-being."
	},
	{
		"lineId": "L3048",
		"text": "*   We collect, store, combine, analyse and apply automatic processing techniques like aggregation to information as well as manual (human) review as necessary to research and innovate for social good in this way."
	},
	{
		"lineId": "L3049",
		"text": "*   We support research in areas like artificial intelligence and machine learning."
	},
	{
		"lineId": "L3057",
		"text": "**Information categories we use (see '[What Information do we collect?](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely#1-WhatInformationDoWe)' for more detail on each information category). The actual information we use depends on your factual circumstances, but could include any of the following:**"
	},
	{
		"lineId": "L3059",
		"text": "[Your activity and information you provide](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely#1.subpage.1-YourActivityAndInformation):"
	},
	{
		"lineId": "L3061",
		"text": "*   Interactions with our features that are part of [AI at Meta](https://www.facebook.com/privacy/genai?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely) and related metadata. For example, information like content and messages you or others exchange with these features"
	},
	{
		"lineId": "L3062",
		"text": "*   Types of content you view or interact with, and how you interact with it"
	},
	{
		"lineId": "L3063",
		"text": "*   Apps and features you use, and what actions you take in them"
	},
	{
		"lineId": "L3064",
		"text": "*   The time, frequency and duration of your activities on our Products"
	},
	{
		"lineId": "L3068",
		"text": "*   Device characteristics and device software"
	},
	{
		"lineId": "L3069",
		"text": "*   What you’re doing on your device, like whether our app is in the foreground or if your mouse is moving (which can help tell humans from bots)"
	},
	{
		"lineId": "L3070",
		"text": "*   Identifiers that tell your device apart from other users’"
	},
	{
		"lineId": "L3071",
		"text": "*   Device signals"
	},
	{
		"lineId": "L3072",
		"text": "*   Information you’ve shared through your device settings"
	},
	{
		"lineId": "L3073",
		"text": "*   Location-related information"
	},
	{
		"lineId": "L3074",
		"text": "*   Information about the network you connect your device to, including your IP address"
	},
	{
		"lineId": "L3075",
		"text": "*   Information from cookies and similar technologies"
	},
	{
		"lineId": "L3077",
		"text": "[Information from partners, vendors and third parties](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely#1.subpage.4-InformationFromPartnersVendors)"
	},
	{
		"lineId": "L3081",
		"text": "ⓘ If we cannot associate you or your device with a registered user of the Meta Products"
	},
	{
		"lineId": "L3085",
		"text": "See '[How do we respond to legal requests, prevent harm and promote safety and security?](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely#10-HowDoWeRespond)' for information on when we share information with law enforcement and others."
	},
	{
		"lineId": "L3087",
		"text": "The categories of information we access, preserve, use and share depend on the specific circumstances. For example, responses to legal requests where not compelled by law, will typically include limited information (such as contact details and login information)."
	},
	{
		"lineId": "L3091",
		"text": "*   In response to [legal requests\\[85\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely#annotation-85) from third parties such as civil litigants, law enforcement and other government authorities."
	},
	{
		"lineId": "L3092",
		"text": "*   To comply with applicable law or legitimate legal purposes."
	},
	{
		"lineId": "L3093",
		"text": "*   To promote the safety, security and integrity of Meta, Meta Products, Products, users, employees, property and the public."
	},
	{
		"lineId": "L3099",
		"text": "In our interest and the interest of the general public to prevent and address fraud, unauthorised use of the Meta Company Products, violations of our terms or policies, or other harmful or illegal activity; to protect ourselves (including our rights, Meta personnel and property or Meta Products), our users or others, including as part of investigations or regulatory enquiries; or to prevent death or imminent bodily harm."
	},
	{
		"lineId": "L3101",
		"text": "**Information categories we use (see '[What Information do we collect?](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely#1-WhatInformationDoWe)' for more detail on each information category). The actual information we use depends on your factual circumstances, but could include any of the following:**"
	},
	{
		"lineId": "L3103",
		"text": "[Your activity and information you provide](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely#1.subpage.1-YourActivityAndInformation):"
	},
	{
		"lineId": "L3105",
		"text": "*   Interactions with our features that are part of [AI at Meta](https://www.facebook.com/privacy/genai?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely) and related metadata. For example, information like content and messages you or others exchange with these features"
	},
	{
		"lineId": "L3106",
		"text": "*   Types of content you view or interact with, and how you interact with it"
	},
	{
		"lineId": "L3107",
		"text": "*   Apps and features you use, and what actions you take in them"
	},
	{
		"lineId": "L3108",
		"text": "*   The time, frequency and duration of your activities on our Products"
	},
	{
		"lineId": "L3112",
		"text": "*   Device characteristics and device software"
	},
	{
		"lineId": "L3113",
		"text": "*   What you’re doing on your device, like whether our app is in the foreground or if your mouse is moving (which can help tell humans from bots)"
	},
	{
		"lineId": "L3114",
		"text": "*   Identifiers that tell your device apart from other users’"
	},
	{
		"lineId": "L3115",
		"text": "*   Device signals"
	},
	{
		"lineId": "L3116",
		"text": "*   Information you’ve shared through your device settings"
	},
	{
		"lineId": "L3117",
		"text": "*   Location-related information"
	},
	{
		"lineId": "L3118",
		"text": "*   Information about the network you connect your device to, including your IP address"
	},
	{
		"lineId": "L3119",
		"text": "*   Information from cookies and similar technologies"
	},
	{
		"lineId": "L3121",
		"text": "[Information from partners, vendors and third parties](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely#1.subpage.4-InformationFromPartnersVendors)"
	},
	{
		"lineId": "L3125",
		"text": "ⓘ If we cannot associate you or your device with a registered user of the Meta Products"
	},
	{
		"lineId": "L3129",
		"text": "We use information we collect to:"
	},
	{
		"lineId": "L3131",
		"text": "*   Provide products and curate features"
	},
	{
		"lineId": "L3132",
		"text": "*   See if our Products are working correctly, such as troubleshooting, and fixing it when it’s not working"
	},
	{
		"lineId": "L3133",
		"text": "*   Test out new products and features to see if they work"
	},
	{
		"lineId": "L3134",
		"text": "*   Get feedback on our ideas for products or features"
	},
	{
		"lineId": "L3135",
		"text": "*   Conduct surveys and other research on what we can do better for Meta Products and brands"
	},
	{
		"lineId": "L3141",
		"text": "**Information categories we use (see '[What Information do we collect?](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely#1-WhatInformationDoWe)' for more detail on each information category). The actual information we use depends on your factual circumstances, but could include any of the following:**"
	},
	{
		"lineId": "L3143",
		"text": "[Your activity and information you provide](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely#1.subpage.1-YourActivityAndInformation):"
	},
	{
		"lineId": "L3145",
		"text": "*   Types of content you view or interact with, and how you interact with it"
	},
	{
		"lineId": "L3146",
		"text": "*   Apps and features you use, and what actions you take in them"
	},
	{
		"lineId": "L3147",
		"text": "*   The time, frequency and duration of your activities on our Products"
	},
	{
		"lineId": "L3151",
		"text": "*   Device characteristics and device software"
	},
	{
		"lineId": "L3152",
		"text": "*   What you’re doing on your device, like whether our app is in the foreground or if your mouse is moving (which can help tell humans from bots)"
	},
	{
		"lineId": "L3153",
		"text": "*   Identifiers that tell your device apart from other users’"
	},
	{
		"lineId": "L3154",
		"text": "*   Device signals"
	},
	{
		"lineId": "L3155",
		"text": "*   Information you’ve shared through your device settings"
	},
	{
		"lineId": "L3156",
		"text": "*   Location-related information"
	},
	{
		"lineId": "L3157",
		"text": "*   Information about the network you connect your device to, including your IP address"
	},
	{
		"lineId": "L3158",
		"text": "*   Information from cookies and similar technologies"
	},
	{
		"lineId": "L3160",
		"text": "[Information from partners, vendors and third parties](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely#1.subpage.4-InformationFromPartnersVendors)"
	},
	{
		"lineId": "L3164",
		"text": "ⓘ If we cannot associate you or your device with a registered user of the Meta Products"
	},
	{
		"lineId": "L3168",
		"text": "To provide, develop and improve [AI at Meta](https://www.facebook.com/privacy/genai?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely) for Meta Products and for third parties outside of the performance of our contract with you."
	},
	{
		"lineId": "L3172",
		"text": "*   In our interests, and in the interests of users and third parties to create, provide, support, improve and maintain artificial intelligence technology that enables people, businesses and others to express themselves, communicate, and discover and engage with information they’re interested in."
	},
	{
		"lineId": "L3173",
		"text": "*   In our interests, and in the interests of third parties and the public at large to offer artificial intelligence technology to third parties, including developers and researchers."
	},
	{
		"lineId": "L3174",
		"text": "*   In our interests, and in the interests of users and third parties to develop and improve artificial intelligence technology while ensuring appropriate safeguards, such as improving model responses for safety and accuracy."
	},
	{
		"lineId": "L3176",
		"text": "**Information categories we use (see '[What Information do we collect?](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely#1-WhatInformationDoWe)' for more detail on each information category). The actual information we use depends on your factual circumstances, but could include any of the following:**"
	},
	{
		"lineId": "L3178",
		"text": "[Activity and information provided by a registered user](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely#1.subpage.1-YourActivityAndInformation):"
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
		"lineId": "L3183",
		"text": "[Information from partners, vendors and third parties](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely#1.subpage.4-InformationFromPartnersVendors)"
	},
	{
		"lineId": "L3185",
		"text": "When we process your information as necessary to pursue our legitimate interests or those of a third party, you have the right to object to, and seek restriction of, such processing; to exercise your right, visit the [Facebook settings](https://www.facebook.com/help/contact/1994830130782319?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely) and the [Help Center](https://www.facebook.com/help/2069235856423257?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely) and [Instagram settings](https://mbasic.facebook.com/privacy/policy/printable/https%3A%2F%2Flm.facebook.com%2Fl.php%3Fu=https%3A%2F%2Fhelp.instagram.com%2Fcontact%2F117037592428568%3Fentry_point%3DPOLICY_SUBSECTION%253A18.4-LegitimateInterestsWeRely)."
	},
	{
		"lineId": "L3187",
		"text": "We will consider several factors when assessing an objection, including: our users' reasonable expectations; the benefits and risks to you, us, other users or third parties; and other available means to achieve the same purpose that may be less invasive and do not require disproportionate effort. Unless we find that we have compelling legitimate grounds for this processing which are not outweighed by your interests or fundamental rights and freedoms or the processing is needed for legal reasons, your objection will be upheld, and we will cease processing your information. To learn more about the circumstances in which an objection may be successful, please visit the [Help Center](https://www.facebook.com/help/2069235856423257?entry_point=POLICY_SUBSECTION%3A18.4-LegitimateInterestsWeRely)."
	},
	{
		"lineId": "L3189",
		"text": "If you are under the age of majority in your country and there is no enforceable contract in place, we will take particular account of the fact that you are below the age of majority when conducting our assessment of our legitimate interests and the balancing of your interests and rights. We provide specific protections for people below the age of majority to ensure that they are aware of the risks, consequences, safeguards and rights associated with the processing of their information."
	},
	{
		"lineId": "L3200",
		"text": "We collect, store, combine, analyse and apply automatic processing techniques like aggregation to information as well as manual (human) review as necessary to undertake research and other tasks in the public interest, such as sharing relevant research data with third parties like international organisations and academics both in and outside the EEA. The public interest is required to be laid down in Union law or Member State law or other applicable law to which we are subject. In this case, we rely on Articles 168 and 179 of the Treaty on the Functioning of the European Union."
	},
	{
		"lineId": "L3204",
		"text": "[Your activity and information you provide](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.5-TasksCarriedOutIn#1.subpage.1-YourActivityAndInformation):"
	},
	{
		"lineId": "L3206",
		"text": "*   Content you create, like posts, comments or audio"
	},
	{
		"lineId": "L3207",
		"text": "*   Content you provide through our camera feature or your camera roll settings, or through our voice-enabled features"
	},
	{
		"lineId": "L3208",
		"text": "*   Metadata about content"
	}
]
```

### 13. Facebook, core L3206-L3343

Starting heading: Legal basis information. Context before: 3203-3205; context after: 3344-3343. Source: [pinned Facebook policy](https://github.com/OpenTermsArchive/pga-versions/blob/53fdfebe3c470bb1433e830394e86fd699f485e7/Facebook/Privacy%20Policy.md).

Status: completed; 8 findings; 3757 input and 3094 output tokens; $0.00202 estimated token cost.

Actual parsed Luna output:

```json
{
	"summary": "The excerpt describes information processing for public-interest tasks and vital interests, rights related to public-interest processing, personalized advertising, and safety-related information sharing and account enforcement.",
	"findings": [
		{
			"practice": "public_interest_processing",
			"dataCategories": [
				"Content created or provided, including camera, camera-roll, and voice-feature content",
				"Content metadata",
				"AI-feature interactions and related metadata",
				"Content viewed or interacted with and how",
				"Apps and features used and actions taken",
				"Purchases and transactions, including truncated credit-card information",
				"Hashtags and activity timing, frequency, and duration",
				"Device characteristics, software, activity, identifiers, and signals",
				"Information shared through device settings",
				"Location-related information",
				"Network information, including IP address",
				"Cookie and similar-technology information",
				"Friends, followers, and other connections (details unspecified)",
				"Information from partners, vendors, and third parties (details unspecified)"
			],
			"purposes": [
				"Performing a task in the public interest, including combating unlawful or harmful behaviour where doing so is in the public interest"
			],
			"recipients": ["Regulators", "Law enforcement", "Others"],
			"summary": "In limited, fact-specific circumstances, Facebook says it accesses, preserves, and shares information as necessary to perform a task in the public interest. An example is sharing information to combat unlawful or harmful behaviour where the public interest is established by applicable law.",
			"sourceLineIds": [
				"L3235",
				"L3237",
				"L3241",
				"L3242",
				"L3243",
				"L3244",
				"L3245",
				"L3246",
				"L3247",
				"L3248",
				"L3249",
				"L3251",
				"L3255",
				"L3256",
				"L3257",
				"L3258",
				"L3259",
				"L3260",
				"L3261",
				"L3262",
				"L3264"
			],
			"qualifications": [
				{
					"summary": "The policy describes this as limited and fact-specific, and says the processing must be necessary for a public-interest task; it cites the Data Protection Act 2018 and Regulation (EU) 2021/1232 for the example described.",
					"sourceLineIds": ["L3235"]
				},
				{
					"summary": "The actual information used depends on the facts; the listed information categories are possibilities, not necessarily used in every case.",
					"sourceLineIds": ["L3237"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "right_to_object_public_interest_processing",
			"dataCategories": [
				"Information processed as necessary for a task carried out in the public interest"
			],
			"purposes": ["Exercising a right concerning public-interest processing"],
			"recipients": [],
			"summary": "For processing necessary for a public-interest task, a person has the right to object. Facebook says it assesses objections by considering user expectations, benefits and risks, and less invasive alternatives that do not require disproportionate effort.",
			"sourceLineIds": ["L3266"],
			"qualifications": [
				{
					"summary": "An objection will be upheld and processing will cease unless Facebook finds compelling legitimate grounds that are not outweighed by the person’s interests or fundamental rights and freedoms, or the processing is needed for legal reasons.",
					"sourceLineIds": ["L3268"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "right_to_restrict_public_interest_processing",
			"dataCategories": [
				"Information processed as necessary for a task carried out in the public interest"
			],
			"purposes": ["Exercising a right concerning public-interest processing"],
			"recipients": [],
			"summary": "For processing necessary for a public-interest task, a person has the right to seek restriction of that processing.",
			"sourceLineIds": ["L3266"],
			"qualifications": [
				{
					"summary": "The excerpt directs people to Facebook settings, the Help Center, and Instagram settings to exercise rights; it does not specify when a restriction request will be granted.",
					"sourceLineIds": ["L3266"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "vital_interests_processing_and_sharing",
			"dataCategories": [
				"Content created or provided, including camera, camera-roll, and voice-feature content",
				"Messages sent and received, including content, subject to applicable law",
				"Content and message metadata, subject to applicable law",
				"AI-feature interactions and related metadata",
				"Content viewed or interacted with and how",
				"Apps and features used and actions taken",
				"Purchases and transactions, including truncated credit-card information",
				"Hashtags and activity timing, frequency, and duration",
				"Photo or video selfie provided when contacting account support",
				"Device characteristics, software, activity, identifiers, and signals",
				"Information shared through device settings",
				"Location-related information",
				"Network information, including IP address",
				"Cookie and similar-technology information",
				"Friends, followers, and other connections (details unspecified)",
				"Information from partners, vendors, and third parties (details unspecified)"
			],
			"purposes": [
				"Protecting a person’s or another person’s vital interests, including life, physical or mental health, wellbeing, or integrity",
				"Detecting, removing, and reporting illegal content",
				"Combating harmful conduct and promoting safety, integrity, and security"
			],
			"recipients": ["Law enforcement", "Others", "Relevant authorities"],
			"summary": "When someone’s vital interests require protection, including in emergencies, Facebook says it uses automated processing and human review and may share information. It gives examples including investigating harmful conduct and sharing information with relevant authorities when someone needs help.",
			"sourceLineIds": [
				"L3279",
				"L3281",
				"L3285",
				"L3286",
				"L3287",
				"L3288",
				"L3289",
				"L3290",
				"L3291",
				"L3292",
				"L3293",
				"L3294",
				"L3295",
				"L3297",
				"L3301",
				"L3302",
				"L3303",
				"L3304",
				"L3305",
				"L3306",
				"L3307",
				"L3308",
				"L3310"
			],
			"qualifications": [
				{
					"summary": "The information used depends on the factual circumstances; the listed categories are possibilities. Message content and metadata are subject to applicable law.",
					"sourceLineIds": ["L3281", "L3287", "L3288"]
				},
				{
					"summary": "The processing and sharing are described as occurring in circumstances where someone’s vital interests require protection, such as emergencies.",
					"sourceLineIds": ["L3279"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "personalized_ad_selection",
			"dataCategories": [
				"Information Facebook has about a person",
				"Choices in Ad preferences",
				"Activity on Meta Products",
				"Advertiser-defined audience criteria, which may include age, gender, location, or interests"
			],
			"purposes": [
				"Predicting relevant ad interests",
				"Selecting and ordering potential ads to show relevant ads on Meta Company Products"
			],
			"recipients": [],
			"summary": "Facebook says it uses information it has, including Ad preferences choices, to predict ad interests. Its system automatically reviews potential ads against advertiser-defined audiences and orders ads using algorithms and machine learning, including factors such as ad quality, advertiser goals and budget, and predicted likelihood of response based partly on Meta-product activity.",
			"sourceLineIds": ["L3317", "L3318", "L3319", "L3320"],
			"qualifications": [
				{
					"summary": "The policy describes audience criteria as examples of what advertisers may specify and says ad selection depends on factors including audience fit, advertiser goals, and relevance; it does not say here that a person’s information is disclosed to advertisers.",
					"sourceLineIds": ["L3318", "L3319"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "safety_related_information_sharing",
			"dataCategories": ["Information about a person"],
			"purposes": [
				"Detecting, preventing, and addressing unauthorized product use, policy violations, suspicious activity, abuse, fraud, harmful or illegal activity",
				"Protecting Meta, its rights, property, personnel, and products",
				"Protecting people, including in investigations or regulatory inquiries",
				"Responding to emergencies involving risk of death or imminent bodily harm"
			],
			"recipients": [
				"Law enforcement",
				"Government authorities",
				"Meta Companies",
				"Other third parties, including industry peers"
			],
			"summary": "Facebook says it shares information with the listed recipients when it has a good-faith belief that sharing is necessary to detect, prevent, or address the specified safety, integrity, security, and emergency situations.",
			"sourceLineIds": ["L3325", "L3327", "L3328", "L3329", "L3330", "L3331", "L3332", "L3333"],
			"qualifications": [
				{
					"summary": "The stated trigger is Facebook’s good-faith belief that sharing is necessary; the listed situations are examples of the kinds of matters addressed.",
					"sourceLineIds": ["L3325"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "litigation_defense_sharing",
			"dataCategories": [
				"Information about a person who unlawfully collects and uses Facebook user data"
			],
			"purposes": ["Defending Facebook against claims or in litigation"],
			"recipients": ["Recipients are not specified in this example"],
			"summary": "Facebook may share information to defend itself against claims or in litigation when someone unlawfully collects and uses Facebook user data.",
			"sourceLineIds": ["L3338"],
			"qualifications": [
				{
					"summary": "This is presented as an example; the excerpt does not identify the recipient or specify what information is shared.",
					"sourceLineIds": ["L3338"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "harmful_content_sharing_and_enforcement",
			"dataCategories": ["Information about a person who posts threatening or harmful content"],
			"purposes": ["Protecting Meta and others"],
			"recipients": ["Meta Companies"],
			"summary": "Facebook may share information across Meta Companies when a person posts threatening or harmful content, and may block access to certain features or disable the person’s account across Meta Companies.",
			"sourceLineIds": ["L3343"],
			"qualifications": [
				{
					"summary": "This is presented as an example; the excerpt does not specify which information is shared or require that every such post result in sharing or account action.",
					"sourceLineIds": ["L3343"]
				}
			],
			"ambiguous": false,
			"negated": false
		}
	]
}
```

Exact cited source lines copied by code:

```json
[
	{
		"lineId": "L3235",
		"text": "In limited fact specific circumstances, we will access, preserve and share your information with regulators, law enforcement or others where necessary to perform a task in the public interest. For example, we might share information with others for the purposes of combatting unlawful or harmful behaviour where it is in the public interest to do so and where the public interest is laid down in Union law or Member State law or other applicable law to which we are subject. In this case, we rely on Section 53 of the Data Protection Act 2018 and Regulation (EU) 2021/1232."
	},
	{
		"lineId": "L3237",
		"text": "**Information categories we use (see '[What Information do we collect?](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.5-TasksCarriedOutIn#1-WhatInformationDoWe)' for more detail on each information category). The actual information we use depends on your factual circumstances, but could include any of the following:**"
	},
	{
		"lineId": "L3241",
		"text": "*   Content you create, like posts, comments or audio"
	},
	{
		"lineId": "L3242",
		"text": "*   Content you provide through our camera feature or your camera roll settings, or through our voice-enabled features"
	},
	{
		"lineId": "L3243",
		"text": "*   Metadata about content"
	},
	{
		"lineId": "L3244",
		"text": "*   Interactions with our features that are part of [AI at Meta](https://www.facebook.com/privacy/genai?entry_point=POLICY_SUBSECTION%3A18.5-TasksCarriedOutIn) and related metadata. For example, information like content and messages you or others exchange with these features like content and messages"
	},
	{
		"lineId": "L3245",
		"text": "*   Types of content you view or interact with, and how you interact with it"
	},
	{
		"lineId": "L3246",
		"text": "*   Apps and features you use, and what actions you take in them"
	},
	{
		"lineId": "L3247",
		"text": "*   Purchases or other transactions you make, including truncated credit card information"
	},
	{
		"lineId": "L3248",
		"text": "*   Hashtags you use"
	},
	{
		"lineId": "L3249",
		"text": "*   The time, frequency and duration of your activities on our Products"
	},
	{
		"lineId": "L3251",
		"text": "[Friends, followers and other connections](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.5-TasksCarriedOutIn#1.subpage.2-FriendsFollowersAndOther)"
	},
	{
		"lineId": "L3255",
		"text": "*   Device characteristics and device software"
	},
	{
		"lineId": "L3256",
		"text": "*   What you’re doing on your device, like whether our app is in the foreground or if your mouse is moving (which can help tell humans from bots)"
	},
	{
		"lineId": "L3257",
		"text": "*   Identifiers that tell your device apart from other users’"
	},
	{
		"lineId": "L3258",
		"text": "*   Device signals"
	},
	{
		"lineId": "L3259",
		"text": "*   Information you’ve shared through your device settings"
	},
	{
		"lineId": "L3260",
		"text": "*   Location-related information"
	},
	{
		"lineId": "L3261",
		"text": "*   Information about the network you connect your device to, including your IP address"
	},
	{
		"lineId": "L3262",
		"text": "*   Information from cookies and similar technologies"
	},
	{
		"lineId": "L3264",
		"text": "[Information from Partners, vendors and third parties](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.5-TasksCarriedOutIn#1.subpage.4-InformationFromPartnersVendors)"
	},
	{
		"lineId": "L3266",
		"text": "When we process your information as necessary for a task carried out in the public interest, you have the right to object to, and seek restriction of, our processing. To exercise your rights, visit the [Facebook settings](https://www.facebook.com/help/contact/1994830130782319?entry_point=POLICY_SUBSECTION%3A18.5-TasksCarriedOutIn) and the [Help Center](https://www.facebook.com/help/2069235856423257?entry_point=POLICY_SUBSECTION%3A18.5-TasksCarriedOutIn) and Instagram settings. In assessing an objection, we will consider several factors, including: our users' reasonable user expectations; the benefits and risks to you, us, other users or third parties; and other available means to achieve the same purpose that may be less invasive and do not require disproportionate effort."
	},
	{
		"lineId": "L3268",
		"text": "Your objection will be upheld, and we will cease processing your information, unless we find that we have compelling legitimate grounds for this processing which are not outweighed by your interests or fundamental rights and freedoms or the processing is needed for legal reasons. To learn more about the circumstances in which an objection may be successful, please visit the [Help Center](https://www.facebook.com/help/2069235856423257?entry_point=POLICY_SUBSECTION%3A18.5-TasksCarriedOutIn)."
	},
	{
		"lineId": "L3279",
		"text": "Protecting the vital interests of you and/or those of another person: We apply automated processing techniques, conduct manual (human) review and share information, including with law enforcement and others, in circumstances where someone’s vital interests require protection, such as in the case of emergencies. These vital interests include protection of your life, physical or mental health, wellbeing or integrity or that of others, and detecting, removing, and reporting illegal content. In protecting such vital interests we aim to combat harmful conduct and promote safety, integrity and security, including, for example, when we are investigating reports of harmful conduct or taking appropriate action, such as sharing information with relevant authorities, when someone needs help."
	},
	{
		"lineId": "L3281",
		"text": "**Information categories we use (see '[What Information do we collect?](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.6-ProtectionOfYourVital#1-WhatInformationDoWe)' for more detail on each information category). The actual information we use depends on your factual circumstances, but could include any of the following:**"
	},
	{
		"lineId": "L3285",
		"text": "*   Content you create, like posts, comments or audio"
	},
	{
		"lineId": "L3286",
		"text": "*   Content you provide through our camera feature or your camera roll settings, or through our voice-enabled features"
	},
	{
		"lineId": "L3287",
		"text": "*   Messages you send and receive, including their content, subject to applicable law"
	},
	{
		"lineId": "L3288",
		"text": "*   Metadata about content and messages, subject to [applicable law](https://www.facebook.com/help/499392929200216?entry_point=POLICY_SUBSECTION%3A18.6-ProtectionOfYourVital)"
	},
	{
		"lineId": "L3289",
		"text": "*   Interactions with our features that are part of [AI at Meta](https://www.facebook.com/privacy/genai?entry_point=POLICY_SUBSECTION%3A18.6-ProtectionOfYourVital) and related metadata. For example, information like content and messages you or others exchange with these features like content and messages"
	},
	{
		"lineId": "L3290",
		"text": "*   Types of content you view or interact with, and how you interact with it"
	},
	{
		"lineId": "L3291",
		"text": "*   Apps and features you use, and what actions you take in them"
	},
	{
		"lineId": "L3292",
		"text": "*   Purchases or other transactions you make, including truncated credit card information"
	},
	{
		"lineId": "L3293",
		"text": "*   Hashtags you use"
	},
	{
		"lineId": "L3294",
		"text": "*   The time, frequency and duration of your activities on our Products"
	},
	{
		"lineId": "L3295",
		"text": "*   Your photo or video selfie if you provide it when you contact us for account support"
	},
	{
		"lineId": "L3297",
		"text": "[Friends, followers and other connections](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.6-ProtectionOfYourVital#1.subpage.2-FriendsFollowersAndOther)"
	},
	{
		"lineId": "L3301",
		"text": "*   Device characteristics and device software"
	},
	{
		"lineId": "L3302",
		"text": "*   What you’re doing on your device, like whether our app is in the foreground or if your mouse is moving (which can help tell humans from bots)"
	},
	{
		"lineId": "L3303",
		"text": "*   Identifiers that tell your device apart from other users’"
	},
	{
		"lineId": "L3304",
		"text": "*   Device signals"
	},
	{
		"lineId": "L3305",
		"text": "*   Information you’ve shared through your device settings"
	},
	{
		"lineId": "L3306",
		"text": "*   Location-related information"
	},
	{
		"lineId": "L3307",
		"text": "*   Information about the network you connect your device to, including your IP address"
	},
	{
		"lineId": "L3308",
		"text": "*   Information from cookies and similar technologies"
	},
	{
		"lineId": "L3310",
		"text": "[Information from partners, vendors and third parties](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_SUBSECTION%3A18.6-ProtectionOfYourVital#1.subpage.4-InformationFromPartnersVendors)"
	},
	{
		"lineId": "L3317",
		"text": "*   **We use your information to determine the ad interests most relevant to you.** We try to predict your ad interests based on the information we have, including any choices you've made in Ad preferences."
	},
	{
		"lineId": "L3318",
		"text": "*   **Advertisers tell us which audience they want to reach based on who they think will be most interested.** This can include things like age, gender, location where advertisers want to show their ad or interests, such as women, based in Dublin, who like golf."
	},
	{
		"lineId": "L3319",
		"text": "*   **We review the potential ads that we could show you to identify the most relevant ones.** Our ads system automatically reviews all the potential ads where you might fit the audience that advertisers want to reach. For example, you may see potential ads because you match the age range and interest category. We determine which ones to show you based on things like whether it best achieves the advertiser’s goal and is most relevant to you. To do this, we use algorithms and machine learning to order the ads we may show you. We use different factors such as the ad quality, the advertiser's desired audience and budget. We also consider how likely we think it is that you will react to the ad based on things like your activity on Meta Products. [Learn more](https://www.facebook.com/help/447278887528796?entry_point=POLICY_ANNOTATION%3A11.ex.1-HowOurAdsSystemWorks)."
	},
	{
		"lineId": "L3320",
		"text": "*   **All of this information helps us show you the most relevant ads.** When you see ads on Meta Company Products, we use this process to choose the most relevant ad to show you."
	},
	{
		"lineId": "L3325",
		"text": "We share your information with law enforcement, government authorities, Meta Companies and other third parties (including industry peers) when we have a good faith belief it’s necessary to detect, prevent and address a variety of situations, such as:"
	},
	{
		"lineId": "L3327",
		"text": "*   Unauthorized use of our Products. [See an example.\\[86\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_ANNOTATION%3A10.ex.2-HowWePromoteSafety#annotation-86)"
	},
	{
		"lineId": "L3328",
		"text": "*   Violations of our terms and policies. [See an example.\\[87\\]](https://mbasic.facebook.com/privacy/policy/printable/?entry_point=POLICY_ANNOTATION%3A10.ex.2-HowWePromoteSafety#annotation-87)"
	},
	{
		"lineId": "L3329",
		"text": "*   Investigating suspicious activity"
	},
	{
		"lineId": "L3330",
		"text": "*   Protecting ourselves, including our rights, property, personnel or Products"
	},
	{
		"lineId": "L3331",
		"text": "*   Preventing abuse, fraud, or other harmful or illegal activity, on and off our Products"
	},
	{
		"lineId": "L3332",
		"text": "*   Protecting you or others, including as part of investigations or regulatory inquiries"
	},
	{
		"lineId": "L3333",
		"text": "*   Emergency situations, such as risk of death or imminent bodily harm"
	},
	{
		"lineId": "L3338",
		"text": "For example, if you unlawfully collect and use Facebook user data, we may share your information to defend ourselves against claims or in litigation."
	},
	{
		"lineId": "L3343",
		"text": "For example, if you post threatening or harmful content, we may share your information across the Meta Companies to protect ourselves and others. This can include blocking your access to certain features or disabling your account across the Meta Companies."
	}
]
```

### 14. Spotify, core L0001-L0172

Starting heading: **Spotify Privacy Policy**. Context before: 1-0; context after: 173-175. Source: [pinned Spotify policy](https://github.com/OpenTermsArchive/pga-versions/blob/d5c33c897fc01686cf98a24b15c31076f7bd3bf1/Spotify/Privacy%20Policy.md).

Status: completed; 33 findings; 5952 input and 6799 output tokens; $0.00414 estimated token cost.

Actual parsed Luna output:

```json
{
	"summary": "Spotify describes collection of account, usage, optional-feature, purchase, and other personal data; receipt of data from specified third parties; controls and rights for U.S. residents; and limits or conditions on some processing. This excerpt does not specify the purposes of every data category or the details of every practice.",
	"findings": [
		{
			"practice": "account_data_collection",
			"dataCategories": [
				"User Data: display name, email address, password, phone number, date of birth, gender, country, education details, and age information"
			],
			"purposes": ["Create a Spotify account and enable use of the Spotify Service"],
			"recipients": [],
			"summary": "Spotify collects and uses User Data when people sign up or update their accounts.",
			"sourceLineIds": ["L0140"],
			"qualifications": [
				{
					"summary": "The data collected depends on the Service Option, account-creation method, country, and use of third-party sign-in services; some data comes from the user and some from the device.",
					"sourceLineIds": ["L0140"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "street_address_processing",
			"dataCategories": ["Street address"],
			"purposes": [
				"Check Service Option eligibility",
				"Deliver legally required notices and support options",
				"Billing and tax administration",
				"Deliver purchased or requested physical goods or gifts"
			],
			"recipients": ["A third-party application may help verify the address"],
			"summary": "Spotify may ask for and process a street address for the listed eligibility, notice, support, billing, tax, and delivery purposes.",
			"sourceLineIds": ["L0141"],
			"qualifications": [
				{
					"summary": "Use of a third-party application to verify an address is described as something Spotify may do, not as a universal practice.",
					"sourceLineIds": ["L0141"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "service_usage_and_technical_data_collection",
			"dataCategories": [
				"Usage Data, including service activity, searches, listening and browsing history, playlists, library, settings, user interactions, AI feature prompts and transcripts, ad engagement, user-provided content, inferences, online identifiers, device and network data, and connected-device information"
			],
			"purposes": [],
			"recipients": [],
			"summary": "Spotify collects and processes information about use of the Service, user activity and content, inferences, and technical details about devices, networks, and connected services.",
			"sourceLineIds": ["L0146"],
			"qualifications": [
				{
					"summary": "The policy lists examples of collected data; it does not state in this excerpt a purpose for every listed category.",
					"sourceLineIds": ["L0146"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "general_location_processing",
			"dataCategories": ["General, non-precise location, such as country, region, state, or city"],
			"purposes": [
				"Meet geographic requirements in content-owner agreements",
				"Provide relevant content, advertising, and recommendations"
			],
			"recipients": [],
			"summary": "Spotify may determine a user's general location from technical data or payment currency and use it for geographic requirements and relevance of content, advertising, and recommendations.",
			"sourceLineIds": ["L0146"],
			"qualifications": [
				{
					"summary": "The location described is general and non-precise; possible signals include IP address, device language setting, and payment currency.",
					"sourceLineIds": ["L0146"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "device_sensor_data_processing",
			"dataCategories": ["Motion-generated or orientation-generated device sensor data"],
			"purposes": ["Provide Service features that require the data"],
			"recipients": [],
			"summary": "Spotify processes sensor data about how a user moves or holds a device when needed for Service features that require it.",
			"sourceLineIds": ["L0146"],
			"qualifications": [
				{
					"summary": "This processing is limited to cases where a Service feature needs the sensor data.",
					"sourceLineIds": ["L0146"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "voice_data_collection",
			"dataCategories": ["Voice Data: audio recordings of the user's voice"],
			"purposes": [],
			"recipients": [],
			"summary": "Spotify collects and processes voice recordings when a user chooses to use a voice feature.",
			"sourceLineIds": ["L0151"],
			"qualifications": [
				{
					"summary": "This applies only where voice features are available in the user's market and the user chooses to use one.",
					"sourceLineIds": ["L0151"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "message_data_collection",
			"dataCategories": ["Message Data: text or other content sent directly to another user"],
			"purposes": [],
			"recipients": ["The user to whom the message is sent"],
			"summary": "Spotify collects and processes content a user sends directly to another user through messaging.",
			"sourceLineIds": ["L0152"],
			"qualifications": [
				{
					"summary": "This applies only where messaging is available in the user's market and the user chooses to use it.",
					"sourceLineIds": ["L0152"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "age_check_data_processing",
			"dataCategories": [
				"Age Check Data, including identity-document images and, in some cases, face images used for verification or age estimation"
			],
			"purposes": [
				"Verify or estimate age for an age-check feature or parental consent for a Managed Account"
			],
			"recipients": ["Third-party providers powering Age Check methods"],
			"summary": "Spotify uses Age Check Data for age checks, including document verification or facial age estimation, and deletes all Age Check Data immediately after the check.",
			"sourceLineIds": ["L0153"],
			"qualifications": [
				{
					"summary": "The data is provided when a user chooses an age-check feature or a parent or legal guardian provides consent for a Managed Account.",
					"sourceLineIds": ["L0153"]
				},
				{
					"summary": "A face photo may also be used in some identity-document verification cases; facial age estimation uses a face photo.",
					"sourceLineIds": ["L0153"]
				},
				{
					"summary": "The policy states that Age Check Data is deleted immediately after the Age Check.",
					"sourceLineIds": ["L0153"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "payment_and_purchase_data_processing",
			"dataCategories": [
				"Payment and Purchase Data, including name, date of birth, payment method and card details, ZIP or postal code, mobile number, and purchase and payment history"
			],
			"purposes": ["Process purchases, certain Service Options, and trials"],
			"recipients": [],
			"summary": "Spotify processes payment information when a user makes a purchase or signs up for certain Service Options or a trial.",
			"sourceLineIds": ["L0154"],
			"qualifications": [
				{
					"summary": "The precise data collected varies by payment method.",
					"sourceLineIds": ["L0154"]
				},
				{
					"summary": "Spotify says it never stores a user's full card number.",
					"sourceLineIds": ["L0154"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "precise_location_processing",
			"dataCategories": ["Precise location data"],
			"purposes": ["Provide features such as recommendations for nearby concerts and events"],
			"recipients": [],
			"summary": "Spotify uses precise location data to offer location-related features, including nearby concert and event recommendations.",
			"sourceLineIds": ["L0155"],
			"qualifications": [
				{
					"summary": "Spotify says it uses precise location only with the user's permission, which can be granted through an in-app prompt and device settings.",
					"sourceLineIds": ["L0155"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "survey_and_research_data",
			"dataCategories": ["Personal data provided in surveys or user research"],
			"purposes": [],
			"recipients": [],
			"summary": "Spotify collects and uses personal data a user provides in a survey or user research, as described in that survey or research.",
			"sourceLineIds": ["L0156"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "customer_service_data",
			"dataCategories": [
				"Customer Service Data, including chat conversations and email correspondence"
			],
			"purposes": [],
			"recipients": [],
			"summary": "Spotify collects information about a user's contacts with Customer Service, such as chats and email correspondence.",
			"sourceLineIds": ["L0157"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "authentication_partner_data",
			"dataCategories": ["User Data"],
			"purposes": ["Help create a Spotify account"],
			"recipients": ["Spotify receives data from the service used to register or log in"],
			"summary": "When a user registers for or logs in to Spotify using another service, that service sends information to Spotify to help create the account.",
			"sourceLineIds": ["L0164"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "connected_service_data",
			"dataCategories": ["User Data", "Usage Data"],
			"purposes": [
				"Make integration with a connected third-party application, service, or device possible"
			],
			"recipients": [
				"Spotify receives information from connected third-party applications, services, and devices"
			],
			"summary": "Spotify may collect and use information from third-party applications, services, or devices connected to a Spotify account to make the integration possible.",
			"sourceLineIds": ["L0165"],
			"qualifications": [
				{
					"summary": "Spotify says it will ask permission before collecting information from certain third parties; the policy does not say this applies to every source.",
					"sourceLineIds": ["L0165"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "technical_partner_data",
			"dataCategories": ["User Data", "Usage Data", "IP addresses mapped to general location"],
			"purposes": ["Provide the Service, content, and features", "Help protect user accounts"],
			"recipients": ["Spotify receives data from technical service partners"],
			"summary": "Spotify receives data from technical service partners, including general-location data derived by mapping IP addresses, and works with partners that help protect accounts.",
			"sourceLineIds": ["L0166"],
			"qualifications": [
				{
					"summary": "The policy identifies IP-address mapping as one example of partner-provided data.",
					"sourceLineIds": ["L0166"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "payment_partner_and_merchant_data",
			"dataCategories": ["Payment and Purchase Data"],
			"purposes": [
				"Invoice users, process payments, and provide purchases",
				"Calculate commissions, analyze partnership effectiveness, and understand interests"
			],
			"recipients": [
				"Spotify receives data from payment partners, merchants, and third-party platforms"
			],
			"summary": "Spotify may receive payment or purchase data from third-party payment partners, merchants, or platforms, including data related to purchases from merchants it directs users to.",
			"sourceLineIds": ["L0167"],
			"qualifications": [
				{
					"summary": "Payment-partner data may be received when a user chooses to pay through a third party or by invoice.",
					"sourceLineIds": ["L0167"]
				},
				{
					"summary": "Merchant data is described in connection with purchases made after Spotify directs a user to a merchant.",
					"sourceLineIds": ["L0167"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "advertising_partner_data",
			"dataCategories": [
				"Usage Data, including device identifiers such as hashed contact information and partner inferences about interests and preferences"
			],
			"purposes": [
				"Deliver more relevant ads and marketing",
				"Measure ad and marketing performance"
			],
			"recipients": ["Spotify receives data from advertising and marketing partners"],
			"summary": "Spotify receives identifiers and partner-generated inferences about a user's interests and preferences from certain advertising or marketing partners for ad and marketing relevance and performance measurement.",
			"sourceLineIds": ["L0168"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "acquired_company_data",
			"dataCategories": ["User Data", "Usage Data"],
			"purposes": ["Enhance Spotify's services, products, and offerings"],
			"recipients": ["Spotify may receive data from companies it acquires"],
			"summary": "Spotify may receive personal data from companies it acquires to enhance its services, products, and offerings.",
			"sourceLineIds": ["L0169"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "logged_out_app_data",
			"dataCategories": ["Limited Usage Data"],
			"purposes": [
				"Understand how users access and use the Service",
				"Provide an experience suited to the user, such as one based on country or region"
			],
			"recipients": [],
			"summary": "Spotify collects limited Usage Data when someone tries the mobile app while logged out and combines that data with account data if the person later creates an account.",
			"sourceLineIds": ["L0171"],
			"qualifications": [
				{
					"summary": "The described collection applies to a logged-out experience in the Spotify mobile app and is characterized as limited.",
					"sourceLineIds": ["L0171"]
				},
				{
					"summary": "Combination with account data occurs if the user decides to create an account.",
					"sourceLineIds": ["L0171"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "tailored_advertising",
			"dataCategories": [
				"Information about the user used to personalize ads",
				"Registration information",
				"Real-time Spotify usage",
				"Advertising-partner information and inferences about interests"
			],
			"purposes": ["Personalize ads to be more relevant", "Measure ad performance"],
			"recipients": [],
			"summary": "Spotify uses information about users to personalize advertising. A user who opts out still receives advertising, but it is less relevant and may be based on registration information and real-time Spotify usage.",
			"sourceLineIds": ["L0116", "L0117", "L0126", "L0168"],
			"qualifications": [
				{
					"summary": "Users can opt out through the Tailored Ads setting, the website's Your Privacy Choices link when not logged in or without an account, or a recognized preference signal; podcast controls may instead be managed by the hosting provider.",
					"sourceLineIds": ["L0121", "L0122", "L0123", "L0124"]
				},
				{
					"summary": "A preference signal may need to be renewed when using another device or browser or after clearing cookies.",
					"sourceLineIds": ["L0124"]
				},
				{
					"summary": "Opting out does not eliminate ads; less relevant advertising may appear on free or paid options, including podcast ads.",
					"sourceLineIds": ["L0126"]
				},
				{
					"summary": "Younger users may have tailored advertising turned off by default; it starts when they reach the appropriate age, with an in-Service notice and a way to change preferences or opt out.",
					"sourceLineIds": ["L0130"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "social_activity_controls",
			"dataCategories": ["Listening activity", "Recently played artists", "Messages"],
			"purposes": [
				"Allow users to control aspects of social activity and visibility on the Spotify Service"
			],
			"recipients": [
				"Followers or people viewing the user's public profile, depending on the user's settings"
			],
			"summary": "Spotify settings let users choose whether to share listening activity with followers, show recently played artists on a public profile, start a Private session, and turn off messaging where available.",
			"sourceLineIds": ["L0063", "L0064", "L0065", "L0066", "L0067"],
			"qualifications": [
				{
					"summary": "Messaging controls are available only if messaging is available in the user's market.",
					"sourceLineIds": ["L0067"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "marketing_notification_controls",
			"dataCategories": ["Marketing communications"],
			"purposes": ["Let users select which marketing communications they receive from Spotify"],
			"recipients": [],
			"summary": "Spotify provides Notification Settings for users to choose which marketing communications they receive.",
			"sourceLineIds": ["L0062"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "right_to_be_informed",
			"dataCategories": ["Personal data and information about its processing"],
			"purposes": ["Inform users about personal data Spotify processes and how it processes it"],
			"recipients": [],
			"summary": "Spotify provides information about its personal-data processing through this Policy, information shown during use of the Service, and answers to specific questions and requests.",
			"sourceLineIds": ["L0087"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "access_and_data_portability_rights",
			"dataCategories": ["Personal data Spotify processes about the user"],
			"purposes": ["Provide access to personal data and an electronic copy for portability"],
			"recipients": ["Another party's service, at the user's direction"],
			"summary": "Users may request access to their personal data and an electronic copy for transmission to another party's service, using Spotify's download tool or contacting Spotify.",
			"sourceLineIds": ["L0088", "L0092"],
			"qualifications": [
				{
					"summary": "The download provides information Spotify is required to provide under applicable laws; users seeking more detail may contact Spotify.",
					"sourceLineIds": ["L0088"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "correction_right",
			"dataCategories": ["Inaccurate personal data"],
			"purposes": ["Allow users to request correction or updating of inaccurate data"],
			"recipients": [],
			"summary": "Users may request correction of inaccurate personal data by editing User Data in their profile or contacting Spotify.",
			"sourceLineIds": ["L0089"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "deletion_right",
			"dataCategories": ["User Data", "Usage Data", "Other personal data", "Saved audio content"],
			"purposes": [
				"Allow users to remove saved content or request deletion of account or other personal data"
			],
			"recipients": [],
			"summary": "Users may remove saved audio content, request deletion of account data and account closure, or contact Spotify about other deletion requests.",
			"sourceLineIds": ["L0090"],
			"qualifications": [
				{
					"summary": "Spotify may be unable to delete data that remains necessary for the purpose for which it was collected.",
					"sourceLineIds": ["L0090"]
				},
				{
					"summary": "Spotify may retain data when it has an overriding interest in continued processing, such as protecting its services from fraud.",
					"sourceLineIds": ["L0090"]
				},
				{
					"summary": "Spotify may retain data when legally obligated to do so.",
					"sourceLineIds": ["L0090"]
				},
				{
					"summary": "Spotify may retain data needed to establish, exercise, or defend legal claims, including an unresolved account issue.",
					"sourceLineIds": ["L0090"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "automated_decision_making_limitation",
			"dataCategories": ["Personal data used in decisions"],
			"purposes": [],
			"recipients": [],
			"summary": "Spotify states that it does not make decisions in the Spotify Service based solely on automated processing, including profiling, when they would have a legal or similarly significant effect.",
			"sourceLineIds": ["L0093"],
			"qualifications": [
				{
					"summary": "The stated absence concerns decisions made solely by automated means that have a legal or similarly significant effect; the excerpt does not rule out other automated processing.",
					"sourceLineIds": ["L0093"]
				}
			],
			"ambiguous": false,
			"negated": true
		},
		{
			"practice": "consent_withdrawal_right",
			"dataCategories": ["Personal data processed solely on the basis of consent"],
			"purposes": ["Allow users to withdraw consent for collection or use of their personal data"],
			"recipients": [],
			"summary": "Users may withdraw consent by adjusting the relevant Spotify control or contacting Spotify.",
			"sourceLineIds": ["L0094"],
			"qualifications": [
				{
					"summary": "The right applies when Spotify processes the personal data solely on the basis of the user's consent.",
					"sourceLineIds": ["L0094"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "privacy_rights_non_discrimination",
			"dataCategories": ["Personal data"],
			"purposes": ["Protect users from discriminatory treatment for exercising privacy rights"],
			"recipients": [],
			"summary": "Spotify states that users will not receive discriminatory treatment for exercising privacy rights.",
			"sourceLineIds": ["L0083"],
			"qualifications": [],
			"ambiguous": false,
			"negated": true
		},
		{
			"practice": "privacy_request_identity_verification",
			"dataCategories": ["Details related to a Spotify account"],
			"purposes": ["Verify requests to know, delete, or correct personal data"],
			"recipients": [],
			"summary": "Spotify asks for account-related details to verify requests to know, delete, or correct personal data.",
			"sourceLineIds": ["L0098"],
			"qualifications": [
				{
					"summary": "For a person without a Spotify account, Spotify says it lacks sufficient information to verify identity and link the person to a prior visit, and therefore cannot verify and honor the request.",
					"sourceLineIds": ["L0098"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "household_privacy_requests",
			"dataCategories": ["Personal data covered by access, correction, or deletion requests"],
			"purposes": ["Handle household members' privacy requests"],
			"recipients": [],
			"summary": "When all household members make access, correction, or deletion requests, Spotify responds to them as individual requests.",
			"sourceLineIds": ["L0102"],
			"qualifications": [
				{
					"summary": "The stated treatment applies when all members of the household make the request.",
					"sourceLineIds": ["L0102"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "authorized_agent_requests",
			"dataCategories": ["Personal data covered by a user's privacy-rights request"],
			"purposes": ["Allow an authorized agent to make privacy-rights requests on a user's behalf"],
			"recipients": ["Spotify receives requests from an authorized agent"],
			"summary": "A user may designate an authorized agent in writing or through a power of attorney, in accordance with local law, to make privacy-rights requests on the user's behalf.",
			"sourceLineIds": ["L0106"],
			"qualifications": [
				{
					"summary": "Spotify requires proof that the agent is authorized and may require the user to verify their identity directly.",
					"sourceLineIds": ["L0106"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "privacy_request_appeals",
			"dataCategories": ["Personal data covered by a denied privacy request"],
			"purposes": ["Allow users to appeal a denied request"],
			"recipients": [],
			"summary": "A user whose request is denied may have a right to appeal the denial.",
			"sourceLineIds": ["L0110"],
			"qualifications": [
				{
					"summary": "Whether an appeal right is available and how to use it depends on the instructions provided with the denial.",
					"sourceLineIds": ["L0110"]
				}
			],
			"ambiguous": false,
			"negated": false
		}
	]
}
```

Exact cited source lines copied by code:

```json
[
	{
		"lineId": "L0062",
		"text": "*   [Notification Settings](https://www.spotify.com/account/notifications/): Set which marketing communications you get from Spotify."
	},
	{
		"lineId": "L0063",
		"text": "*   Settings (found in the Desktop and Mobile versions of Spotify): Control certain aspects of the Spotify Service such as ‘Social’ or ‘Explicit Content’. On the ‘Social’ setting, you can:"
	},
	{
		"lineId": "L0064",
		"text": "    *   start a Private session"
	},
	{
		"lineId": "L0065",
		"text": "    *   choose whether to share what you listen to on Spotify with your followers"
	},
	{
		"lineId": "L0066",
		"text": "    *   choose whether to show your recently played artists on your public profile"
	},
	{
		"lineId": "L0067",
		"text": "    *   turn off messaging with other users (if messaging is available in your market)"
	},
	{
		"lineId": "L0083",
		"text": "You can also watch our video about [Your Privacy Controls](https://www.spotify.com/us/safetyandprivacy/learn-more-about-privacy). You will not receive discriminatory treatment for exercising any of your privacy rights."
	},
	{
		"lineId": "L0087",
		"text": "| **Be informed** | **Be informed of the personal data we process about you and how we process it.** | We inform you:<br><br>*   through this Policy<br>*   through information provided to you as you use the Spotify Service<br>*   by answering your specific questions and requests when you [contact us](#_l8q1yc21jzme) |"
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
		"lineId": "L0102",
		"text": "If all the members of a household make an access, correction or deletion request, we will respond as if the requests are individual requests."
	},
	{
		"lineId": "L0106",
		"text": "You may designate, in writing or through a power of attorney (in accordance with local law), an authorized agent to make requests on your behalf to exercise your rights. Before accepting such a request, we will require the agent to provide proof you have authorized it to act on your behalf, and we may need you to verify your identity directly with us."
	},
	{
		"lineId": "L0110",
		"text": "If your request is denied you may have the right to appeal the denial in accordance with the instructions provided to you when the denial was made."
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
		"lineId": "L0130",
		"text": "*   Younger users may have tailored advertising turned off by default. When you reach the appropriate age, you will start to receive tailored advertising. When this happens, you will receive a message within the Spotify Service to let you know. This message will contain a link to the [Tailored Ads](https://www.spotify.com/account/privacy/) setting where you can change your preferences or ‘opt-out’ of tailored advertising at any time."
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
	}
]
```

### 15. Spotify, core L0173-L0376

Starting heading: 4\. Our purpose for using your personal data. Context before: 170-172; context after: 377-376. Source: [pinned Spotify policy](https://github.com/OpenTermsArchive/pga-versions/blob/d5c33c897fc01686cf98a24b15c31076f7bd3bf1/Spotify/Privacy%20Policy.md).

Status: completed; 40 findings; 5823 input and 6508 output tokens; $0.00398 estimated token cost.

Actual parsed Luna output:

```json
{
	"summary": "The excerpt describes purposes for using personal data, disclosures to users and other recipients, retention and security practices, international transfers, and specific limits relating to children and age-check data.",
	"findings": [
		{
			"practice": "provide_service",
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
				"Set up and personalize accounts, including content recommendations",
				"Provide the app and optional Spotify features",
				"Enable sharing links to Spotify content",
				"Provide age-appropriate experiences"
			],
			"recipients": ["Spotify"],
			"summary": "Spotify uses these data categories to provide the Spotify Service, including account setup and personalization, app and feature delivery, link sharing, and age-appropriate experiences.",
			"sourceLineIds": ["L0185"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "location_based_recommendations",
			"dataCategories": ["Precise Location Data"],
			"purposes": [
				"Improve personalized recommendations and the Spotify experience",
				"Provide concert and event recommendations or location-specific trends"
			],
			"recipients": [
				"Spotify users close to the location, potentially through content suggestions"
			],
			"summary": "Spotify uses precise location data to improve recommendations and experiences, including location-specific event or trend suggestions; listening insights from a location may also inform similar suggestions to other nearby users.",
			"sourceLineIds": ["L0186"],
			"qualifications": [
				{
					"summary": "This use is described as applying where precise location data is available and the user has explicitly permitted it.",
					"sourceLineIds": ["L0186"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "diagnose_service_issues",
			"dataCategories": [
				"User Data",
				"Usage Data",
				"Voice Data",
				"Message Data",
				"Customer Service Data"
			],
			"purposes": ["Diagnose, troubleshoot, and fix Spotify Service issues"],
			"recipients": ["Spotify"],
			"summary": "Spotify uses the listed data categories to diagnose, troubleshoot, and fix issues with the Service.",
			"sourceLineIds": ["L0187"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "develop_features_and_models",
			"dataCategories": [
				"User Data",
				"Usage Data",
				"Voice Data",
				"Survey and Research Data",
				"Customer Service Data"
			],
			"purposes": [
				"Evaluate and develop features, technologies, and Service improvements",
				"Develop and train algorithmic and machine-learning models",
				"Improve recommendations and assess user reactions to features",
				"Build AI features and enforce Spotify rules and guidelines"
			],
			"recipients": ["Spotify"],
			"summary": "Spotify uses the listed data categories to evaluate and develop Service features and improvements, including training algorithmic and machine-learning models, building AI features, and supporting enforcement of its rules and guidelines.",
			"sourceLineIds": ["L0188"],
			"qualifications": [
				{
					"summary": "The policy says these models help keep the Service safe and enhance users’ experience; examples include recommendation development, feature evaluation, AI features, and enforcement.",
					"sourceLineIds": ["L0188"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "marketing_and_advertising_use",
			"dataCategories": ["User Data", "Usage Data", "Survey and Research Data"],
			"purposes": ["Tailor advertising to interests", "Send email marketing"],
			"recipients": ["Spotify"],
			"summary": "Spotify uses the listed data categories for marketing and advertising, including interest-tailored advertising and email marketing.",
			"sourceLineIds": ["L0189"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "comply_with_legal_obligations",
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
				"Comply with applicable legal obligations, including age assurance where required"
			],
			"recipients": ["Spotify"],
			"summary": "Spotify uses the listed data categories to comply with legal obligations that may arise under applicable local, Swedish, or EU law; an example is using date of birth for age assurance when required.",
			"sourceLineIds": ["L0190"],
			"qualifications": [
				{
					"summary": "Which obligation applies depends on the law of the user’s country or region and laws applicable to Spotify, including Swedish or EU law.",
					"sourceLineIds": ["L0190"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "fulfill_third_party_contracts",
			"dataCategories": ["User Data", "Usage Data", "Voice Data", "Payment and Purchase Data"],
			"purposes": [
				"Fulfill contractual obligations with third parties, including agreements with Spotify rightsholders"
			],
			"recipients": ["Spotify rightsholders"],
			"summary": "Spotify uses the listed data categories to fulfill contractual obligations with third parties; the example given is providing pseudonymized information about users’ listening to a rightsholder under an agreement.",
			"sourceLineIds": ["L0191"],
			"qualifications": [
				{
					"summary": "The rightsholder example uses pseudonymized data, identified by a code rather than a name or other directly identifying information.",
					"sourceLineIds": ["L0191"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "enforce_content_and_terms",
			"dataCategories": [
				"User Data",
				"Usage Data",
				"Voice Data",
				"Message Data",
				"Payment and Purchase Data",
				"Customer Service Data"
			],
			"purposes": [
				"Detect and investigate reports of possible inappropriate content or violations",
				"Take appropriate action under Spotify terms, policies, rules, or guidelines"
			],
			"recipients": ["Spotify"],
			"summary": "Spotify uses the listed data categories to detect and investigate reports of possible inappropriate content or rule violations and to take appropriate action.",
			"sourceLineIds": ["L0192"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "legal_claims",
			"dataCategories": [
				"User Data",
				"Street Address Data",
				"Usage Data",
				"Voice Data",
				"Message Data",
				"Payment and Purchase Data",
				"Survey and Research Data",
				"Customer Service Data"
			],
			"purposes": ["Establish, exercise, or defend legal claims"],
			"recipients": ["Spotify’s lawyers, where needed in a legal case"],
			"summary": "Spotify uses the listed data categories to establish, exercise, or defend legal claims; information may be provided to its lawyers in litigation.",
			"sourceLineIds": ["L0193"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "business_planning",
			"dataCategories": ["User Data", "Usage Data", "Payment and Purchase Data"],
			"purposes": ["Business planning, reporting, and forecasting"],
			"recipients": ["Spotify"],
			"summary": "Spotify uses the listed data categories for business planning, reporting, and forecasting; the example is looking at aggregated signup counts by country to plan product or feature launches.",
			"sourceLineIds": ["L0194"],
			"qualifications": [
				{
					"summary": "The example specifically describes aggregated user data; the policy does not state that all use for this purpose is aggregated.",
					"sourceLineIds": ["L0194"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "process_payments",
			"dataCategories": ["User Data", "Payment and Purchase Data", "Street Address Data"],
			"purposes": ["Process payments and enable Spotify subscription purchases"],
			"recipients": ["Spotify"],
			"summary": "Spotify uses the listed data categories to process payments, including purchases of Spotify subscriptions.",
			"sourceLineIds": ["L0195"],
			"qualifications": [],
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
			"purposes": ["Keep the Service secure", "Detect and prevent fraud"],
			"recipients": ["Spotify"],
			"summary": "Spotify uses the listed data categories to secure the Service and detect and prevent fraud, including analyzing Usage Data for fraudulent use.",
			"sourceLineIds": ["L0196"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "research_and_surveys",
			"dataCategories": ["User Data", "Usage Data", "Voice Data", "Survey and Research Data"],
			"purposes": ["Conduct research and surveys", "Request user feedback"],
			"recipients": ["Spotify"],
			"summary": "Spotify uses the listed data categories to conduct research and surveys, including contacting users for feedback.",
			"sourceLineIds": ["L0197"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "visible_information_to_users",
			"dataCategories": [
				"Profile name",
				"Profile photo, if uploaded",
				"Public playlists and their titles, descriptions, and images",
				"Other content posted on Spotify and its titles, descriptions, and images",
				"Counts of followed and following users"
			],
			"purposes": [
				"Make specified profile and social information available to other Spotify users"
			],
			"recipients": ["Other Spotify users"],
			"summary": "The listed profile, playlist, posted-content, and follower-count information is available to other Spotify users. The visibility of profiles of people followed or following may depend on the user’s settings.",
			"sourceLineIds": ["L0206", "L0208", "L0209", "L0210", "L0211", "L0212"],
			"qualifications": [
				{
					"summary": "A profile photo is included only if the user chooses to upload one.",
					"sourceLineIds": ["L0209"]
				},
				{
					"summary": "The profiles of people a user follows or who follow the user may be visible depending on settings.",
					"sourceLineIds": ["L0212"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "sharing_to_external_services",
			"dataCategories": [
				"Profile",
				"Content posted on Spotify and related details",
				"Playlists and their titles, descriptions, and images"
			],
			"purposes": [
				"Enable sharing on third-party services, such as social media or messaging platforms"
			],
			"recipients": ["Third-party services, including social media and messaging platforms"],
			"summary": "A user or another user can share the listed profile and Spotify content on third-party services; a receiving service may store a copy to support its features.",
			"sourceLineIds": ["L0214", "L0216", "L0217", "L0218", "L0220"],
			"qualifications": [
				{
					"summary": "The policy describes this sharing as something a user or another user can do, rather than an automatic disclosure by Spotify.",
					"sourceLineIds": ["L0214"]
				},
				{
					"summary": "The third-party service may retain a copy for its features.",
					"sourceLineIds": ["L0220"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "connected_apps_and_devices",
			"dataCategories": ["User Data", "Usage Data"],
			"purposes": [
				"Connect a Spotify account to third-party applications, services, or devices",
				"Enable use of Spotify with connected services or devices"
			],
			"recipients": [
				"Third-party applications, services, and devices connected to a Spotify account"
			],
			"summary": "Spotify may disclose User Data and Usage Data to connected third-party applications, services, or devices to enable the connection or use of Spotify with them.",
			"sourceLineIds": ["L0224", "L0226", "L0231"],
			"qualifications": [
				{
					"summary": "Disclosure is tied to the user choosing a relevant Spotify feature or third-party application, service, or device, or otherwise granting permission.",
					"sourceLineIds": ["L0224", "L0226", "L0227"]
				},
				{
					"summary": "Users can see and remove many third-party connections under Apps in their account.",
					"sourceLineIds": ["L0231"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "support_community_disclosure",
			"dataCategories": [
				"User Data",
				"Support Community profile name",
				"Questions or comments posted in the Support Community"
			],
			"purposes": ["Enable use of the Spotify Support Community"],
			"recipients": ["Spotify Support Community users and the public"],
			"summary": "To enable Support Community use, Spotify asks registrants to create a profile name and displays that name, along with questions or comments they post, publicly to anyone using the community.",
			"sourceLineIds": ["L0232"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "social_sharing_with_users",
			"dataCategories": [
				"User Data",
				"Usage Data",
				"Message Data",
				"Recently played artists",
				"Playlists",
				"Listening activity"
			],
			"purposes": [
				"Share Spotify use information with other Spotify users",
				"Enable shared playlists and social recommendations based on listening activity"
			],
			"recipients": ["Other Spotify users, including followers"],
			"summary": "Spotify may disclose the listed data to other users to support social sharing, such as sharing recently played artists or playlists on a profile or creating shared playlists that provide listening-based recommendations.",
			"sourceLineIds": ["L0233"],
			"qualifications": [
				{
					"summary": "Examples of profile sharing are controlled through Social settings, and users can choose whether to share the described information or create or join shared playlists.",
					"sourceLineIds": ["L0233"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "artist_promotional_disclosure",
			"dataCategories": ["User Data"],
			"purposes": [
				"Enable users to receive news or promotional offers from artists, labels, or other partners"
			],
			"recipients": ["Artists", "Record labels", "Other partners"],
			"summary": "Spotify may share User Data with artists, record labels, or other partners so users can receive their news or promotional offers.",
			"sourceLineIds": ["L0234"],
			"qualifications": [
				{
					"summary": "The user may choose to share this data when signing up and can withdraw consent at any time.",
					"sourceLineIds": ["L0224", "L0227", "L0234"]
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
				"Enable service providers to provide services to Spotify, including support, infrastructure, security, marketing assistance, and eligibility verification"
			],
			"recipients": ["Service providers"],
			"summary": "Spotify discloses the listed data categories to service providers so they can provide services to Spotify, including customer support, technical infrastructure, system security, marketing assistance, and eligibility verification.",
			"sourceLineIds": ["L0242"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "payment_partner_disclosure",
			"dataCategories": ["User Data", "Payment and Purchase Data"],
			"purposes": ["Process payments", "Support anti-fraud purposes"],
			"recipients": ["Payment partners"],
			"summary": "Spotify discloses User Data and Payment and Purchase Data to payment partners to process payments and for anti-fraud purposes.",
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
			"summary": "Spotify discloses User Data and Usage Data to advertising partners for relevant advertising on Spotify and online and to measure ad effectiveness.",
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
				"Enable participation in promotions, trials, and bundled offers",
				"Promote Spotify on other online services",
				"Measure promotion effectiveness",
				"Present relevant offers, promotions, or marketing"
			],
			"recipients": [
				"Marketing partners, including marketing or sponsorship partners, advertising-space sellers, and device, app, and mobile partners"
			],
			"summary": "Spotify discloses certain User Data and Usage Data to marketing partners where necessary for promotions, advertising Spotify on other services, and measuring promotion effectiveness. Spotify and partners may use the disclosed data with other data they collect to present offers or marketing considered relevant.",
			"sourceLineIds": ["L0245"],
			"qualifications": [
				{
					"summary": "For users under 18, Spotify does not disclose personal data to marketing partners by default; the policy does not state that this is an absolute prohibition.",
					"sourceLineIds": ["L0245"]
				},
				{
					"summary": "Partners may combine the disclosed data with other data they collect about the user, such as use of their services.",
					"sourceLineIds": ["L0245"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "event_ticketing_disclosure",
			"dataCategories": ["User Data", "Name", "Email", "Other order details"],
			"purposes": ["Verify ticket purchasers for event check-in"],
			"recipients": ["Ticketing agents", "Venue box offices", "Other event partners"],
			"summary": "For events for which Spotify sells tickets, Spotify discloses the purchaser’s name, email, or other order details to event partners so the purchaser can be checked in as a verifiable ticket buyer.",
			"sourceLineIds": ["L0246"],
			"qualifications": [
				{
					"summary": "The disclosure is described for each event for which Spotify sells tickets and goes to partners for the event location.",
					"sourceLineIds": ["L0246"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "podcast_hosting_disclosure",
			"dataCategories": ["Usage Data", "IP address"],
			"purposes": [
				"Host and deliver podcasts when played",
				"Allow streaming of podcasts from other hosting platforms"
			],
			"recipients": ["Podcast hosting platforms, including platforms not owned by Spotify"],
			"summary": "When a user plays a podcast, Spotify discloses certain data, such as the user’s IP address, to the podcast hosting platform so it can deliver the podcast; Spotify also allows streaming podcasts hosted by other platforms.",
			"sourceLineIds": ["L0247"],
			"qualifications": [
				{
					"summary": "The policy directs users to the episode or show description to identify the hosting platform and to that platform’s privacy policy for its use of disclosed data.",
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
			"summary": "Spotify discloses User Data and Usage Data to academic researchers for activities such as statistical analysis and academic study.",
			"sourceLineIds": ["L0248"],
			"qualifications": [
				{
					"summary": "The disclosure is limited to pseudonymized format.",
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
				"Maintain, improve, and provide Spotify and acquired companies’ services",
				"Develop features and measure ad campaigns or listening trends"
			],
			"recipients": ["Other Spotify group companies, including companies Spotify acquires"],
			"summary": "Spotify shares the listed data categories with other group companies for daily operations and to maintain, improve, and provide services, including feature development and measurement of advertising or podcast listening trends.",
			"sourceLineIds": ["L0249"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "business_transaction_transfer",
			"dataCategories": [
				"User Data",
				"Street Address Data",
				"Usage Data",
				"Voice Data",
				"Message Data",
				"Payment and Purchase Data",
				"Survey and Research Data"
			],
			"purposes": ["Transfer personal data as part of a business transaction"],
			"recipients": ["A buyer or possible buyer", "A successor or affiliate"],
			"summary": "Spotify may transfer the listed data categories to a successor or affiliate as part of a transaction involving the sale, or negotiation to sell, any part of its business.",
			"sourceLineIds": ["L0250"],
			"qualifications": [
				{
					"summary": "This disclosure is conditional on Spotify selling or negotiating to sell part of its business.",
					"sourceLineIds": ["L0250"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "disclosure_to_courts_and_authorities",
			"dataCategories": ["Personal data; specific categories depend on the request"],
			"purposes": [
				"Respond to legal obligations or valid legal process",
				"Support criminal investigations, litigation, safety, or prevention of death or imminent bodily harm"
			],
			"recipients": [
				"Courts",
				"Authorities",
				"Parties to litigation",
				"Other authorized third parties"
			],
			"summary": "Spotify may process and share personal data in response to requests from courts, authorities, litigation parties, or other authorized third parties when it believes in good faith that disclosure is necessary for the stated legal or protective purposes.",
			"sourceLineIds": ["L0252", "L0254", "L0255", "L0256", "L0258"],
			"qualifications": [
				{
					"summary": "The policy frames these disclosures as occurring when Spotify believes in good faith they are necessary, including for legal obligations, valid legal process, or specified justifiable interests.",
					"sourceLineIds": ["L0252", "L0254", "L0255", "L0256"]
				},
				{
					"summary": "The categories of personal data involved depend on the specific request.",
					"sourceLineIds": ["L0258"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "general_retention_limit",
			"dataCategories": ["Personal data"],
			"purposes": [
				"Provide the Spotify Service",
				"Maintain Service performance",
				"Make data-driven business decisions",
				"Comply with legal obligations",
				"Resolve disputes"
			],
			"recipients": ["Spotify"],
			"summary": "Spotify says it keeps personal data only as long as necessary to provide the Service and for legitimate and essential business purposes, including performance, business decisions, legal compliance, and dispute resolution.",
			"sourceLineIds": ["L0263", "L0265", "L0266", "L0267", "L0268"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "user_controlled_retention",
			"dataCategories": ["Personal data users can see and update themselves", "Profile picture"],
			"purposes": ["Retain information while the user chooses to keep it"],
			"recipients": ["Spotify"],
			"summary": "For information users can see and update themselves, Spotify keeps it for as long as the user chooses; users may request deletion of certain personal data or delete some data directly in the Service, such as a profile picture.",
			"sourceLineIds": ["L0274", "L0276"],
			"qualifications": [
				{
					"summary": "User-controlled retention is subject to limited purposes described elsewhere in the retention section, and deletion requests are subject to the circumstances in which Spotify can act on them.",
					"sourceLineIds": ["L0274", "L0276"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "time_limited_retention",
			"dataCategories": ["Personal data entered in search queries"],
			"purposes": ["Retain data for a specified period before expiration"],
			"recipients": ["Spotify"],
			"summary": "Some personal data expires after a specified period; the policy gives search-query data as an example that is deleted after 90 days.",
			"sourceLineIds": ["L0280"],
			"qualifications": [
				{
					"summary": "The stated period is subject to other applicable retention rules in the retention section.",
					"sourceLineIds": ["L0280"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "account_lifetime_retention",
			"dataCategories": ["Spotify username", "Profile information", "Streaming history"],
			"purposes": [
				"Maintain account information",
				"Provide retrospective playlists and personalized recommendations"
			],
			"recipients": ["Spotify"],
			"summary": "Spotify keeps some data, including usernames, profile information, and streaming history, until the account is deleted; streaming history supports retrospective playlists and recommendations based on listening habits.",
			"sourceLineIds": ["L0284"],
			"qualifications": [
				{
					"summary": "When the account is deleted, this category of data is deleted or de-identified.",
					"sourceLineIds": ["L0284"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "post_deletion_limited_retention",
			"dataCategories": [
				"Some personal data retained after account deletion",
				"Data removed from the Spotify Service"
			],
			"purposes": [
				"Meet legal or contractual obligations",
				"Comply with retention laws or preservation orders",
				"Support litigation",
				"Protect user safety or guard against harmful platform content"
			],
			"recipients": ["Spotify"],
			"summary": "Spotify may retain some data for an extended period after account deletion for limited purposes, including legal or contractual obligations, investigations, litigation, user safety, or protection against harmful content; it may also retain data removed from the Service for a limited period.",
			"sourceLineIds": ["L0288", "L0290", "L0291"],
			"qualifications": [
				{
					"summary": "Extended post-deletion retention is described as applying only to some data and for limited purposes; the excerpt does not specify a uniform retention period.",
					"sourceLineIds": ["L0288", "L0290", "L0291"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "immediate_age_check_deletion",
			"dataCategories": ["Age Check Data"],
			"purposes": ["Complete an age check"],
			"recipients": ["Spotify"],
			"summary": "Spotify deletes Age Check Data immediately after the age check is complete.",
			"sourceLineIds": ["L0292"],
			"qualifications": [],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "international_data_transfers",
			"dataCategories": ["Personal data"],
			"purposes": ["Carry out activities described in the policy"],
			"recipients": ["Spotify group companies", "Subcontractors", "Partners"],
			"summary": "Spotify transfers personal data internationally with group companies, subcontractors, and partners when carrying out activities described in the policy.",
			"sourceLineIds": ["L0297"],
			"qualifications": [
				{
					"summary": "Spotify says it uses tools to ensure transfers comply with applicable law and adds protections as appropriate, including encryption, pseudonymization, and processes to challenge certain government requests.",
					"sourceLineIds": ["L0299", "L0301", "L0303", "L0304"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "security_safeguards",
			"dataCategories": ["Personal data"],
			"purposes": ["Protect personal data from unauthorized access and unnecessary retention"],
			"recipients": ["Spotify"],
			"summary": "Spotify says it uses appropriate technical and organizational measures and safeguards, including pseudonymization, encryption, and access and retention policies, to protect personal data.",
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
			"practice": "shared_account_access",
			"dataCategories": ["Personal data", "Account controls", "Service information"],
			"purposes": ["Enable use of the Spotify account and Service by people with account access"],
			"recipients": ["Other individuals with access to the user’s Spotify account"],
			"summary": "Anyone with access to a user’s account can access personal data, controls, and Service features available in that account; their use may affect personalized recommendations.",
			"sourceLineIds": ["L0323", "L0325"],
			"qualifications": [
				{
					"summary": "Spotify places responsibility on the user to allow account access only if comfortable sharing personal data; shared-device use is given as an example.",
					"sourceLineIds": ["L0323", "L0325"]
				}
			],
			"ambiguous": false,
			"negated": false
		},
		{
			"practice": "children_under_age_limit",
			"dataCategories": ["Personal data of children under the applicable Age Limit"],
			"purposes": [
				"The policy states that Spotify does not knowingly collect or use this data outside Managed Accounts or Spotify Kids",
				"Take reasonable steps to delete such data if Spotify learns it was collected"
			],
			"recipients": ["Spotify"],
			"summary": "Outside Managed Accounts and Spotify Kids, Spotify says it does not knowingly collect or use personal data from children under the applicable Age Limit. If it learns it has collected such data, it will take reasonable steps to delete it, which may require deleting the child’s account.",
			"sourceLineIds": ["L0330", "L0332", "L0336"],
			"qualifications": [
				{
					"summary": "The policy’s statement excludes Managed Accounts and Spotify Kids, which have separate privacy notices, and the standard Service has a country- or region-specific minimum age.",
					"sourceLineIds": ["L0330", "L0332", "L0336"]
				},
				{
					"summary": "A person above the Age Limit but below the age of majority may use the Service only with parent or legal guardian consent.",
					"sourceLineIds": ["L0334"]
				}
			],
			"ambiguous": false,
			"negated": true
		},
		{
			"practice": "third_party_link_data_collection",
			"dataCategories": ["Data about the user; categories not specified"],
			"purposes": [
				"Third parties may collect or share data through linked websites, plug-ins, or applications"
			],
			"recipients": ["Third-party websites", "Third-party plug-ins", "Third-party applications"],
			"summary": "Clicking links to third-party websites, plug-ins, or applications may allow those third parties to collect or share data about the user; Spotify says it does not control those sites and is not responsible for their privacy practices.",
			"sourceLineIds": ["L0343"],
			"qualifications": [
				{
					"summary": "The policy describes collection or sharing as a possibility arising from clicking a third-party link, and does not specify the data categories or the third party’s purposes.",
					"sourceLineIds": ["L0343"]
				}
			],
			"ambiguous": false,
			"negated": false
		}
	]
}
```

Exact cited source lines copied by code:

```json
[
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
		"lineId": "L0192",
		"text": "| To detect, investigate and take appropriate action on reports of possible inappropriate content or violation of our Terms of Use or other Spotify terms, policies, rules or guidelines. | *   User Data<br>*   Usage Data<br>*   Voice Data<br>*   Message Data<br>*   Payment and Purchase Data<br>*   Customer Service Data |"
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
		"lineId": "L0274",
		"text": "It’s your right to request that we delete certain of your personal data. See the section on ‘[Deletion](#7qeb9d3i9suy)’ in [Section 2 ‘Your personal data rights and controls’](#_f3cluvljekbi) for more information, and the circumstances in which we can act on your request."
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
		"lineId": "L0284",
		"text": "We keep some data until your Spotify account is deleted. Examples of this include your Spotify username and profile information. We also keep streaming history for the life of an account, for example, to provide retrospective playlists that users enjoy and personalized recommendations that take listening habits into account (for example, Your Time Capsule or Your Summer Rewind). When your Spotify account is deleted, this category of data is deleted or de-identified."
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
		"lineId": "L0323",
		"text": "If other individuals have access to your Spotify account, then they can access personal data, controls and the Spotify Service available in your account. For example, someone might use your account on a shared device."
	},
	{
		"lineId": "L0325",
		"text": "It’s your responsibility to only allow this to happen if you’re comfortable sharing your personal data with them. Anyone else’s use of your Spotify account may impact your personalized recommendations."
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
		"lineId": "L0343",
		"text": "The Spotify Service may include links to third-party websites, plug-ins and applications. Clicking on such links may allow third parties to collect or share data about you. Spotify does not control these third-party websites and is not responsible for their privacy practices."
	}
]
```
