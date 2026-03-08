import React from "react";
import { LanguageContext, useLanguageState } from "@/hooks/useLanguage";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const value = useLanguageState();
  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}
