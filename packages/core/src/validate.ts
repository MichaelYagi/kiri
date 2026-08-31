/**
 * Resolves an optional string-enum option: undefined silently uses the
 * default, a valid value passes through, and an invalid value warns and
 * falls back to the default rather than silently misbehaving (e.g. a
 * typo'd option matching no CSS rule, or an unsupported canvas export type).
 */
export function resolveEnumOption<T extends string>(
  value: T | undefined,
  valid: readonly T[],
  fallback: T,
  optionName: string
): T {
  if (value === undefined) return fallback;
  if ((valid as readonly string[]).includes(value)) return value;
  console.warn(
    `Kiri: invalid ${optionName} "${value}" — defaulting to "${fallback}". ` +
      `Valid values: ${valid.join(", ")}.`
  );
  return fallback;
}
