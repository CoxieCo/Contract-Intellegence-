"use client";

// A second, self-contained entry point on the landing page: three real
// contracts that have already been run through the extraction pipeline
// (see sampleContracts.ts), offered as a no-upload way to watch the scanner
// work end to end. Deliberately separate from HeroDemo (illustrative only)
// and UploadPanel (the real upload) — this one mounts the real ScanningView
// and ResultsView with genuine pre-generated data.
//
// Drag and drop here is internal-only: the three sample cards are draggable
// and the drop zone accepts them (tracked through a ref carrying the sample
// id, never event.dataTransfer.files), so a file dragged from the desktop
// simply isn't a valid drop and nothing happens.

import { DragEvent, useRef, useState } from "react";
import { SAMPLE_CONTRACTS, type SampleContract } from "./sampleContracts";
import { IconFile, IconUpload } from "./icons";

const dim = "color-mix(in srgb, var(--color-text) 55%, transparent)";
const dim70 = "color-mix(in srgb, var(--color-text) 78%, transparent)";

interface SampleScanSectionProps {
  /** The sample awaiting confirmation, if any — swaps the drop zone for a confirm card. */
  pickedSample: SampleContract | null;
  /** A sample was chosen (drag, "Try it", or the Select-PDF menu). */
  onPick: (sample: SampleContract) => void;
  /** "Scan" pressed on the confirm card — start the scan sequence. */
  onScan: () => void;
  /** "Choose another" pressed on the confirm card — back to the picker. */
  onCancel: () => void;
}

