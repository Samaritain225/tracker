/**
 * i18next initialization.
 * Imported as a side-effect at the top of app/_layout.tsx.
 * Language is set to 'fr' by default; the DatabaseProvider syncs the saved preference.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import fr from './locales/fr.json';

i18n.use(initReactI18next).init({
  lng: 'fr',
  fallbackLng: 'fr',
  resources: {
    en: { translation: en },
    fr: { translation: fr },
  },
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
