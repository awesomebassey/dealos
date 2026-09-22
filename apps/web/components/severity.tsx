export function Severity({ value }: { value: string }) {
  const klass = value === "CRITICAL" || value === "HIGH" ? "danger" : value === "MEDIUM" ? "warn" : "";
  return <span className={`badge ${klass}`}>{value.toLowerCase()}</span>;
}
