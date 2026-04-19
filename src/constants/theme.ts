/**
 * Design tokens for the Cycle Tracker app.
 * Soft rose/mauve primary palette with warm neutrals.
 * Every component must reference these — no hardcoded values.
 */

// Cycle states shared across themes (these colours pop nicely on both light and dark)
const CycleColors = {
  period: '#E8596E',
  periodText: '#FFFFFF',
  fertile: '#5BB8A6',
  fertileText: '#FFFFFF',
  ovulation: '#F0A04B',
  ovulationText: '#FFFFFF',
  predicted: '#B09ACE',
  predictedText: '#FFFFFF',
};

export const LightTheme = {
  ...CycleColors,
  // App chrome
  primary: '#C06C84',
  primaryLight: '#E8A4B8',
  primaryText: '#FFFFFF',
  background: '#FBF7F4',
  surface: '#FFFFFF',
  surfaceAlt: '#F5EDE8',
  border: '#E8DDD6',
  borderStrong: '#D4C5BB',
  textPrimary: '#2D2226',
  textSecondary: '#6E5D66',
  textMuted: '#A8969E',
  danger: '#D94F5C',
  dangerText: '#FFFFFF',
  success: '#5BB8A6',
  successText: '#FFFFFF',
  tabActive: '#C06C84',
  tabInactive: '#A8969E',
};

export const DarkTheme: ThemeColors = {
  ...CycleColors,
  // Adjust predicted for better contrast on dark if needed, but cycle colors are mostly fine
  
  // App chrome
  primary: '#DCA2B3', // Lighter rose for dark mode contrast
  primaryLight: '#59323E', 
  primaryText: '#FFFFFF',
  background: '#121212',
  surface: '#1E1E1E',
  surfaceAlt: '#2A2A2A',
  border: '#333333',
  borderStrong: '#444444',
  textPrimary: '#EAEAEA',
  textSecondary: '#A0A0A0',
  textMuted: '#666666',
  danger: '#ff6b6b',
  dangerText: '#FFFFFF',
  success: '#5BB8A6',
  successText: '#FFFFFF',
  tabActive: '#DCA2B3',
  tabInactive: '#666666',
};

export type ThemeColors = typeof LightTheme;

export const Typography = {
  fontFamily: 'System',
  sizes: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 22,
    xxl: 28,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  lineHeights: {
    tight: 1.2,
    normal: 1.4,
    relaxed: 1.6,
  },
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const Radii = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;