export default function SampleScanSection({ pickedSample, onPick, onScan, onCancel }: SampleScanSectionProps) {
  // The drag payload. A ref, not event.dataTransfer — so the drop handler can
  // tell an internal sample-card drag from anything else without ever
  // touching the files a real file-system drag would carry.
  const draggingIdRef = useRef<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleDragStart = (sample: SampleContract) => (event: DragEvent<HTMLDivElement>) => {
    draggingIdRef.current = sample.id;
    setDraggingId(sample.id);
    event.dataTransfer.effectAllowed = "move";
    // Some browsers require data to be set for a drag to start at all; the
    // drop handler ignores this and reads the ref instead.
    try {
      event.dataTransfer.setData("text/plain", sample.id);
    } catch {
      // Safari can throw here mid-gesture — the ref is the source of truth anyway.
    }
  };

  const handleDragEnd = () => {
    draggingIdRef.current = null;
    setDraggingId(null);
    setIsDragOver(false);
  };

  const handleZoneDragOver = (event: DragEvent<HTMLDivElement>) => {
    // Only accept the drop — i.e. preventDefault — for an internal sample
    // drag. Without this, a desktop file drag never becomes a valid drop.
    if (!draggingIdRef.current) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
  };

  const handleZoneDragLeave = () => setIsDragOver(false);

  const handleZoneDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!draggingIdRef.current) return;
    event.preventDefault();
    const dropped = SAMPLE_CONTRACTS.find((s) => s.id === draggingIdRef.current);
    draggingIdRef.current = null;
    setDraggingId(null);
    setIsDragOver(false);
    if (dropped) onPick(dropped);
  };

  return (
    <section id="sample-scan" data-screen-label="Sample scan" style={{ padding: "88px 0 32px" }}>
      <span
        style={{
          display: "block",
          fontSize: 13,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          fontWeight: 600,
          color: "var(--color-accent-700)",
          marginBottom: 12,
        }}
      >
        09 · Try it with a sample
      </span>
      <hr style={{ height: 1, border: 0, background: "var(--color-divider)", margin: "0 0 20px" }} />
      <h2 style={{ fontSize: "clamp(28px,3.4vw,44px)", lineHeight: 1.06, letterSpacing: "0.01em", textTransform: "uppercase", margin: "0 0 12px" }}>
        See a real scan, with a sample contract
      </h2>
      <p style={{ fontSize: 15, lineHeight: "24px", margin: "0 0 8px", maxWidth: "62ch", color: dim70 }}>
        These three contracts — a commercial lease, a vendor services agreement and a mutual NDA — have already been run
        through the scanner. Pick one to watch the extraction sequence and open the same results view a real upload gives you.
      </p>
      <p style={{ fontSize: 13, lineHeight: "21px", margin: "0 0 36px", maxWidth: "62ch", color: dim }}>
        Nothing is uploaded and no contract of yours is analyzed — this runs entirely on the pre-generated sample data.
      </p>

      {/* Draggable sample cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,220px),1fr))",
          gap: "clamp(16px,2vw,24px)",
          marginBottom: 28,
        }}
      >
        {SAMPLE_CONTRACTS.map((sample) => (
          <div
            key={sample.id}
            draggable
            onDragStart={handleDragStart(sample)}
            onDragEnd={handleDragEnd}
            className="blueprint"
            style={{
              padding: 16,
              display: "flex",
              alignItems: "center",
              gap: 12,
              cursor: "grab",
              background: "var(--color-bg)",
              opacity: draggingId && draggingId !== sample.id ? 0.5 : 1,
              outline: draggingId === sample.id ? "1px solid var(--color-accent)" : "none",
              transition: "opacity 150ms ease, outline-color 150ms ease",
            }}
          >
            <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
            <span aria-hidden style={{ color: dim, fontSize: 16, letterSpacing: 1, lineHeight: 1, flex: "none" }}>⠿</span>
            <IconFile size={18} opacity={0.7} />
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{ display: "block", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {sample.fileName}
              </span>
              <span style={{ display: "block", fontSize: 11, color: dim, fontFeatureSettings: "'tnum' 1" }}>
                {sample.pageCount} page{sample.pageCount === 1 ? "" : "s"} · drag to the drop zone
              </span>
            </span>
          </div>
        ))}
      </div>

      {/* Drop zone / confirm card */}
      <div className="blueprint" style={{ background: "var(--color-bg)", marginBottom: 28 }}>
        <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
        {pickedSample ? (
          <div style={{ padding: "28px 24px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 44,
                height: 44,
                border: "1px solid var(--color-accent)",
                background: "color-mix(in srgb, var(--color-accent) 8%, transparent)",
                marginBottom: 14,
              }}
            >
              <IconFile size={20} opacity={0.85} />
            </div>
            <p style={{ fontSize: 15, fontWeight: 600, fontFamily: "var(--font-heading)" }}>{pickedSample.fileName}</p>
            <p style={{ marginTop: 4, fontSize: 13, color: dim, fontFeatureSettings: "'tnum' 1" }}>
              {pickedSample.pageCount} page{pickedSample.pageCount === 1 ? "" : "s"} · sample contract · nothing uploaded
            </p>
            <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap", justifyContent: "center" }}>
              <button type="button" className="btn btn-primary" onClick={onScan}>
                Scan
              </button>
              <button type="button" className="btn btn-secondary" onClick={onCancel}>
                Choose another
              </button>
            </div>
          </div>
        ) : (
          <div
            onDragOver={handleZoneDragOver}
            onDragLeave={handleZoneDragLeave}
            onDrop={handleZoneDrop}
            style={{
              display: "flex",
              minHeight: 200,
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "36px 28px",
              textAlign: "center",
              border: isDragOver ? "1px dashed var(--color-accent)" : "1px dashed transparent",
              background: isDragOver ? "color-mix(in srgb, var(--color-accent) 6%, transparent)" : "transparent",
              transition: "border-color 200ms cubic-bezier(0.4,0,0.2,1), background-color 200ms cubic-bezier(0.4,0,0.2,1)",
            }}
          >
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
              Drop a sample here
            </h3>
            <p style={{ marginTop: 6, maxWidth: 380, fontSize: 14, lineHeight: "21px", color: dim }}>
              Drag one of the three sample cards above into this zone, or pick one below.
            </p>

            <div style={{ position: "relative", marginTop: 20 }}>
              <button type="button" className="btn btn-primary" onClick={() => setMenuOpen((o) => !o)}>
                Select PDF
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  className="blueprint"
                  style={{
                    position: "absolute",
                    top: "calc(100% + 8px)",
                    left: "50%",
                    transform: "translateX(-50%)",
                    zIndex: 20,
                    background: "var(--color-bg)",
                    minWidth: 240,
                    padding: 6,
                    boxShadow: "0 6px 20px rgba(0,0,0,.14)",
                  }}
                >
                  <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
                  {SAMPLE_CONTRACTS.map((sample) => (
                    <button
                      key={sample.id}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        onPick(sample);
                      }}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "9px 12px",
                        fontSize: 13,
                        background: "transparent",
                        border: 0,
                        cursor: "pointer",
                        color: "var(--color-text)",
                        fontFamily: "var(--font-body)",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "color-mix(in srgb, var(--color-text) 7%, transparent)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <span style={{ fontWeight: 600 }}>{sample.label}</span>
                      <span style={{ display: "block", fontSize: 11, color: dim }}>{sample.fileName}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Descriptive cards with "Try it" */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,280px),1fr))",
          gap: "clamp(20px,2.5vw,32px)",
          alignItems: "stretch",
        }}
      >
        {SAMPLE_CONTRACTS.map((sample) => {
          const watchCount = sample.analysis.thingsToWatch?.length ?? 0;
          return (
            <div key={sample.id} className="blueprint" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
              <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
              <span className="tag tag-outline" style={{ alignSelf: "flex-start" }}>{sample.label}</span>
              <p style={{ fontSize: 14, lineHeight: "21px", color: dim70, margin: 0 }}>{sample.blurb}</p>
              <span style={{ fontSize: 11, color: dim, fontFeatureSettings: "'tnum' 1" }}>
                {sample.pageCount} page{sample.pageCount === 1 ? "" : "s"} · {watchCount} thing{watchCount === 1 ? "" : "s"} to watch
              </span>
              <button type="button" className="btn btn-primary" style={{ marginTop: "auto", alignSelf: "flex-start" }} onClick={() => onPick(sample)}>
                Try it
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
