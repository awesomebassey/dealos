export function Severity({ value }: { value: string }) {
  const level = value.toLowerCase();
  return <span className={`severity ${level}`}>{level}</span>;
}
