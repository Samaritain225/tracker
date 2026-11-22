/**
 * JourneyView — the whole pregnancy as one timeline: the trimesters
 * across the top, then visits, moments, photos and weekly symptom
 * summaries, newest first, with upcoming visits above today.
 *
 * Shown in the History tab while pregnant, and read-only for a
 * pregnancy that has ended.
 */

import { Image } from 'expo-image';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Radii, Spacing, Typography } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import type { DailyLog, Pregnancy, PregnancyMoment, PregnancyVisit } from '@/db/schema';
import { useTheme } from '@/providers/theme-provider';
import { photoUri } from '@/services/user-data';
import { formatDisplayDate, parseISODate } from '@/utils/date';
import { buildJourney } from '@/utils/journey';
import type { JourneyEntry } from '@/utils/journey';
import { effectiveDueDate, gestationalAge, pregnancyProgress } from '@/utils/pregnancy';
import { STAR_SIGN_SYMBOLS, likelyStarSign, starSignFor } from '@/utils/zodiac';

type Props = {
  pregnancy: Pregnancy;
  visits: PregnancyVisit[];
  moments: PregnancyMoment[];
  logs: DailyLog[];
  todayISO: string;
  language: 'en' | 'fr';
  calendarType: 'gregorian' | 'hijri';
  showStarSign: boolean;
  /** Ended pregnancies are shown as they were, with nothing to add or edit. */
  readOnly?: boolean;
  onAddMoment?: () => void;
  onAddVisit?: () => void;
  onOpenVisit?: (visit: PregnancyVisit) => void;
  onOpenMoment?: (moment: PregnancyMoment) => void;
};

type Entry = JourneyEntry<PregnancyVisit, PregnancyMoment>;

/** Trimester lengths in weeks, for the bar across the top. */
const TRIMESTER_WEEKS = [14, 14, 12];

export function JourneyView({
  pregnancy,
  visits,
  moments,
  logs,
  todayISO,
  language,
  calendarType,
  showStarSign,
  readOnly = false,
  onAddMoment,
  onAddVisit,
  onOpenVisit,
  onOpenMoment,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const ownVisits = useMemo(() => visits.filter((v) => v.pregnancyId === pregnancy.id), [visits, pregnancy.id]);
  const ownMoments = useMemo(
    () => moments.filter((m) => m.pregnancyId === pregnancy.id),
    [moments, pregnancy.id],
  );
  const entries = useMemo(
    () => buildJourney(pregnancy, ownVisits, ownMoments, logs, todayISO),
    [pregnancy, ownVisits, ownMoments, logs, todayISO],
  );

  const asOf = pregnancy.endedOn ?? todayISO;
  const age = gestationalAge(pregnancy, asOf);
  const progress = pregnancyProgress(pregnancy, asOf);
  const dueISO = effectiveDueDate(pregnancy);
  const formatDate = (iso: string) => formatDisplayDate(parseISODate(iso), language, calendarType);
  const sign =
    pregnancy.outcome === 'birth' && pregnancy.endedOn
      ? starSignFor(pregnancy.endedOn)
      : likelyStarSign(dueISO).sign;

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <View style={styles.flex}>
          <Text style={styles.kicker}>{t('journey.title')}</Text>
          {pregnancy.outcome === 'loss' ? null : (
            <Text style={styles.heading}>{t('journey.week_of', { week: age.weeks })}</Text>
          )}
        </View>
      </View>

      {pregnancy.outcome === 'loss' ? null : <TrimesterBar progress={progress} styles={styles} />}
      {/* After a loss, no due date and no star sign: both point at a
          baby who isn't coming. */}
      {pregnancy.outcome === 'loss' ? null : (
        <Text style={styles.dueLine}>
          {pregnancy.outcome === 'birth' && pregnancy.endedOn
            ? t('journey.past_born', { date: formatDate(pregnancy.endedOn) })
            : t('journey.past_due', { date: formatDate(dueISO) })}
          {showStarSign ? `  ·  ${STAR_SIGN_SYMBOLS[sign]} ${t(`pregnancy.sign_${sign}`)}` : ''}
        </Text>
      )}

      {readOnly ? (
        <Text style={styles.note}>{t('journey.read_only')}</Text>
      ) : (
        <View style={styles.actions}>
          <View style={styles.flex}>
            <Button label={t('journey.add_moment')} icon="add" onPress={onAddMoment ?? (() => {})} fullWidth />
          </View>
          <View style={styles.flex}>
            <Button
              label={t('journey.add_visit')}
              icon="medkit-outline"
              onPress={onAddVisit ?? (() => {})}
              variant="secondary"
              fullWidth
            />
          </View>
        </View>
      )}

      {entries.length <= 1 && !readOnly ? <Text style={styles.note}>{t('journey.empty')}</Text> : null}

      <View style={styles.timeline}>
        {entries.map((entry) => (
          <TimelineRow
            key={entryKey(entry)}
            entry={entry}
            pregnancy={pregnancy}
            todayWeek={age.weeks}
            formatDate={formatDate}
            readOnly={readOnly}
            onOpenVisit={onOpenVisit}
            onOpenMoment={onOpenMoment}
            styles={styles}
          />
        ))}
      </View>
    </View>
  );
}

