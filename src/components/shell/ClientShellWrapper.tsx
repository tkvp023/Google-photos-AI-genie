"use client";

import React, { useState, useEffect } from "react";
import { PixelPhoneShell } from "./PixelPhoneShell";
import { GuideProvider } from "@/context/GuideContext";

interface ClientShellWrapperProps {
  children: React.ReactNode;
}

export function ClientShellWrapper({ children }: ClientShellWrapperProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div
        className="w-full h-screen bg-[#eaedf1] flex items-center justify-center font-sans"
        suppressHydrationWarning
      />
    );
  }

  return (
    <GuideProvider>
      <PixelPhoneShell>{children}</PixelPhoneShell>
    </GuideProvider>
  );
}
