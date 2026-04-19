import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { LightTheme, DarkTheme } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import { useSettings } from '@/hooks/use-settings';

type ThemeContextType = {
  colors: ThemeColors;
  isDark: boolean;
  themeSetting: 'system' | 'light' | 'dark';
};

const ThemeContext = createContext<ThemeContextType>({
  colors: LightTheme,
  isDark: false,
  themeSetting: 'system',
});

type Props = {
  children: React.ReactNode;
};

export function ThemeProvider({ children }: Props) {
  const { settings } = useSettings();
  const systemColorScheme = useColorScheme();

  const themeSetting = (settings?.theme as 'system' | 'light' | 'dark') ?? 'system';

  const isDark = useMemo(() => {
    if (themeSetting === 'dark') return true;
    if (themeSetting === 'light') return false;
    return systemColorScheme === 'dark';
  }, [themeSetting, systemColorScheme]);

  const colors = isDark ? DarkTheme : LightTheme;

  const value = useMemo(
    () => ({ colors, isDark, themeSetting }),
    [colors, isDark, themeSetting],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
