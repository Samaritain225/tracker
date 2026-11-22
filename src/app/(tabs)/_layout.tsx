/**
 * Tab layout — defines the 3-tab navigation bar.
 * Labels are translated, icons use Ionicons via the Icon component.
 */

import React from 'react';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/providers/theme-provider';
import { Icon, type IconName } from '@/components/ui/icon';

type TabConfig = {
  name: string;
  titleKey: string;
  activeIcon: IconName;
  inactiveIcon: IconName;
};

const TABS: TabConfig[] = [
  { name: 'index', titleKey: 'tabs.home', activeIcon: 'calendar', inactiveIcon: 'calendar-outline' },
  { name: 'history', titleKey: 'tabs.history', activeIcon: 'list', inactiveIcon: 'list-outline' },
  { name: 'insights', titleKey: 'tabs.insights', activeIcon: 'pie-chart', inactiveIcon: 'pie-chart-outline' },
  { name: 'settings', titleKey: 'tabs.settings', activeIcon: 'settings', inactiveIcon: 'settings-outline' },
];

export default function TabLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: t(tab.titleKey),
            // Colour comes from the theme rather than the navigator's
            // `color` argument: React Native 0.88 widened that to a
            // ColorValue the icon font cannot take, and these are the
            // same two theme values passed as the tint colours above.
            tabBarIcon: ({ focused, size }) => (
              <Icon
                name={focused ? tab.activeIcon : tab.inactiveIcon}
                size={size}
                color={focused ? colors.tabActive : colors.tabInactive}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
