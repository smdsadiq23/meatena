"use client";

import { useEffect, useState } from "react";
import { type Language, translate } from "./i18n";

export function useLanguage() {
  const [language, setLanguage] = useState<Language>("en");

  useEffect(() => {
    function readLanguage() {
      const stored = window.localStorage.getItem("language");
      setLanguage(stored === "ar" ? "ar" : "en");
    }

    readLanguage();
    window.addEventListener("storage", readLanguage);
    window.addEventListener("language-change", readLanguage);

    return () => {
      window.removeEventListener("storage", readLanguage);
      window.removeEventListener("language-change", readLanguage);
    };
  }, []);

  return {
    language,
    t: (text: string) => translate(language, text),
  };
}
