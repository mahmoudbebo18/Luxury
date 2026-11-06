// Language for the member-facing pages: remembered per device, switchable from the header.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ar, type StringKey } from './ar';
import { en } from './en';

export type Lang = 'ar' | 'en';
const STORAGE_KEY = 'luxury-lang';

function initialLang(): Lang {
  const fromUrl = new URLSearchParams(location.search).get('lang');
  if (fromUrl === 'ar' || fromUrl === 'en') return fromUrl;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'ar' || saved === 'en') return saved;
  } catch {
    /* storage blocked */
  }
  // Coming from the English marketing pages
  try {
    return /^\/en(\/|$)/.test(new URL(document.referrer).pathname) ? 'en' : 'ar';
  } catch {
    return 'ar';
  }
}

type Ctx = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: StringKey, vars?: Record<string, string | number>) => string;
};

const LangContext = createContext<Ctx | null>(null);

export function LangProvider({ children, forced }: { children: ReactNode; forced?: Lang }) {
  const [chosen, setChosen] = useState<Lang>(initialLang);
  const lang = forced ?? chosen;

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setChosen(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage blocked */
    }
  }, []);

  const t = useCallback<Ctx['t']>(
    (key, vars) => {
      let s: string = (lang === 'ar' ? ar : en)[key] ?? key;
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
      return s;
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useT() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useT outside LangProvider');
  return ctx;
}
