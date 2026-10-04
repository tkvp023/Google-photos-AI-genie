"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";

interface GuideContextType {
  isGuideOn: boolean;
  toggleGuide: () => void;
  setGuideOn: (on: boolean) => void;
}

const GuideContext = createContext<GuideContextType>({
  isGuideOn: true,
  toggleGuide: () => {},
  setGuideOn: () => {},
});

const STORAGE_KEY = "gp_guide_mode";

function GuideStateResolver({ onResolved }: { onResolved: (isGuide: boolean) => void }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const param = searchParams.get("guide");
    if (param === "off") {
      try {
        sessionStorage.setItem(STORAGE_KEY, "off");
      } catch {}
      onResolved(false);
    } else if (param === "on") {
      try {
        sessionStorage.setItem(STORAGE_KEY, "on");
      } catch {}
      onResolved(true);
    } else {
      try {
        const stored = sessionStorage.getItem(STORAGE_KEY);
        if (stored === "off") {
          onResolved(false);
          return;
        }
      } catch {}
      onResolved(true);
    }
  }, [searchParams, onResolved]);

  return null;
}

export function GuideProvider({ children }: { children: React.ReactNode }) {
  const [isGuideOn, setIsGuideOn] = useState<boolean>(true);

  const handleResolved = useCallback((initialState: boolean) => {
    setIsGuideOn(initialState);
  }, []);

  const setGuideOn = useCallback((on: boolean) => {
    setIsGuideOn(on);
    try {
      sessionStorage.setItem(STORAGE_KEY, on ? "on" : "off");
    } catch {}
  }, []);

  const toggleGuide = useCallback(() => {
    setIsGuideOn((prev) => {
      const next = !prev;
      try {
        sessionStorage.setItem(STORAGE_KEY, next ? "on" : "off");
      } catch {}
      return next;
    });
  }, []);

  return (
    <GuideContext.Provider value={{ isGuideOn, toggleGuide, setGuideOn }}>
      <Suspense fallback={null}>
        <GuideStateResolver onResolved={handleResolved} />
      </Suspense>
      {children}
    </GuideContext.Provider>
  );
}

export function useGuide(): GuideContextType {
  return useContext(GuideContext);
}
