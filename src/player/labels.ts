/** "Goblin das falésias 2" → "G2"; "Brisa" → "B". */
export const initials = (name: string) => (name.trim()[0] ?? '?').toUpperCase() + (name.match(/(\d+)$/)?.[1] ?? '')
