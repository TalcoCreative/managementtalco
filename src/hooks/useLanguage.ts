import { createContext, useContext, useState, useEffect, useCallback } from "react";

export type Language = "en" | "id";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (en: string, id: string) => string;
}

export const LanguageContext = createContext<LanguageContextType>({
  language: "en",
  setLanguage: () => {},
  t: (en) => en,
});

export function useLanguage() {
  return useContext(LanguageContext);
}

export function useLanguageState(): LanguageContextType {
  const [language, setLang] = useState<Language>(() => {
    const stored = localStorage.getItem("app_language");
    return (stored === "id" ? "id" : "en") as Language;
  });

  const setLanguage = useCallback((lang: Language) => {
    setLang(lang);
    localStorage.setItem("app_language", lang);
  }, []);

  const t = useCallback(
    (en: string, id: string) => (language === "id" ? id : en),
    [language]
  );

  return { language, setLanguage, t };
}