function entryKey(entry: Entry): string {
  switch (entry.type) {
    case 'visit':
      return `v-${entry.visit.id}`;
    case 'moment':
      return `m-${entry.moment.id}`;
    case 'week':
      return `w-${entry.summary.week}`;
    default:
      return entry.type;
  }
}

function TrimesterBar({ progress, styles }: { progress: number; styles: Styles }) {
  const { t } = useTranslation();
  const total = TRIMESTER_WEEKS.reduce((a, b) => a + b, 0);
  let before = 0;
  return (
    <View style={styles.trimesters}>
      {TRIMESTER_WEEKS.map((weeks, i) => {
        const share = weeks / total;
        const fill = Math.max(0, Math.min(1, (progress - before) / share));
        before += share;
        return (
          <View key={i} style={[styles.trimester, { flex: weeks }]}>
            <View style={[styles.trimesterFill, { width: `${fill * 100}%` }]} />
            <Text style={styles.trimesterLabel}>{t(`pregnancy.trimester_${i + 1}`)}</Text>
          </View>
        );
      })}
    </View>
  );
}

function TimelineRow({
  entry,
  pregnancy,
  todayWeek,
  formatDate,
  readOnly,
  onOpenVisit,
  onOpenMoment,
  styles,
}: {
  entry: Entry;
  pregnancy: Pregnancy;
  todayWeek: number;
  formatDate: (iso: string) => string;
  readOnly: boolean;
  onOpenVisit?: (visit: PregnancyVisit) => void;
  onOpenMoment?: (moment: PregnancyMoment) => void;
  styles: Styles;
}) {
  const { t } = useTranslation();

  let label: string | null = null;
  let title: string;
  let detail: string | null = null;
  let photo: string | null = null;
  let emphasis = false;
  let onPress: (() => void) | undefined;

  switch (entry.type) {
    case 'today':
      emphasis = true;
      label = t('journey.today');
      title = t('pregnancy.week_label', { week: todayWeek });
      break;
    case 'ended':
      label = formatDate(entry.date);
      title =
        entry.outcome === 'birth'
          ? pregnancy.babyName
            ? `🎉 ${t('journey.born', { name: pregnancy.babyName })}`
            : `🎉 ${t('journey.born_unnamed')}`
          : t('journey.ended');
      break;
    case 'visit': {
      const v = entry.visit;
      label = entry.upcoming ? `${t('journey.upcoming')} · ${formatDate(v.date)}` : formatDate(v.date);
      title = `🩺 ${t(`journey.visit_${v.kind}`)}${v.title ? ` — ${v.title}` : ''}`;
      const facts = [
        v.weightKg !== null ? t('journey.weight', { value: v.weightKg }) : null,
        v.systolic !== null && v.diastolic !== null
          ? t('journey.blood_pressure', { sys: v.systolic, dia: v.diastolic })
          : null,
        v.notes,
      ].filter(Boolean);
      detail = facts.length > 0 ? facts.join(' · ') : null;
      if (!readOnly && onOpenVisit) onPress = () => onOpenVisit(v);
      break;
    }
    case 'moment': {
      const m = entry.moment;
      label = formatDate(m.date);
      switch (m.kind) {
        case 'positive_test':
          title = `✨ ${t('journey.positive_test')}`;
          break;
        case 'kick':
          title = `💗 ${t('journey.kick')}`;
          break;
        case 'due_date_change':
          title = `📅 ${t('journey.due_date_change', { date: m.text ? formatDate(m.text) : '' })}`;
          break;
        case 'photo':
          title = `📷 ${t('journey.photo')}`;
          break;
        default:
          title = `📝 ${t('journey.note')}`;
      }
      if (m.kind !== 'due_date_change' && m.text) detail = m.text;
      if (m.photoFileName) photo = photoUri(m.photoFileName);
      if (!readOnly && onOpenMoment) onPress = () => onOpenMoment(m);
      break;
    }
    case 'week': {
      const s = entry.summary;
      label = formatDate(entry.date);
      title = t('journey.week_summary', { week: s.week });
      detail = s.symptoms
        .map((x) =>
          t('journey.symptom_days', {
            count: x.days,
            name: t(`day_details.symptom_${x.key}`, { defaultValue: x.key }),
          }),
        )
        .join(', ');
      break;
    }
  }

  const body = (
    <View style={styles.row}>
      <View style={[styles.dot, emphasis && styles.dotToday]} />
      <View style={styles.rowText}>
        {label ? <Text style={styles.rowLabel}>{label}</Text> : null}
        <Text style={[styles.rowTitle, emphasis && styles.rowTitleToday]}>{title}</Text>
        {photo ? <Image source={{ uri: photo }} style={styles.photo} contentFit="cover" /> : null}
        {detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}
      </View>
    </View>
  );

  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button">
      {body}
    </Pressable>
  ) : (
    body
  );
}

