export function activeTab<T extends string>(
  searchParams: { [key: string]: string | string[] | undefined } | undefined,
  param: string,
  options: readonly T[],
  fallback: T
): T {
  const raw = searchParams?.[param];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return options.includes(value as T) ? (value as T) : fallback;
}
