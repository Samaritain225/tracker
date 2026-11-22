/**
 * LocaleProvider — applies the saved language to i18next.
 *
 * i18n initializes with a static 'fr' before any database read can have
 * happened (see src/i18n/index.ts), and useSettings only calls
 * changeLanguage inside its own updater. Without this, a language the
 * user picked was written to the database, shown as selected in
 * Settings, and never actually applied again after a cold start.
 *
 * Mounted at the app root, above everything that renders translated
 * text, so tab labels and the app-lock prompt are already correct on
 * first paint rather than flashing French.
 *
 * This has no UI of its own — it's a pure side-effect component, the
 * same shape as RemindersProvider.
 */

import React, { useEffect } from 'react';
import i18n from 'i18next';

import { useSettings } from '@/hooks/use-settings';

type Props = {
  children: React.ReactNode;
};

export function LocaleProvider({ children }: Props) {
  const { settings } = useSettings();
  const language = settings?.language;

  useEffect(() => {
    // Undefined while the settings query is still resolving — leave the
    // init-time default in place rather than forcing a language.
    if (language && i18n.language !== language) {
      i18n.changeLanguage(language);
    }
  }, [language]);

  return <>{children}</>;
}
