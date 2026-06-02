import { useState, useEffect } from 'react';
import { getCurrentLang, onLangChange } from '../i18n';

export function useLang() {
  const [lang, setLang] = useState(getCurrentLang);

  useEffect(() => {
    return onLangChange(setLang);
  }, []);

  return lang;
}
