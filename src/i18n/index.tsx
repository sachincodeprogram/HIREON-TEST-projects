import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en, { TranslationKey } from './en';
import hi from './hi';

// App ki languages. Nayi language add karni ho to: translations file banao
// (en.ts jaisi, `Translations` type ke saath) aur yahan LANGUAGES + DICTIONARIES me jodo.
export type Language = 'en' | 'hi';

export interface LanguageOption {
  code: Language;
  /** Language ka naam usi language me — picker me bada dikhta hai */
  nativeName: string;
  /** English naam — picker me chhota subtitle */
  englishName: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: 'en', nativeName: 'English', englishName: 'English' },
  { code: 'hi', nativeName: 'हिन्दी',   englishName: 'Hindi' },
];

const DICTIONARIES: Record<Language, Record<TranslationKey, string>> = { en, hi };

const DEFAULT_LANGUAGE: Language = 'en';
export const LANGUAGE_STORAGE_KEY = '@hireon/language';

export type TranslateParams = Record<string, string | number>;

// Current language module-level par bhi rakhte hain taaki hooks ke bahar
// (services, notifications) bhi `translate()` se sahi text mile.
let currentLanguage: Language = DEFAULT_LANGUAGE;

export const getLanguage = () => currentLanguage;

/** `{{name}}` jaise placeholders ko params se bhar deta hai. Key missing ho to English, phir key khud. */
export const translate = (key: TranslationKey, params?: TranslateParams): string => {
  let text = DICTIONARIES[currentLanguage][key] ?? en[key] ?? key;
  if (params) {
    for (const p of Object.keys(params)) {
      text = text.split(`{{${p}}}`).join(String(params[p]));
    }
  }
  return text;
};

interface I18nContextValue {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: typeof translate;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);
  const [ready, setReady] = useState(false);

  // Saved language pehle load karo — warna app ek pal English me dikh ke badlega.
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (saved && saved in DICTIONARIES) {
          currentLanguage = saved as Language;
          setLanguageState(saved as Language);
        }
      } catch {
        /* storage fail ho to default English hi sahi */
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const setLanguage = useCallback(async (lang: Language) => {
    currentLanguage = lang;
    setLanguageState(lang);
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch {
      /* ignore persist errors */
    }
  }, []);

  // `language` dependency jaan-bujhke hai — language badalte hi naya `t`
  // milta hai aur saare screens re-render hote hain.
  const t = useCallback<typeof translate>((key, params) => translate(key, params), [language]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);

  if (!ready) return null;
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useTranslation = (): I18nContextValue => {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useTranslation must be used inside <LanguageProvider>');
  return ctx;
};

export type { TranslationKey };
