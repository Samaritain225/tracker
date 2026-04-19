/**
 * AppLockProvider — biometric authentication gate.
 * When app lock is enabled in settings, requires FaceID/TouchID
 * on app resume from background. Shows a full-screen overlay when locked.
 */

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useTranslation } from 'react-i18next';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Spacing, Typography } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import { useTheme } from './theme-provider';
import { useSettings } from '@/hooks/use-settings';
import { Button } from '@/components/ui/button';

type AppLockContextType = {
  isLocked: boolean;
};

const AppLockContext = createContext<AppLockContextType>({ isLocked: false });

type Props = {
  children: React.ReactNode;
};

export function AppLockProvider({ children }: Props) {
  const { settings } = useSettings();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const [isLocked, setIsLocked] = useState(false);
  const [appStateStatus, setAppStateStatus] = useState(AppState.currentState);
  const appState = useRef(AppState.currentState);
  const lockEnabled = !!settings?.appLockEnabled;
  const initialCheckDone = useRef(false);

  const authenticate = useCallback(async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        // Can't authenticate — unlock anyway to avoid being permanently locked out
        setIsLocked(false);
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: t('settings.app_lock_prompt'),
        fallbackLabel: t('settings.use_passcode'),
        cancelLabel: t('common.cancel'),
      });

      if (result.success) {
        setIsLocked(false);
      }
    } catch (e) {
      console.error('Authentication error:', e);
    }
  }, [t]);

  // Initial lock check when DB settings load
  useEffect(() => {
    if (settings && !initialCheckDone.current) {
      initialCheckDone.current = true;
      if (settings.appLockEnabled) {
        setIsLocked(true);
      }
    }
  }, [settings]);

  // Listen for app state changes (active ↔ background/inactive)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (lockEnabled) {
        // Lock immediately to obscure OS app switcher snapshots and handle screen off
        if (nextAppState === 'inactive' || nextAppState === 'background') {
          setIsLocked(true);
        }
      }
      setAppStateStatus(nextAppState);
      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, [lockEnabled]);

  // Auto-prompt when locked AND app is active (prevents prompt failures in background)
  useEffect(() => {
    if (isLocked && appStateStatus === 'active') {
      authenticate();
    }
  }, [isLocked, appStateStatus, authenticate]);

  return (
    <AppLockContext.Provider value={{ isLocked }}>
      {children}
      {isLocked && (
        <Animated.View 
          entering={FadeIn.duration(300)} 
          exiting={FadeOut.duration(300)}
          style={styles.overlay}
        >
          <Text style={styles.lockIcon}>🔒</Text>
          <Text style={styles.lockTitle}>{t('app.name')}</Text>
          <Text style={styles.lockSubtitle}>{t('settings.app_lock_prompt')}</Text>
          <View style={styles.unlockButton}>
            <Button
              label={t('settings.unlock')}
              onPress={authenticate}
              icon="finger-print-outline"
            />
          </View>
        </Animated.View>
      )}
    </AppLockContext.Provider>
  );
}

export function useAppLock() {
  return useContext(AppLockContext);
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.xl,
    zIndex: 9999,
  },
  lockIcon: {
    fontSize: 48,
    marginBottom: Spacing.md,
  },
  lockTitle: {
    fontSize: Typography.sizes.xxl,
    fontWeight: Typography.weights.bold,
    color: colors.textPrimary,
  },
  lockSubtitle: {
    fontSize: Typography.sizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  unlockButton: {
    marginTop: Spacing.xl,
  },
});
