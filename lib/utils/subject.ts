/**
 * Formats a subject key to a human-readable label.
 * E.g., "physics_chemistry_biology" -> "Physics, chemistry, biology"
 */
export function formatSubjectLabel(key: string): string {
  if (!key) return "";
  return key
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(", ");
}

export function formatSubjectsList(subjects: string[]): string {
  if (!subjects || subjects.length === 0) return "";
  return subjects.map(formatSubjectLabel).join(", ");
}
