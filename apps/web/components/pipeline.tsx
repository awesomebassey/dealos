const stages = [
  ["NDA_PENDING", "NDA"],
  ["DILIGENCE", "Initial diligence"],
  ["LOI", "LOI"],
  ["FULL_DILIGENCE", "Full diligence"],
  ["SPA", "SPA"],
  ["ESCROW", "Escrow"],
  ["ASSET_TRANSFER", "Asset transfer"],
] as const;

export function Pipeline({ stage }: { stage: string }) {
  const current = stages.findIndex(([key]) => key === stage);
  const completed = stage === "COMPLETED" ? stages.length : current;
  return (
    <div className="pipeline">
      {stages.map(([key, label], index) => {
        const state = index < completed ? "done" : index === current ? "current" : "";
        return (
          <div key={key} className={`pipeline-step ${state}`}>
            <div className="pipeline-dot">{index + 1}</div>
            <div className="pipeline-name">{label}</div>
          </div>
        );
      })}
    </div>
  );
}
