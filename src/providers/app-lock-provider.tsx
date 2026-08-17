/**
 * AppLockProvider — biometric authentication gate.
 * When app lock is enabled in settings, requires FaceID/TouchID
 * on app resume from background. Shows a full-screen overlay when locked.
 *
 * ## What this is for
 *
 * Deliberately scoped to keeping someone who picks up an unlocked phone
 * out of the app — a curious partner, a colleague, a child. That is the
 * whole intent, and the Settings copy promises exactly that and no more
 * ("Require Face ID or fingerprint to open the app").
 *
 * It is explicitly NOT protection against someone with real access to
 * the device or its filesystem. Three things follow from that, all
 * chosen rather than overlooked — do not treat them as bugs to fix
 * without revisiting the scope decision first:
 *
 *   - The lock is a React overlay, so it cannot reliably blank the OS
 *     app-switcher snapshot. On Android only FLAG_SECURE does that; on
 *     iOS the snapshot is taken around willResignActive, which races the
 *     React commit. Screenshots are likewise unblocked.
 *   - There is no PIN fallback, so the lock is exactly as strong as the
 *     device biometric and no stronger.
 *   - The SQLite file is plaintext on disk. Anyone who can read the app
 *     sandbox can read the data regardless of this gate. (`allowBackup`
 *     is off in app.json so it at least does not leave the device.)
 *
 * Raising any of these means raising all of them — a FLAG_SECURE window
 * over an unencrypted database buys very little on its own.
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
        // Fails open, deliberately. A user who enables the lock and later
        // removes their fingerprint or Face ID would otherwise be shut out
        // of their own history with no recovery path — there is no PIN
        // fallback and no account to reset against, so a fail-closed
        // branch here is unrecoverable data loss.
        //
        // The cost is that removing biometrics silently disables the
        // lock. That is an acceptable trade at this threat model (see the
        // file header); it would not be if the lock were ever meant to
        // stop someone holding the device.
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
        // Lock on the way out rather than on the way back in, so the app
        // is already locked whenever it next becomes visible — including
        // after the screen simply switched off.
        //
        // This does NOT reliably hide the app-switcher snapshot, despite
        // being the natural place to expect that: the overlay is a React
        // view and the OS captures its thumbnail without waiting for a
        // render. Blanking that thumbnail needs FLAG_SECURE, which is out
        // of scope — see the file header.
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
