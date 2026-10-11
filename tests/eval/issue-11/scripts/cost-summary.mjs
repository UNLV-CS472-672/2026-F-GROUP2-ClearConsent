// Cost includes all billed attempts; incomplete output is not successful analysis.
export function summarizeCosts(records) {
	const calls = records.filter((record) => record.type === 'result');
	return {
		attemptedResponses: calls.length,
		completedResponses: calls.filter((record) => record.responseStatus === 'completed').length,
		unknownCostResponses: calls.filter((record) => !Number.isFinite(record.costUsd)).length,
		costUsd: calls.reduce(
			(sum, record) => sum + (Number.isFinite(record.costUsd) ? record.costUsd : 0),
			0
		)
	};
}
