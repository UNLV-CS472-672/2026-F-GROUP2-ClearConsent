import { tierOf } from './tiers';
import type { ClassifiedFindings, ScorableFinding } from './types';

// Plain code-unit comparison so the order doesn't depend on the runtime's locale.
export function compareIds(a: string, b: string): number {
	return a < b ? -1 : a > b ? 1 : 0;
}

function hasRealEvidence(finding: ScorableFinding): boolean {
	return finding.evidence.some((item) => /\S/.test(item.excerpt));
}

// Sorts findings by the sect. 3 checks, in order: no real evidence goes to ungrounded, a missing
// effect or ambiguous text goes to needsReview, and everything else is usable with its tier.
// Each list is sorted by finding ID, so the input order never changes the output.
export function classifyFindings(findings: readonly ScorableFinding[]): ClassifiedFindings {
	const sorted = [...findings].sort((a, b) => compareIds(a.id, b.id));
	const result: ClassifiedFindings = { usable: [], needsReview: [], ungrounded: [] };

	for (const finding of sorted) {
		if (!hasRealEvidence(finding)) {
			result.ungrounded.push({ findingId: finding.id });
		} else if (finding.effect !== 'exposes' && finding.effect !== 'protects') {
			result.needsReview.push({ findingId: finding.id, reason: 'missing_effect' });
		} else if (finding.ambiguous === true) {
			result.needsReview.push({ findingId: finding.id, reason: 'ambiguous' });
		} else {
			result.usable.push({
				id: finding.id,
				category: finding.category,
				effect: finding.effect,
				tier: tierOf(finding)
			});
		}
	}

	return result;
}
