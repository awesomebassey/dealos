export function money(minor: string | number | bigint | null | undefined) {
  if (minor == null) return "Not set";
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(Number(minor) / 100);
}
