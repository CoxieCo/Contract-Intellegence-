"use client";

import { useEffect, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import Spinner from "./Spinner";

// Must be configured in the same module that renders <Document>/<Page> —
// see react-pdf's Next.js setup notes (setting it elsewhere can be overwritten
// by module execution order). This component is loaded client-only via
// next/dynamic({ ssr: false }) from page.tsx, so import.meta.url resolves correctly.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const VIEWER_WIDTH = 680;

function ChevronLeftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

export default function PdfViewer({
  file,
  page,
  section,
  onClose,
}: {
  file: File;
  page: number;
  section?: string | null;
  onClose: () => void;
}) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(page);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") setCurrentPage((p) => (numPages ? Math.min(p + 1, numPages) : p));
      else if (e.key === "ArrowLeft") setCurrentPage((p) => Math.max(p - 1, 1));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [numPages, onClose]);

  return (
    <div
      role="presentation"
      onClick={onClose}
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-sm"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Source PDF viewer"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-md border border-hairline bg-surface shadow-panel"
      >
        <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {file.name}
              {section ? ` · ${section}` : ""}
            </p>
            <p className="text-xs text-muted">
              Page {currentPage}
              {numPages ? ` of ${numPages}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage <= 1}
              className="flex items-center gap-1 rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors duration-200 hover:border-hairline-strong hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <ChevronLeftIcon />
              Prev
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => (numPages ? Math.min(p + 1, numPages) : p))}
              disabled={numPages !== null && currentPage >= numPages}
              className="flex items-center gap-1 rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors duration-200 hover:border-hairline-strong hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Next
              <ChevronRightIcon />
            </button>
            <span className="mx-0.5 h-4 w-px bg-hairline" />
            <kbd className="rounded border border-hairline-strong px-1.5 py-0.5 text-[10px] text-muted">Esc</kbd>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors duration-200 hover:bg-surface-raised hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <XIcon />
            </button>
          </div>
        </div>

        <div className="h-0.5 bg-hairline">
          <div
            className="h-full bg-accent transition-[width] duration-200"
            style={{ width: numPages ? `${(currentPage / numPages) * 100}%` : "0%" }}
          />
        </div>

        <div className="flex-1 overflow-auto bg-background/50 px-4 py-8">
          {loadError ? (
            <p className="py-10 text-center text-sm font-medium text-severity-high">{loadError}</p>
          ) : (
            <div className="mx-auto flex justify-center">
              <Document
                file={file}
                onLoadSuccess={({ numPages: n }) => setNumPages(n)}
                onLoadError={() => setLoadError("Couldn't load the PDF for preview.")}
                loading={
                  <div className="flex items-center gap-2 py-10 text-sm text-muted">
                    <Spinner />
                    Loading PDF…
                  </div>
                }
              >
                <div className="rounded-[3px] bg-[#f7f6f2] p-2 shadow-[0_20px_45px_-20px_rgba(0,0,0,0.7)]">
                  <Page
                    pageNumber={currentPage}
                    width={VIEWER_WIDTH}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    loading={
                      <div className="flex items-center gap-2 py-10 text-sm text-muted">
                        <Spinner />
                        Loading page…
                      </div>
                    }
                  />
                </div>
              </Document>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
