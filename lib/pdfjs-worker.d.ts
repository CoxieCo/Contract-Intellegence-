// pdfjs-dist doesn't ship type declarations for this subpath (only the main
// `pdf.mjs` entry has a `.d.mts`), so declare just enough to import it.
declare module "pdfjs-dist/legacy/build/pdf.worker.mjs" {
  export const WorkerMessageHandler: unknown;
}
