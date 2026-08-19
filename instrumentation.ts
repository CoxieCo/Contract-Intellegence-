export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { installPdfPolyfills } = await import("@/lib/pdfPolyfills");
    installPdfPolyfills();
    const { installPdfWorker } = await import("@/lib/pdfWorkerSetup");
    installPdfWorker();
  }
}
