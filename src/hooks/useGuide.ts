// src/hooks/useGuide.ts
// A1: ?guide=on (default) / ?guide=off switch persisted in sessionStorage.
// Does NOT interfere with Genie trigger, question selection, or chip behaviour.
"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const SESSION_KEY = "gp_guide_off";

/**
 * Returns whether the tester guide UI is active.
 * - `?guide=off` in URL → turns off guide and stores in sessionStorage
 * - `?guide=on`  in URL → clears sessionStorage (turns guide on)
 * - No param → reads sessionStorage; defaults to ON
 */
export function useGuide(): { isGuideOn: boolean } {
  const searchParams = useSearchParams();
  const [isGuideOn, setIsGuideOn] = useState(true);

  useEffect(() => {
    const param = searchParams.get("guide");
    if (param === "off") {
      try {
        sessionStorage.setItem(SESSION_KEY, "1");
      } catch {}
      setIsGuideOn(false);
    } else if (param === "on") {
      try {
        sessionStorage.removeItem(SESSION_KEY);
      } catch {}
      setIsGuideOn(true);
    } else {
      // No param — read sessionStorage
      try {
        const stored = sessionStorage.getItem(SESSION_KEY);
        setIsGuideOn(stored !== "1");
      } catch {
        setIsGuideOn(true);
      }
    }
  }, [searchParams]);

  return { isGuideOn };
}
