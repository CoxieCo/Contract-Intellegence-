import { WorkerMessageHandler } from "pdfjs-dist/legacy/build/pdf.worker.mjs";

// pdfjs-dist (bundled inside pdf-parse) has no real Worker thread available in
// Node, so it falls back to a "fake worker" that runs the same worker code
// in-process. To locate that code it does `await import(GlobalWorkerOptions.workerSrc)`
// — a *dynamic*, runtime-computed import path, which Vercel's file tracer can't
// follow statically, so the file never makes it into the deployed function and
// this throws "Cannot find module .../pdfjs-dist/legacy/build/...".
//
// Before falling back to that dynamic import, pdfjs-dist first checks
// `globalThis.pdfjsWorker?.WorkerMessageHandler` (its own documented Node.js
// integration point) and uses it directly if present. Pre-populating it here —
// via a static, literal import specifier that the tracer *can* follow — makes
// pdfjs-dist skip the dynamic import path entirely. This is the same
// WorkerMessageHandler the real worker would have used, so extraction behaves
// identically; nothing about parsing quality changes, only how the code is loaded.
declare global {
  // eslint-disable-next-line no-var
  var pdfjsWorker: { WorkerMessageHandler: typeof WorkerMessageHandler } | undefined;
}

export function installPdfWorker() {
  if (!globalThis.pdfjsWorker) {
    globalThis.pdfjsWorker = { WorkerMessageHandler };
  }
}
