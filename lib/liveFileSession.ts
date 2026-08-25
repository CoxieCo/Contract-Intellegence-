// A File object can't be serialized into sessionStorage, so navigating away
// from "/" (e.g. to the dashboard) and back necessarily unmounts the page
// component that held it in React state — the browser tab is still alive
// (Next.js client-side navigation, no hard reload), but the File reference
// itself is gone once that component unmounts. Holding it here instead, at
// module scope rather than component state, means it survives route changes
// within the same tab: a freshly-scanned contract's real source PDF stays
// available for citations even after a trip through the dashboard, while a
// closed tab, hard refresh, or a genuinely past analysis (loaded from
// storage in a different session) correctly still has nothing to offer.
let heldFile: File | null = null;
let heldFileName: string | null = null;

export function setLiveAnalysisFile(file: File) {
  heldFile = file;
  heldFileName = file.name;
}

export function getLiveAnalysisFile(fileName: string): File | null {
  return heldFileName === fileName ? heldFile : null;
}

export function clearLiveAnalysisFile() {
  heldFile = null;
  heldFileName = null;
}
