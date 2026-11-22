/**
 * A finished pregnancy's Journey, read-only, opened from History.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { JourneyView } from '@/components/pregnancy/journey-view';
import { Icon } from '@/components/ui/icon';
import { LoadingScreen } from '@/components/ui/loading-screen';
import { Spacing } from '@/constants/theme';
import { useDailyLogs } from '@/hooks/use-daily-logs';
import { usePregnancies } from '@/hooks/use-pregnancies';
import { usePregnancyMoments } from '@/hooks/use-pregnancy-moments';
import { usePregnancyVisits } from '@/hooks/use-pregnancy-visits';
import { useSettings } from '@/hooks/use-settings';
import { useToday } from '@/hooks/use-today';
import { useTheme } from '@/providers/theme-provider';

export default function PastJourneyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const todayISO = useToday();
  const { settings } = useSettings();
  const { pregnancies, isLoading } = usePregnancies();
  const { visits } = usePregnancyVisits();
  const { moments } = usePregnancyMoments();
  const { logs } = useDailyLogs();
  const pregnancy = useMemo(() => pregnancies.find((p) => p.id === id) ?? null, [pregnancies, id]);

  if (isLoading) return <LoadingScreen />;
  if (!pregnancy) return null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + Spacing.sm,
          paddingBottom: insets.bottom + Spacing.xxl,
          paddingHorizontal: Spacing.lg,
          gap: Spacing.md,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          style={styles.back}
        >
          <Icon name="chevron-back" size={26} color={colors.textSecondary} />
        </Pressable>
        <JourneyView
          pregnancy={pregnancy}
          visits={visits}
          moments={moments}
          logs={logs}
          todayISO={todayISO}
          language={(settings?.language as 'en' | 'fr') ?? 'fr'}
          calendarType={(settings?.calendarType as 'gregorian' | 'hijri') ?? 'gregorian'}
          showStarSign={settings?.showStarSign !== 0}
          readOnly
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start' },
});
