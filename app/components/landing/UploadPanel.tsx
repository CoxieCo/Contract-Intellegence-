"use client";

// The real, functional upload dropzone — reskinned into the landing page's
// blueprint aesthetic, but otherwise the same idle/fileSelected/analyzing
// flow app/page.tsx has always driven. HeroDemo above it is illustrative
// only; this is what actually takes a PDF and starts an analysis.

import { ChangeEvent, DragEvent, RefObject } from "react";
import { IconFile, IconSpinner, IconUpload } from "./icons";

export type UploadAppState = "idle" | "fileSelected" | "analyzing";

interface UploadPanelProps {
  appState: UploadAppState;
  selectedFile: File | null;
  isDragging: boolean;
  error: string;
  fileInputRef: RefObject<HTMLInputElement | null>;
  uploadSectionRef: RefObject<HTMLDivElement | null>;
  onFileInput: (e: ChangeEvent<HTMLInputElement>) => void;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (e: DragEvent<HTMLDivElement>) => void;
  onRemoveClick: () => void;
  onContinueClick: () => void;
  formatFileSize: (bytes: number) => string;
}

export default function UploadPanel({
  appState,
  selectedFile,
  isDragging,
  error,
  fileInputRef,
  uploadSectionRef,
  onFileInput,
  onDrop,
  onDragOver,
  onDragLeave,
  onRemoveClick,
  onContinueClick,
  formatFileSize,
}: UploadPanelProps) {
  const dim = "color-mix(in srgb, var(--color-text) 55%, transparent)";

  return (
    <section id="upload" data-screen-label="Upload panel" style={{ padding: "24px 0 88px" }}>
      <div ref={uploadSectionRef} style={{ maxWidth: 560, margin: "0 auto", scrollMarginTop: 88 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <span
            style={{
              display: "block",
              fontSize: 13,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontWeight: 600,
              color: "var(--color-accent-700)",
              marginBottom: 8,
            }}
          >
            Try it yourself
          </span>
          <h2 style={{ fontSize: "clamp(24px,3vw,32px)", lineHeight: 1.1, letterSpacing: "0.01em", textTransform: "uppercase" }}>
            Scan a contract
          </h2>
        </div>

        <div className="blueprint" style={{ background: "var(--color-bg)" }}>
          <i className="corner tl" />
          <i className="corner tr" />
          <i className="corner bl" />
          <i className="corner br" />
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            style={{
              display: "flex",
              minHeight: 220,
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "36px 28px",
              textAlign: "center",
              border: isDragging ? "1px dashed var(--color-accent)" : "1px dashed transparent",
              transition: "border-color 200ms cubic-bezier(0.4,0,0.2,1)",
            }}
          >
            <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" onChange={onFileInput} style={{ display: "none" }} />

            {appState === "idle" && (
              <>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 44,
                    height: 44,
                    border: "1px solid var(--color-divider)",
                    marginBottom: 16,
                  }}
                >
                  <IconUpload />
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 600, fontFamily: "var(--font-heading)", textTransform: "none", letterSpacing: 0 }}>
                  Drop a PDF here
                </h3>
                <p style={{ marginTop: 6, maxWidth: 360, fontSize: 14, lineHeight: "21px", color: dim }}>
                  Or select one from your computer. Any contract, any length, up to 15MB.
                </p>
                <button type="button" className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => fileInputRef.current?.click()}>
                  Select PDF
                </button>
              </>
            )}

            {appState === "fileSelected" && selectedFile && (
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
                  }}
                >
                  {selectedFile.name}
                </h3>
                <p style={{ marginTop: 6, fontSize: 13, color: dim, fontFeatureSettings: "'tnum' 1" }}>{formatFileSize(selectedFile.size)}</p>

                <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap", justifyContent: "center" }}>
                  <button type="button" className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
                    Replace PDF
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={onRemoveClick}>
                    Remove
                  </button>
                </div>
                <button type="button" className="btn btn-primary" style={{ marginTop: 12 }} onClick={onContinueClick}>
                  Continue
                </button>
              </>
            )}

            {appState === "analyzing" && (
              <>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 44,
                    height: 44,
                    border: "1px solid var(--color-divider)",
                    marginBottom: 16,
                  }}
                >
                  <IconSpinner />
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 600, fontFamily: "var(--font-heading)", textTransform: "none", letterSpacing: 0 }}>
                  Analyzing your contract…
                </h3>
                <p style={{ marginTop: 6, maxWidth: 360, fontSize: 14, lineHeight: "21px", color: dim }}>
                  Reading through {selectedFile?.name ?? "your document"}. This usually takes a few seconds.
                </p>
              </>
            )}
          </div>

          {error && (
            <p role="alert" style={{ padding: "0 20px 20px", textAlign: "center", fontSize: 13, fontWeight: 600, color: "#a3453f" }}>
              {error}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
