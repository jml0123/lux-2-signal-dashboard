"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AmbientTimeKnot } from "@/app/lib/readings/ambientLightScrub";
import {
  ambientGradientEndpointsAtStop,
  ambientPageGradientCss,
  lerpAmbientEndpoints,
  luxToAmbientStopIndex,
  timeMsToStopIndex,
} from "@/app/lib/readings/ambientLightScrub";
import { AMBIENT_PAGE_SCRUB_DRIVE_MODE } from "@/app/lib/readings/readings.constants";
import {
  luxAtTimeMsFromTimeline,
  type LuxTimelineBucket,
} from "@/app/lib/readings/data/readings";

const DURATION_MS = 320;

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

type UseArgs = {
  ambientKnots: AmbientTimeKnot[];
  luxTimeline: LuxTimelineBucket[];
  resetDeps: readonly unknown[];
};

export function useAnimatedAmbientScrubGradient({
  ambientKnots,
  luxTimeline,
  resetDeps,
}: UseArgs): {
  overlayGradientCss: string | null;
  onAmbientScrubTime: (timeMs: number | null) => void;
} {
  const [overlayGradientCss, setOverlayGradientCss] = useState<string | null>(null);
  const rafRef = useRef(0);
  const currentEndpointsRef = useRef<{ top: string; bottom: string } | null>(null);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    currentEndpointsRef.current = null;
    setOverlayGradientCss(null);
  }, resetDeps);

  const onAmbientScrubTime = useCallback(
    (timeMs: number | null) => {
      cancelAnimationFrame(rafRef.current);
      if (timeMs === null) {
        currentEndpointsRef.current = null;
        setOverlayGradientCss(null);
        return;
      }

      let target: { top: string; bottom: string };
      if (AMBIENT_PAGE_SCRUB_DRIVE_MODE === "time") {
        const s = timeMsToStopIndex(timeMs, ambientKnots);
        target = ambientGradientEndpointsAtStop(s);
      } else {
        const lux = luxAtTimeMsFromTimeline(luxTimeline, timeMs);
        if (lux === null) {
          currentEndpointsRef.current = null;
          setOverlayGradientCss(null);
          return;
        }
        target = ambientGradientEndpointsAtStop(luxToAmbientStopIndex(lux));
      }

      const from = currentEndpointsRef.current ?? target;
      const start = performance.now();
      const tick = (now: number) => {
        const raw = Math.min(1, (now - start) / DURATION_MS);
        const u = easeOutCubic(raw);
        const ep = lerpAmbientEndpoints(from, target, u);
        currentEndpointsRef.current = ep;
        setOverlayGradientCss(ambientPageGradientCss(ep));
        if (raw < 1) {
          rafRef.current = requestAnimationFrame(tick);
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    },
    [ambientKnots, luxTimeline],
  );

  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  return { overlayGradientCss, onAmbientScrubTime };
}
