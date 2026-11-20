// The `detail` query value keeps the presentation level across dashboard links. Unknown values
// fall back to balanced.
export function detailLevel(value: string | null) {
	return value === 'quick' || value === 'detailed' ? value : 'balanced';
}
