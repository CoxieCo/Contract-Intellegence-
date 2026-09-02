"use client";

// Drives the real ScanningView (app/components/scan) for a pre-generated
// sample contract. ScanningView's props expect the parent to own a step
// counter rather than take finished data — on a real scan app/page.tsx
// advances `stepsDone` as each analysis section streams in. There is no
// stream here (the analysis is already known), so this walks the same five
// steps on a short timer purely so the checklist visibly ticks through
// before the results appear, then hands off via onViewResults.

import { useEffect, useState } from "react";
import ScanningView, { ScanPhase } from "../scan/ScanningView";
import type { SampleContract } from "./sampleContracts";

// Five steps (see SCAN_STEPS in ScanningView) — paced so the sequence reads
// as distinct rows completing one by one, not a jump. Deliberately unhurried
// (roughly double an earlier, too-quick pass) so each row is clearly its own
// beat.
const STEP_INTERVAL_MS = 1240;
const COMPLETE_DELAY_MS = 900;

export default function SampleScanRunner({
  sample,
  onViewResults,
}: {
  sample: SampleContract;
  onViewResults: () => void;
}) {
  const [stepsDone, setStepsDone] = useState(0);
  const [phase, setPhase] = useState<ScanPhase>("scanning");

  useEffect(() => {
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const interval = reduceMotion ? 90 : STEP_INTERVAL_MS;

    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let step = 1; step <= 5; step++) {
      timers.push(setTimeout(() => setStepsDone(step), interval * step));
    }
    timers.push(setTimeout(() => setPhase("complete"), interval * 5 + COMPLETE_DELAY_MS));
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <ScanningView
      fileName={sample.fileName}
      pageCount={sample.pageCount}
      stepsDone={stepsDone}
      phase={phase}
      onViewResults={onViewResults}
    />
  );
}
