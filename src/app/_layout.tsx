/**
 * Root layout — entry point for the app.
 * Imports i18n as a side effect (must be first import).
 * Wraps the app with DatabaseProvider.
 */

import '@/i18n';

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';

import { ThemeProvider as NavThemeProvider, DarkTheme, DefaultTheme } from '@react-navigation/native';

import { DatabaseProvider } from '@/providers/database-provider';
import { ThemeProvider, useTheme } from '@/providers/theme-provider';
import { AppLockProvider } from '@/providers/app-lock-provider';
import { setupNotificationHandler } from '@/services/notifications';

// Set up notification handler at module level (before any component renders)
setupNotificationHandler();

function AppContent() {
  const { isDark, colors } = useTheme();

  const navTheme = isDark ? DarkTheme : DefaultTheme;
  const customNavTheme = {
    ...navTheme,
    colors: {
      ...navTheme.colors,
      background: colors.background,
      card: colors.surface,
      text: colors.textPrimary,
      border: colors.border,
      primary: colors.primary,
    },
  };

  return (
    <NavThemeProvider value={customNavTheme}>
      <StatusBar 
        style={isDark ? 'light' : 'dark'} 
        backgroundColor={colors.background}
      />
      <Stack
        screenOptions={{
          animation: 'fade',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" options={{ title: 'Oops!' }} />
        <Stack.Screen 
          name="day/[date]" 
          options={{ 
            presentation: 'formSheet', 
            headerShown: false,
            sheetAllowedDetents: [0.6, 0.9],
            sheetGrabberVisible: true,
          }} 
        />
      </Stack>
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <DatabaseProvider>
      <ThemeProvider>
        <AppLockProvider>
          <AppContent />
        </AppLockProvider>
      </ThemeProvider>
    </DatabaseProvider>
  );
}
