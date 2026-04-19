/**
 * Reusable Button component with multiple variants.
 */

import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
} from 'react-native';

import { Radii, Spacing, Typography } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import { useTheme } from '@/providers/theme-provider';
import { Icon, type IconName } from './icon';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
  fullWidth?: boolean;
};

const getVariantStyles = (colors: ThemeColors): Record<Variant, { bg: string; text: string; border?: string }> => ({
  primary: { bg: colors.primary, text: colors.primaryText },
  secondary: { bg: colors.surfaceAlt, text: colors.textPrimary, border: colors.border },
  danger: { bg: colors.danger, text: colors.dangerText },
  ghost: { bg: 'transparent', text: colors.primary },
});

const sizeStyles: Record<Size, { paddingH: number; paddingV: number; fontSize: number; iconSize: number }> = {
  sm: { paddingH: Spacing.md, paddingV: Spacing.xs, fontSize: Typography.sizes.sm, iconSize: 14 },
  md: { paddingH: Spacing.lg, paddingV: Spacing.sm, fontSize: Typography.sizes.md, iconSize: 18 },
  lg: { paddingH: Spacing.xl, paddingV: Spacing.md, fontSize: Typography.sizes.lg, iconSize: 20 },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  fullWidth = false,
}: Props) {
  const { colors } = useTheme();
  
  const v = getVariantStyles(colors)[variant];
  const s = sizeStyles[size];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityLabel={label}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: v.bg,
          borderColor: v.border ?? v.bg,
          borderWidth: v.border ? 1 : 0,
          paddingHorizontal: s.paddingH,
          paddingVertical: s.paddingV,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
          alignSelf: fullWidth ? 'stretch' : 'auto',
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.text} />
      ) : (
        <>
          {icon && <Icon name={icon} size={s.iconSize} color={v.text} />}
          <Text
            style={[
              styles.label,
              {
                color: v.text,
                fontSize: s.fontSize,
              },
            ]}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: Radii.md,
    borderCurve: 'continuous',
  },
  label: {
    fontWeight: Typography.weights.semibold,
  },
});
