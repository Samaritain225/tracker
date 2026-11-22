/**
 * The animated launch screen. It takes over from Android's still splash
 * with the logo in exactly the same place, gives it a slow quarter turn
 * with a soft breath, and fades away to reveal Home once the app is
 * ready underneath. It never waits longer than loading needs: if loading
 * is done before the turn ends, it leaves as the turn ends; if loading
 * runs long, the logo keeps breathing until it's ready.
 *
 * The background follows the phone's theme, not the app's own setting,
 * because that is what Android's still splash used; the fade then
 * reveals the app in its own theme.
 */

import * as SplashScreen from 'expo-splash-screen';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { DarkTheme, LightTheme } from '@/constants/theme';

// Same image and width as the expo-splash-screen config in app.json, so
// the first frame here is pixel for pixel the frame Android just showed.
const SPLASH_IMAGE = require('../../assets/images/new-splash.png');
const SPLASH_IMAGE_WIDTH = 200;

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);

/** The quarter turn, with one breath riding on it. */
const TURN_MS = 900;
/** Lift and fade into Home. */
const EXIT_MS = 320;
/** Longest wait for the logo image before handing over anyway. */
const LOGO_LOAD_TIMEOUT_MS = 1500;
/** A slow breath while waiting on a long load. */
const WAIT_BREATH_MS = 1100;

type Props = {
  /** True once the database is ready (or failed) and the app is rendering underneath. */
  ready: boolean;
  /** Called when the fade has finished, so the screen can be unmounted. */
  onFinished: () => void;
};

export function LaunchSplash({ ready, onFinished }: Props) {
  const reduced = useReducedMotion();
  const scheme = useColorScheme();
  const background = scheme === 'dark' ? DarkTheme.background : LightTheme.background;

  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);
  const lift = useSharedValue(0);
  const opacity = useSharedValue(1);
  const [turnDone, setTurnDone] = useState(reduced);

  // Android's still splash stays up until the logo here has loaded, not
  // just the background: hiding on layout left one frame with no logo.
  const [logoShown, setLogoShown] = useState(false);
  const logoHandled = useRef(false);
  const handleLogoLoad = useCallback(() => {
    if (logoHandled.current) return;
    logoHandled.current = true;
    SplashScreen.hide();
    setLogoShown(true);
  }, []);

  // A safety net: if the image never reports back, don't hold the app.
  useEffect(() => {
    const timer = setTimeout(handleLogoLoad, LOGO_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [handleLogoLoad]);

  useEffect(() => {
    if (reduced || !logoShown) return;
    rotation.set(withTiming(90, { duration: TURN_MS, easing: EASE_IN_OUT }, (finished) => {
      if (finished) scheduleOnRN(setTurnDone, true);
    }));
    scale.set(
      withSequence(
        withTiming(1.05, { duration: TURN_MS / 2, easing: EASE_IN_OUT }),
        withTiming(1, { duration: TURN_MS / 2, easing: EASE_IN_OUT }),
      ),
    );
  }, [reduced, logoShown, rotation, scale]);

  // Loading outlasted the turn: keep breathing, gently, until it's ready.
  useEffect(() => {
    if (!turnDone || ready || reduced) return;
    scale.set(
      withRepeat(
        withSequence(
          withTiming(1.04, { duration: WAIT_BREATH_MS, easing: EASE_IN_OUT }),
          withTiming(1, { duration: WAIT_BREATH_MS, easing: EASE_IN_OUT }),
        ),
        -1,
      ),
    );
  }, [turnDone, ready, reduced, scale]);

  useEffect(() => {
    if (!turnDone || !ready || !logoShown) return;
    // One frame for Home to paint underneath before it is revealed.
    const frame = requestAnimationFrame(() => {
      if (!reduced) {
        cancelAnimation(scale);
        scale.set(withTiming(1.08, { duration: EXIT_MS, easing: EASE_OUT }));
        lift.set(withTiming(-16, { duration: EXIT_MS, easing: EASE_OUT }));
      }
      opacity.set(
        withTiming(0, { duration: reduced ? 250 : EXIT_MS, easing: EASE_OUT }, (finished) => {
          if (finished) scheduleOnRN(onFinished);
        }),
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [turnDone, ready, logoShown, reduced, scale, lift, opacity, onFinished]);

  const screenStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  const logoStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: lift.get() },
      { rotate: `${rotation.get()}deg` },
      { scale: scale.get() },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.screen, { backgroundColor: background }, screenStyle]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.Image
        source={SPLASH_IMAGE}
        style={[styles.logo, logoStyle]}
        resizeMode="contain"
        fadeDuration={0}
        onLoad={handleLogoLoad}
        onError={handleLogoLoad}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    elevation: 1000,
  },
  logo: {
    width: SPLASH_IMAGE_WIDTH,
    height: SPLASH_IMAGE_WIDTH,
  },
});
