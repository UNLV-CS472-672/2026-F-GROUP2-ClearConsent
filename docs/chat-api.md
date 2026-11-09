# Chat API

Each saved analysis has one chat for questions about that document (FR-11). The
answers are grounded in the analysis's source text, and every excerpt shown with
an answer is copied from that text by the server, never from the model.

Both endpoints require a signed-in session and only work on the user's own
analyses. Another user's analysis returns 404.

## Messages

`GET` returns messages, and a successful `POST` returns the question and its answer, in this shape:

```ts
type ChatMessage = {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	// null on questions.
	kind: 'answered' | 'not_in_policy' | 'out_of_scope' | 'legal_advice' | null;
	// Always empty on questions.
	excerpts: {
		excerpt: string;
		// UTF-16 offsets into the analysis's source text, start inclusive, end exclusive.
		startOffset: number;
		endOffset: number;
		passageId: string;
		match: 'exact' | 'normalized' | 'ellipsis';
	}[];
	createdAt: string;
};
```

`kind` says how the question was handled:

| Kind            | Meaning                                                           | Excerpts          |
| --------------- | ----------------------------------------------------------------- | ----------------- |
| `answered`      | The policy addresses the question.                                | At least one      |
| `not_in_policy` | The question is about the policy, but the policy does not say.    | Usually none      |
| `out_of_scope`  | The question is not about this document.                          | None              |
| `legal_advice`  | The question asks for legal advice; the answer states that limit. | When it describes |

## `GET /api/chat?analysisId=<uuid>`

Loads the chat without starting anything, so it is safe to poll.

```ts
type ChatState = {
	// Oldest first. Empty before the first question.
	messages: ChatMessage[];
	pending:
		| null
		| { status: 'running'; questionId: string }
		| { status: 'failed'; questionId: string; error: { code: string; message: string } };
};
```

`pending` is the chat's unfinished answer. While it is `running`, show the answer
as loading and poll. When it is `failed`, show its error under the question with
Try again. An answer whose server stopped before finishing is reported as failed
with the code `answer_interrupted` once two minutes pass. A question with no
answer that is not `pending` failed earlier and was followed by a new question.

| Status | Meaning                                          |
| ------ | ------------------------------------------------ |
| 200    | The chat state above.                            |
| 400    | `analysisId` is missing or not a UUID.           |
| 401    | Not signed in.                                   |
| 404    | No such analysis, or it belongs to another user. |
| 500    | The chat could not be read. Not an empty chat.   |

## `POST /api/chat`

Asks a new question:

```json
{ "analysisId": "<uuid>", "question": "Who gets my location?" }
```

Or answers the chat's failed question again, without saving it twice:

```json
{ "analysisId": "<uuid>", "retry": true }
```

On success the response is `200` with both messages, so the page can show them
without reloading:

```ts
type AskResponse = { question: ChatMessage; answer: ChatMessage };
```

Only one answer per chat runs at a time. A second request while one runs, such
as a double click or another tab, gets `409` and makes no provider call:

```json
{ "status": "running" }
```

A retry when no answer failed also gets `409`, with `{ "status": "nothing_to_retry" }`.

Other failures use the same error shape as analysis:

```json
{
	"error": {
		"code": "provider_timeout",
		"message": "The analysis provider timed out.",
		"retryable": true
	}
}
```

| Status  | Code                          | Meaning                                                            |
| ------- | ----------------------------- | ------------------------------------------------------------------ |
| 400     | `input_empty`                 | The question is empty or only whitespace. Nothing was saved.       |
| 400     | `invalid_request`             | `question` is missing or not a string. Nothing was saved.          |
| 413     | `input_too_large`             | The question is over 2,000 characters. Nothing was saved.          |
| 503     | `analysis_disabled`           | Paid calls are off (`ENABLE_PAID_ANALYSIS`). Nothing was saved.    |
| 502     | `reference_validation_failed` | The answer's excerpts were not in the policy, so it was not shown. |
| 4xx/5xx | `provider_*`                  | The AI provider failed, timed out, or refused.                     |

After a failure that happened once the question was saved, the question stays in
the chat and `GET` reports it as `pending` with `status: 'failed'`, so Try again
sends `{ "analysisId": "...", "retry": true }`. Plain `400`, `401`, `404`, and
`500` errors without an `error` object come from request checks or the database.
