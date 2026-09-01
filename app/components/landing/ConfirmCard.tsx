"use client";

// The "file selected, ready to go" confirmation card — extracted from
// UploadPanel's fileSelected state so the sample-scan flow (SampleScanSection)
// can show the exact same confirm step a real upload does, instead of
// recreating a lookalike copy. UploadPanel is still the only place a real
// File ever touches this: it passes the real selectedFile's name/size, while
// the sample flow passes a sample's filename and a formatted fake size —
// this component itself never reads a File object.

import { IconFile } from "./icons";

interface ConfirmCardAction {
  label: string;
  onClick: () => void;
}

interface ConfirmCardProps {
  fileName: string;
  fileSizeLabel: string;
  onContinue: () => void;
  continueLabel?: string;
  secondaryActions?: ConfirmCardAction[];
}

export default function ConfirmCard({ fileName, fileSizeLabel, onContinue, continueLabel = "Continue", secondaryActions }: ConfirmCardProps) {
  const dim = "color-mix(in srgb, var(--color-text) 55%, transparent)";

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 44,
          height: 44,
          border: "1px solid var(--color-accent)",
          background: "color-mix(in srgb, var(--color-accent) 8%, transparent)",
          marginBottom: 16,
        }}
      >
        <IconFile size={20} opacity={0.8} />
      </div>
      <h3
        style={{
          fontSize: 15,
          fontWeight: 600,
          fontFamily: "var(--font-heading)",
          textTransform: "none",
          letterSpacing: 0,
          maxWidth: "100%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          padding: "0 12px",
          margin: 0,
        }}
      >
        {fileName}
      </h3>
      <p style={{ marginTop: 6, fontSize: 13, color: dim, fontFeatureSettings: "'tnum' 1" }}>{fileSizeLabel}</p>

      {secondaryActions && secondaryActions.length > 0 && (
        <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap", justifyContent: "center" }}>
          {secondaryActions.map((action) => (
            <button key={action.label} type="button" className="btn btn-secondary" onClick={action.onClick}>
              {action.label}
            </button>
          ))}
        </div>
      )}
      <button type="button" className="btn btn-primary" style={{ marginTop: 12 }} onClick={onContinue}>
        {continueLabel}
      </button>
    </>
  );
}
