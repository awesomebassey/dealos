export function serialize<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_, current) =>
      typeof current === "bigint" ? current.toString() : current,
    ),
  ) as T;
}