type Styles = ReturnType<typeof makeStyles>;

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      gap: Spacing.md,
    },
    flex: {
      flex: 1,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    kicker: {
      fontSize: Typography.sizes.sm,
      color: colors.textMuted,
    },
    heading: {
      fontSize: Typography.sizes.xl,
      fontWeight: Typography.weights.bold,
      color: colors.textPrimary,
    },
    trimesters: {
      flexDirection: 'row',
      gap: 3,
    },
    trimester: {
      height: 32,
      borderRadius: Radii.sm,
      backgroundColor: colors.surfaceAlt,
      overflow: 'hidden',
      justifyContent: 'center',
    },
    trimesterFill: {
      ...StyleSheet.absoluteFill,
      backgroundColor: colors.primaryLight,
    },
    trimesterLabel: {
      fontSize: Typography.sizes.xs,
      color: colors.textPrimary,
      paddingHorizontal: Spacing.xs,
    },
    dueLine: {
      fontSize: Typography.sizes.sm,
      color: colors.textSecondary,
    },
    note: {
      fontSize: Typography.sizes.sm,
      color: colors.textMuted,
      fontStyle: 'italic',
    },
    actions: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    timeline: {
      borderLeftWidth: 2,
      borderLeftColor: colors.border,
      marginLeft: Spacing.sm,
      paddingLeft: Spacing.lg,
      gap: Spacing.lg,
      paddingVertical: Spacing.sm,
    },
    row: {
      flexDirection: 'row',
    },
    dot: {
      position: 'absolute',
      left: -Spacing.lg - 7,
      top: 4,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.border,
    },
    dotToday: {
      backgroundColor: colors.primary,
    },
    rowText: {
      flex: 1,
      gap: 2,
    },
    rowLabel: {
      fontSize: Typography.sizes.xs,
      color: colors.textMuted,
    },
    rowTitle: {
      fontSize: Typography.sizes.md,
      color: colors.textPrimary,
    },
    rowTitleToday: {
      fontWeight: Typography.weights.semibold,
    },
    rowDetail: {
      fontSize: Typography.sizes.sm,
      color: colors.textSecondary,
    },
    photo: {
      width: 160,
      height: 200,
      borderRadius: Radii.md,
      marginTop: Spacing.xs,
      backgroundColor: colors.surfaceAlt,
    },
  });
