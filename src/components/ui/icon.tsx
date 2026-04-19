/**
 * Icon wrapper — single source of truth for all icons in the app.
 * Never import Ionicons directly in other files.
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';

import { useTheme } from '@/providers/theme-provider';

export type IconName = keyof typeof Ionicons.glyphMap;

type Props = {
  name: IconName;
  size?: number;
  color?: string;
};

export function Icon({ name, size = 20, color }: Props) {
  const { colors } = useTheme();
  return <Ionicons name={name} size={size} color={color ?? colors.textPrimary} />;
}
